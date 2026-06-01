import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import {
  Loader2, Wand2, Download, Save, CheckCircle, XCircle, ExternalLink,
  FileText, ListOrdered, BookMarked, Zap, BarChart3, Edit3,
  Eye, RotateCcw, ChevronDown, Upload, X, Check, AlertTriangle,
  GraduationCap, FlaskConical, TrendingUp, ListTree,
} from "lucide-react";
import { useWakeLock } from "@/hooks/useWakeLock";
import FileUploadZone, { type ExtractedFile } from "@/components/FileUploadZone";
import MathRenderer from "@/components/MathRenderer";
import { detectPaperType, detectCitationStyle, extractTopic, extractSubject } from "@/lib/autofill";
import { ExportButtons } from "@/components/ExportButtons";
import { mdToBodyHtml, wrapDocHtml, makeLsgFilename } from "@/lib/exportUtils";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { usePaywallGuard } from "@/hooks/usePaywallGuard";
import { useUserProfile } from "@/hooks/useUserProfile";
import { PaywallFlow } from "@/components/checkout/PaywallFlow";
import { ReadabilityPanel, GrammarPanel, TonePanel, CitationFromUrl } from "@/components/analysis";
import { SubjectSelect } from "@/components/SubjectSelect";
import { FeedbackWidget } from "@/components/FeedbackWidget";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  message: string;
  status: "pending" | "running" | "done" | "error";
}

interface Citation {
  id: string; authors: string; title: string; year: number;
  source: string; url?: string; formatted: string; index: number;
}

interface PaperStats {
  grade: number; aiScore: number; plagiarismScore: number;
  wordCount: number; bodyWordCount: number; feedback: string[];
}

interface PaperResult {
  documentId: number; title: string; content: string;
  citations: Citation[]; bibliography: string; stats: PaperStats;
}

type Phase = "config" | "generating" | "results";
type ResultTab = "paper" | "citations" | "bibliography" | "stats";
type PaperViewMode = "view" | "edit";

// ── Config ────────────────────────────────────────────────────────────────────


const ACADEMIC_LEVELS = [
  { value: "high_school",   label: "High School" },
  { value: "undergrad_1_2", label: "UG Year 1–2" },
  { value: "undergrad_3_4", label: "UG Year 3–4" },
  { value: "honours",       label: "Honours" },
  { value: "masters",       label: "Masters" },
  { value: "phd",           label: "PhD" },
];

const DATA_PAPER_TYPES = new Set([
  "research", "research paper", "lab report", "report",
  "dissertation", "thesis", "case study", "term paper",
  "research proposal", "grant proposal",
  "business plan", "financial analysis", "capstone project",
]);

const FINANCIAL_STATEMENT_TYPES = [
  { value: "income_statement", label: "Income Statement (P&L)" },
  { value: "balance_sheet",    label: "Balance Sheet" },
  { value: "cash_flow",        label: "Cash Flow Statement" },
  { value: "all",              label: "Full Statements" },
];

const FINANCE_SUBJECT_RE = /finance|accounting|economics|banking|investment|insurance|actuarial|business\s*studies|credit\s*anal/i;

// ── Financial Health Score ─────────────────────────────────────────────────

function parseFF(text: string, pats: string[]): number | null {
  for (const pat of pats) {
    const m = text.match(new RegExp(pat + '[^\\n]{0,20}?\\$?([\\d,\\.]+)', 'i'));
    if (m) { const v = parseFloat(m[1].replace(/,/g, '')); if (!isNaN(v) && v > 0) return v; }
  }
  return null;
}
type FHGrade = "A" | "B" | "C" | "D" | "F";
interface FHCategory { grade: FHGrade; color: string; metrics: string[]; computed: boolean }
function gpaToGrade(gpa: number): { grade: FHGrade; color: string } {
  if (gpa >= 3.5) return { grade: "A", color: "border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400" };
  if (gpa >= 2.5) return { grade: "B", color: "border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400" };
  if (gpa >= 1.5) return { grade: "C", color: "border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400" };
  if (gpa >= 0.5) return { grade: "D", color: "border-orange-500/30 bg-orange-500/5 text-orange-600 dark:text-orange-400" };
  return { grade: "F", color: "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400" };
}
// ── Multi-year trend detection (client-side) ──────────────────────────────
interface TrendYoY { label: string; yoy: string; up: boolean | null }
function detectTrendData(text: string): { years: string[]; rows: TrendYoY[] } | null {
  const yearMatches = [...text.matchAll(/\b(20\d{2})\b/g)].map(m => m[1]);
  const uniqueYears = [...new Set(yearMatches)].sort();
  if (uniqueYears.length < 2) return null;

  // Try to build per-year segments using section headers
  function getSegment(yr: string): string {
    const secPat = new RegExp(`(?:^|\\n)\\s*(?:(?:fy|fiscal\\s+year?\\s*|year\\s*):?\\s*)?${yr}\\s*(?::[ \\t]*)?\\s*(?=\\n|$)`, 'i');
    const m = text.match(secPat);
    if (!m || m.index == null) return "";
    const start = m.index + m[0].length;
    // End = next year section or EOF
    const otherYrs = uniqueYears.filter(y => y !== yr);
    const nextPat = new RegExp(`(?:^|\\n)\\s*(?:(?:fy|fiscal\\s+year?\\s*|year\\s*):?\\s*)?(?:${otherYrs.join('|')})\\s*(?::[ \\t]*)?\\s*(?=\\n|$)`, 'i');
    const nextM = text.slice(start).match(nextPat);
    return nextM ? text.slice(start, start + (nextM.index ?? text.length)) : text.slice(start);
  }

  const rows: TrendYoY[] = [];
  const sortedYrs = [...uniqueYears].sort();
  const segs = sortedYrs.map(y => ({ year: y, seg: getSegment(y) }));
  const allHaveSegs = segs.every(s => s.seg.trim().length > 0);

  if (allHaveSegs) {
    const getPP = (seg: string, pats: string[]) => parseFF(seg, pats);
    const addRow = (label: string, pats: string[]) => {
      const vals = segs.map(s => getPP(s.seg, pats));
      if (vals.every(v => v == null)) return;
      for (let i = 1; i < segs.length; i++) {
        const curr = vals[i], prev = vals[i - 1];
        if (curr == null || prev == null || prev === 0) continue;
        const g = ((curr - prev) / Math.abs(prev)) * 100;
        rows.push({ label: `${label} (${segs[i - 1].year}→${segs[i].year})`, yoy: `${g >= 0 ? "+" : ""}${g.toFixed(1)}%`, up: g > 0 });
      }
    };
    addRow("Revenue",    ["revenue","net sales","total revenue","net revenue","sales"]);
    addRow("Net Income", ["net income","net profit","net earnings"]);
    addRow("Gross Profit",["gross profit","gross income"]);
    addRow("Total Assets",["total assets"]);
  }

  return { years: uniqueYears, rows };
}

function computeFinancialHealthScores(text: string): {
  profitability: FHCategory; liquidity: FHCategory; solvency: FHCategory; efficiency: FHCategory;
  overall: { grade: FHGrade; color: string };
} | null {
  const p = (pats: string[]) => parseFF(text, pats);
  const revenue   = p(['revenue','net sales','total revenue','net revenue','sales']);
  const cogs      = p(['cost of goods sold','cogs','cost of sales','cost of revenue']);
  const grossP    = p(['gross profit','gross income']) ?? (revenue && cogs != null ? revenue - cogs : null);
  const opIncome  = p(['operating income','operating profit','ebit','income from operations']);
  const netIncome = p(['net income','net profit','net earnings']);
  const totAssets = p(['total assets']);
  const curAssets = p(['current assets','total current assets']);
  const curLiabs  = p(['current liabilities','total current liabilities']);
  const totLiabs  = p(['total liabilities']);
  const equity    = p(['total equity',"shareholders' equity","stockholders' equity",'owners equity','equity']);
  const cash      = p(['cash and cash equivalents','cash and equivalents','cash$','cash ']);
  const inventory = p(['inventories','inventory']);
  const recv      = p(['accounts receivable','trade receivables','net receivables']);
  const intExp    = p(['interest expense','interest charges','finance costs']);
  if (!revenue && !totAssets && !curAssets) return null;
  const sc = (pts: number, mx: number) => mx > 0 ? (pts / mx) * 4 : -1;
  const mk = (gpa: number, metrics: string[]): FHCategory => ({ ...gpaToGrade(Math.max(0, gpa)), metrics, computed: metrics.length > 0 });

  // Profitability
  const pm: string[] = []; let pp = 0, pmx = 0;
  if (revenue && grossP   != null) { const v = grossP   / revenue * 100; pm.push(`Gross Margin ${v.toFixed(1)}%`);      pp += v>=50?4:v>=30?3:v>=15?2:v>=0?1:0; pmx+=4; }
  if (revenue && netIncome!= null) { const v = netIncome/ revenue * 100; pm.push(`Net Margin ${v.toFixed(1)}%`);        pp += v>=15?4:v>=8?3:v>=3?2:v>=0?1:0;    pmx+=4; }
  if (totAssets&& netIncome!=null) { const v = netIncome/totAssets* 100; pm.push(`ROA ${v.toFixed(1)}%`);               pp += v>=10?4:v>=5?3:v>=2?2:v>=0?1:0;    pmx+=4; }
  if (equity   && netIncome!=null) { const v = netIncome/equity   * 100; pm.push(`ROE ${v.toFixed(1)}%`);               pp += v>=20?4:v>=12?3:v>=5?2:v>=0?1:0;   pmx+=4; }
  if (revenue && opIncome  !=null) { const v = opIncome / revenue * 100; pm.push(`Op. Margin ${v.toFixed(1)}%`);        pp += v>=20?4:v>=12?3:v>=5?2:v>=0?1:0;   pmx+=4; }

  // Liquidity
  const lm: string[] = []; let lp = 0, lmx = 0;
  if (curAssets && curLiabs)                 { const v = curAssets/curLiabs;                  lm.push(`Current ${v.toFixed(2)}x`); lp+=v>=2.5?4:v>=1.5?3:v>=1?2:v>=0.5?1:0; lmx+=4; }
  if (curAssets && curLiabs && inventory!=null) { const v = (curAssets-inventory)/curLiabs;   lm.push(`Quick ${v.toFixed(2)}x`);   lp+=v>=1.5?4:v>=1?3:v>=0.7?2:v>=0.3?1:0; lmx+=4; }
  if (cash     && curLiabs)                 { const v = cash/curLiabs;                        lm.push(`Cash ${v.toFixed(2)}x`);    lp+=v>=0.5?4:v>=0.3?3:v>=0.1?2:v>=0?1:0; lmx+=4; }

  // Solvency
  const sm: string[] = []; let sp = 0, smx = 0;
  if (totLiabs && equity)    { const v = totLiabs/equity;             sm.push(`D/E ${v.toFixed(2)}x`);          sp+=v<=0.5?4:v<=1?3:v<=2?2:v<=3?1:0;    smx+=4; }
  if (totLiabs && totAssets) { const v = totLiabs/totAssets*100;      sm.push(`Debt Ratio ${v.toFixed(1)}%`);   sp+=v<=30?4:v<=50?3:v<=65?2:v<=80?1:0;  smx+=4; }
  if (opIncome && intExp)    { const v = opIncome/intExp;             sm.push(`Int. Coverage ${v.toFixed(1)}x`); sp+=v>=5?4:v>=3?3:v>=1.5?2:v>=1?1:0;   smx+=4; }

  // Efficiency
  const em: string[] = []; let ep = 0, emx = 0;
  if (revenue  && totAssets)           { const v = revenue/totAssets;          em.push(`Asset Turn. ${v.toFixed(2)}x`); ep+=v>=1.5?4:v>=1?3:v>=0.5?2:v>=0.2?1:0; emx+=4; }
  if (cogs     && inventory && inventory>0) { const v = cogs/inventory;        em.push(`Inv. Turns ${v.toFixed(1)}x`); ep+=v>=10?4:v>=6?3:v>=3?2:v>=1?1:0;       emx+=4; }
  if (revenue  && recv      && recv>0) { const v = recv/revenue*365;           em.push(`DSO ${v.toFixed(0)}d`);         ep+=v<=30?4:v<=45?3:v<=60?2:v<=90?1:0;    emx+=4; }

  const gpas = [sc(pp,pmx), sc(lp,lmx), sc(sp,smx), sc(ep,emx)].filter(g => g >= 0);
  const overall = gpas.length > 0 ? gpas.reduce((a,b) => a+b,0) / gpas.length : 0;
  return { profitability: mk(sc(pp,pmx), pm), liquidity: mk(sc(lp,lmx), lm), solvency: mk(sc(sp,smx), sm), efficiency: mk(sc(ep,emx), em), overall: gpaToGrade(overall) };
}

interface StatTest {
  value: string;
  label: string;
  cat: string;
  hint: string;
}

const STATISTICAL_TESTS: StatTest[] = [
  // ── Comparing groups (parametric) ──────────────────────────────────────────
  { value: "ttest_ind",         label: "Independent t-test",        cat: "Comparing Groups",       hint: "2 independent groups, continuous DV" },
  { value: "ttest_paired",      label: "Paired t-test",             cat: "Comparing Groups",       hint: "Before/after or matched pairs" },
  { value: "oneway_anova",      label: "One-way ANOVA",             cat: "Comparing Groups",       hint: "3+ groups, single factor" },
  { value: "twoway_anova",      label: "Two-way ANOVA",             cat: "Comparing Groups",       hint: "Two factors + interaction" },
  { value: "manova",            label: "MANOVA",                    cat: "Comparing Groups",       hint: "Multiple DVs, Wilks' Λ" },
  { value: "repeated_anova",    label: "Repeated Measures ANOVA",   cat: "Comparing Groups",       hint: "Within-subject, sphericity test" },
  // ── Non-parametric alternatives ────────────────────────────────────────────
  { value: "mann_whitney",      label: "Mann-Whitney U",            cat: "Non-parametric",         hint: "Non-param 2-group, effect size r" },
  { value: "wilcoxon",          label: "Wilcoxon Signed-Rank",      cat: "Non-parametric",         hint: "Non-param paired, W statistic" },
  { value: "kruskal_wallis",    label: "Kruskal-Wallis H",          cat: "Non-parametric",         hint: "Non-param ANOVA, Dunn post-hoc" },
  { value: "friedman",          label: "Friedman Test",             cat: "Non-parametric",         hint: "Non-param repeated, Kendall's W" },
  // ── Relationships & association ────────────────────────────────────────────
  { value: "pearson",           label: "Pearson Correlation",       cat: "Relationships",          hint: "r, R², 95% CI, correlation matrix" },
  { value: "spearman",          label: "Spearman Correlation",      cat: "Relationships",          hint: "Rank-based, monotonic relationship" },
  { value: "chi_square",        label: "Chi-Square Test",           cat: "Relationships",          hint: "Categorical association, Cramér's V" },
  { value: "fishers_exact",     label: "Fisher's Exact Test",       cat: "Relationships",          hint: "2×2 table, small expected frequencies" },
  { value: "point_biserial",    label: "Point-Biserial r",          cat: "Relationships",          hint: "Binary × continuous correlation" },
  { value: "cramers_v",         label: "Cramér's V",                cat: "Relationships",          hint: "Chi-square effect size" },
  // ── Regression ─────────────────────────────────────────────────────────────
  { value: "simple_regression",      label: "Simple Linear Regression",      cat: "Regression", hint: "1 predictor, R², B, β, 95% CI" },
  { value: "multiple_regression",    label: "Multiple Linear Regression",    cat: "Regression", hint: "2+ predictors, VIF, Adj R²" },
  { value: "logistic_regression",    label: "Binary Logistic Regression",    cat: "Regression", hint: "Binary outcome, OR, Nagelkerke R²" },
  { value: "polynomial_regression",  label: "Polynomial Regression",         cat: "Regression", hint: "Curvilinear fit, ΔR² test" },
  { value: "hierarchical_regression",label: "Hierarchical Regression",       cat: "Regression", hint: "Blocked steps, ΔR² per block" },
  // ── Descriptive & distribution ─────────────────────────────────────────────
  { value: "descriptives",      label: "Full Descriptives Table",   cat: "Descriptive",            hint: "N, mean, SD, SE, skew, kurtosis" },
  { value: "normality",         label: "Normality Tests",           cat: "Descriptive",            hint: "Shapiro-Wilk / K-S for each variable" },
  { value: "frequency",         label: "Frequency Analysis",        cat: "Descriptive",            hint: "n, %, cumulative % for categories" },
  { value: "effect_size",       label: "Effect Sizes",              cat: "Descriptive",            hint: "d, η², r, R², V — all tests" },
  { value: "confidence_intervals", label: "Confidence Intervals",   cat: "Descriptive",            hint: "95% CIs for all key estimates" },
  // ── Advanced / multivariate ────────────────────────────────────────────────
  { value: "pca",               label: "PCA",                       cat: "Advanced",               hint: "KMO, eigenvalues, rotated loadings" },
  { value: "factor_analysis",   label: "Factor Analysis (EFA)",     cat: "Advanced",               hint: "Communalities, factor loadings, α" },
  { value: "cluster_kmeans",    label: "K-means Clustering",        cat: "Advanced",               hint: "Cluster profiles, centroids, WSS" },
  { value: "reliability",       label: "Reliability (Cronbach's α)", cat: "Advanced",              hint: "Item-total r, α if item deleted" },
  { value: "time_series",       label: "Time Series / Trend",       cat: "Advanced",               hint: "Trend line, D-W autocorrelation" },
  { value: "survival",          label: "Survival Analysis",         cat: "Advanced",               hint: "Kaplan-Meier, log-rank, hazard ratio" },
  { value: "mediation",         label: "Mediation Analysis",        cat: "Advanced",               hint: "Indirect effect, bootstrap 95% CI" },
  { value: "moderation",        label: "Moderation / Interaction",  cat: "Advanced",               hint: "X×W interaction, simple slopes" },
];

const TEST_CATEGORIES = ["Comparing Groups", "Non-parametric", "Relationships", "Regression", "Descriptive", "Advanced"];

const ANALYSIS_TOOLS: { value: string; label: string; badge: string; desc: string }[] = [
  { value: "r",       label: "R / RStudio",    badge: "R",       desc: "t.test(), lm(), ggplot2, tidyverse" },
  { value: "python",  label: "Python",          badge: "PY",      desc: "pandas, scipy, statsmodels, seaborn" },
  { value: "excel",   label: "Excel",           badge: "XL",      desc: "Data Analysis ToolPak, pivot tables" },
  { value: "spss",    label: "SPSS",            badge: "SPSS",    desc: "IBM SPSS Statistics output format" },
  { value: "stata",   label: "Stata",           badge: "STATA",   desc: "regress, ttest, anova commands" },
  { value: "sas",     label: "SAS",             badge: "SAS",     desc: "PROC MEANS, PROC REG, PROC GLM" },
  { value: "matlab",  label: "MATLAB",          badge: "MAT",     desc: "fitlm(), ttest2(), Statistics Toolbox" },
  { value: "minitab", label: "Minitab",         badge: "MTB",     desc: "Minitab output tables and menu paths" },
  { value: "prism",   label: "GraphPad Prism",  badge: "PRISM",   desc: "Biomedical stats, Tukey, F(DFn,DFd)" },
  { value: "jamovi",  label: "jamovi",          badge: "JMV",     desc: "jamovi (R-based GUI, Cohen's d auto)" },
  { value: "jasp",    label: "JASP",            badge: "JASP",    desc: "Bayesian stats, BF₁₀, Jeffreys scale" },
  { value: "tableau", label: "Tableau",         badge: "TAB",     desc: "Visual analytics, trend lines, LOD" },
  { value: "powerbi", label: "Power BI",        badge: "PBI",     desc: "DAX measures, Power Query, KPIs" },
  { value: "julia",   label: "Julia",           badge: "JL",      desc: "GLM.jl, HypothesisTests.jl, Plots.jl" },
];

const FINANCE_SUBJECTS = new Set([
  "finance", "accounting", "financial analysis", "economics", "banking",
  "investment", "insurance", "actuarial", "business studies", "business",
  "financial management", "corporate finance", "managerial accounting",
]);

const PAPER_TYPES = [
  { value: "research",               label: "Research Paper" },
  { value: "essay",                  label: "Essay" },
  { value: "argumentative",          label: "Argumentative Essay" },
  { value: "persuasive",             label: "Persuasive Essay" },
  { value: "narrative",              label: "Narrative Essay" },
  { value: "descriptive",            label: "Descriptive Essay" },
  { value: "expository",             label: "Expository Essay" },
  { value: "admission essay",        label: "Admission Essay" },
  { value: "scholarship essay",      label: "Scholarship Essay" },
  { value: "thesis",                 label: "Thesis" },
  { value: "dissertation",           label: "Dissertation" },
  { value: "literature_review",      label: "Lit. Review" },
  { value: "annotated bibliography", label: "Annotated Bibliography" },
  { value: "research proposal",      label: "Research Proposal" },
  { value: "grant proposal",         label: "Grant Proposal" },
  { value: "proposal",               label: "General Proposal" },
  { value: "report",                 label: "Report" },
  { value: "lab report",             label: "Lab Report" },
  { value: "case study",             label: "Case Study" },
  { value: "term paper",             label: "Term Paper" },
  { value: "coursework",             label: "Coursework" },
  { value: "capstone project",       label: "Capstone Project" },
  { value: "critical analysis",      label: "Critical Analysis" },
  { value: "article review",         label: "Article Review" },
  { value: "book review",            label: "Book Review" },
  { value: "movie review",           label: "Film/Movie Review" },
  { value: "reflective",             label: "Reflective Essay" },
  { value: "personal statement",     label: "Personal Statement" },
  { value: "speech",                 label: "Speech" },
  { value: "presentation",           label: "Presentation" },
  { value: "position paper",         label: "Position Paper" },
  { value: "policy brief",           label: "Policy Brief" },
  { value: "white paper",            label: "White Paper" },
  { value: "business plan",          label: "Business Plan" },
  { value: "financial analysis",     label: "Financial Analysis" },
];

const CITATION_STYLES = ["apa", "mla", "chicago", "harvard", "ieee", "turabian", "vancouver", "ama", "asa", "bluebook", "oscola"] as const;

const SPACING_OPTIONS = [
  { value: "double", label: "Double" },
  { value: "1.5",    label: "1.5" },
  { value: "single", label: "Single" },
];

const LANGUAGE_OPTIONS = [
  { value: "us",  label: "US English" },
  { value: "uk",  label: "UK English" },
  { value: "au",  label: "Australian English" },
];

const STEP_ORDER = ["citations", "data", "stem", "writing", "bibliography", "stats"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderInlineText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3] !== undefined) parts.push(<em key={m.index}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function lineHasMath(line: string): boolean {
  return /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/.test(line);
}

function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("# "))   { nodes.push(<h1 key={i} className="text-xl font-bold mt-6 mb-2 text-foreground">{line.slice(2)}</h1>); i++; continue; }
    if (line.startsWith("## "))  { nodes.push(<h2 key={i} className="text-base font-bold mt-5 mb-2 text-foreground border-b border-border pb-1">{line.slice(3)}</h2>); i++; continue; }
    if (line.startsWith("### ")) { nodes.push(<h3 key={i} className="text-sm font-semibold mt-4 mb-1.5 text-foreground">{line.slice(4)}</h3>); i++; continue; }
    if (line.trim() === "")      { nodes.push(<div key={i} className="h-2" />); i++; continue; }

    if (line.startsWith("$$") && line.trim() !== "$$") {
      nodes.push(<MathRenderer key={i} text={line.trim()} displayMode className="my-4 text-center" />);
      i++; continue;
    }

    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="list-disc list-inside text-sm text-foreground leading-relaxed mb-2 space-y-0.5 pl-2">
          {items.map((it, j) => <li key={j}>{lineHasMath(it) ? <MathRenderer text={it} className="inline" /> : renderInlineText(it)}</li>)}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside text-sm text-foreground leading-relaxed mb-2 space-y-0.5 pl-2">
          {items.map((it, j) => <li key={j}>{lineHasMath(it) ? <MathRenderer text={it} className="inline" /> : renderInlineText(it)}</li>)}
        </ol>
      );
      continue;
    }

    if (lineHasMath(line)) {
      nodes.push(<MathRenderer key={i} text={line} className="text-sm text-foreground leading-relaxed mb-1" />);
      i++; continue;
    }

    nodes.push(
      <p key={i} className="text-sm text-foreground leading-relaxed mb-1">
        {renderInlineText(line)}
      </p>
    );
    i++;
  }

  return nodes;
}

function StatCard({ label, value, color, sublabel, passing }: {
  label: string; value: string; color: string; sublabel?: string; passing?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-2 py-1 sm:px-3 sm:py-2.5 flex items-center gap-2 sm:flex-col sm:items-start sm:gap-0.5 ${color}`}>
      <div className="flex items-center gap-1 shrink-0 sm:w-full">
        <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide opacity-70 leading-none">{label}</span>
        {passing !== undefined && (
          passing
            ? <CheckCircle size={9} className="text-green-500 shrink-0" />
            : <XCircle size={9} className="text-red-400 shrink-0" />
        )}
      </div>
      <span className="text-base sm:text-xl font-bold leading-none">{value}</span>
      {sublabel && <span className="hidden sm:block text-[10px] opacity-60 mt-0.5">{sublabel}</span>}
    </div>
  );
}

function downloadPaper(content: string, title: string, bibliography: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.8;
         max-width: 750px; margin: 60px auto; color: #111; padding: 0 40px; }
  h1 { font-size: 16pt; text-align: center; margin-bottom: 6px; }
  h2 { font-size: 13pt; margin-top: 24px; }
  h3 { font-size: 12pt; margin-top: 16px; }
  p  { margin-bottom: 12px; text-align: justify; }
  .bibliography { margin-top: 32px; border-top: 1px solid #ccc; padding-top: 16px; font-size: 11pt; }
</style>
</head>
<body>
${content
  .replace(/^# (.*)/gm, "<h1>$1</h1>")
  .replace(/^## (.*)/gm, "<h2>$1</h2>")
  .replace(/^### (.*)/gm, "<h3>$1</h3>")
  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  .replace(/\*(.*?)\*/g, "<em>$1</em>")
  .split("\n\n").map(p => p.startsWith("<h") ? p : `<p>${p}</p>`).join("\n")}
<div class="bibliography"><h2>References</h2><p>${bibliography.replace(/\n/g, "<br>")}</p></div>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, "_")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WritePaper() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { guard, openBuy, plan, isAtLimit, pickerState, checkoutState, closePicker, closeCheckout, chooseSubscription, choosePayg } = usePaywallGuard();

  // ── phase
  const [phase, setPhase] = useState<Phase>("config");
  const [steps, setSteps] = useState<Step[]>([]);
  const [streamedContent, setStreamedContent] = useState("");
  const [result, setResult] = useState<PaperResult | null>(null);
  const [genError, setGenError] = useState("");

  // ── results UI
  const [resultTab, setResultTab] = useState<ResultTab>("paper");
  const [viewMode, setViewMode] = useState<PaperViewMode>("view");
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // ── form
  const [paperType, setPaperType] = useState("research");
  const [citationStyle, setCitationStyle] = useState<string>("apa");
  const [wordCount, setWordCount] = useState(1000);
  const { academicLevel, saveAcademicLevel } = useUserProfile();
  const [isStem, setIsStem] = useState(false);
  const [spacing, setSpacing] = useState("double");
  const [numSources, setNumSources] = useState<number | "">("");
  const [language, setLanguage] = useState("us");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [rubricText, setRubricText] = useState("");
  const [fromPlagiarism, setFromPlagiarism] = useState(false);
  const [referenceText, setReferenceText] = useState("");
  const [datasetText, setDatasetText] = useState("");
  const [datasetPreview, setDatasetPreview] = useState<string[][]>([]);
  const [analysisTool, setAnalysisTool] = useState<string>("r");
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [includeAssumptionsCheck, setIncludeAssumptionsCheck] = useState(true);
  const [financialStatements, setFinancialStatements]       = useState("");
  const [financialStatementType, setFinancialStatementType] = useState("all");
  const [isFsExtracting, setIsFsExtracting]                 = useState(false);
  const fsInputRef                                           = useRef<HTMLInputElement>(null);
  const [includeInterpretiveCommentary, setIncludeInterpretiveCommentary] = useState(false);

  // ── citation confirmation
  const [detectedStyle, setDetectedStyle] = useState<string | null>(null);
  const [styleConfirmed, setStyleConfirmed] = useState(false);

  // ── ref for streaming scroll
  const streamRef = useRef<HTMLDivElement>(null);

  // ── target word count captured at generation start (for condition checking)
  const targetWordCountRef = useRef<number>(1500);

  // ── elapsed time during generation
  const [elapsedSecs, setElapsedSecs] = useState(0);

  // ── keep screen awake during generation
  useWakeLock(phase === "generating");

  // ── autofill from assignment brief
  const handleBriefExtracted = useCallback((file: ExtractedFile) => {
    const text = file.text;
    if (!topic) setTopic(extractTopic(text) ?? "");
    if (!subject) setSubject(extractSubject(text) ?? "");
    setPaperType(detectPaperType(text));
    const detected = detectCitationStyle(text);
    setDetectedStyle(detected);
    setStyleConfirmed(false);
    setCitationStyle(detected);
    setAdditionalInstructions(text.slice(0, 2000));
    // detect word count
    const wMatch = text.match(/(\d[\d,]*)\s*(?:to\s*(\d[\d,]*))?\s*words?\b/i);
    if (wMatch) {
      const n = parseInt(wMatch[1].replace(/,/g, ""), 10);
      if (n >= 100 && n <= 15000) setWordCount(n);
    }
  }, [topic, subject]);

  // ── elapsed timer — counts up while generation is in progress
  useEffect(() => {
    if (phase !== "generating") { setElapsedSecs(0); return; }
    setElapsedSecs(0);
    const t = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // ── pre-fill from AI & Plagiarism checker redirect, or from Outline
  useEffect(() => {
    // 1. Check for outline prefill stored in sessionStorage
    const outlinePrefill = sessionStorage.getItem("outline_prefill");
    if (outlinePrefill) {
      try {
        const data = JSON.parse(outlinePrefill) as {
          topic?: string;
          subject?: string;
          paperType?: string;
          wordCount?: number;
          additionalInstructions?: string;
        };
        sessionStorage.removeItem("outline_prefill");
        if (data.topic)    setTopic(data.topic);
        if (data.subject)  setSubject(data.subject);
        if (data.paperType) setPaperType(data.paperType);
        if (data.wordCount) setWordCount(data.wordCount);
        if (data.additionalInstructions) setAdditionalInstructions(data.additionalInstructions);
        return; // skip URL params if outline prefill was used
      } catch { /* ignore parse errors */ }
    }

    // 2. Fallback: URL params (from plagiarism checker or other tools)
    const params = new URLSearchParams(window.location.search);
    const t = params.get("topic");
    const s = params.get("subject");
    const pt = params.get("type");
    const from = params.get("from");
    if (t) setTopic(decodeURIComponent(t));
    if (s) setSubject(decodeURIComponent(s));
    if (pt) setPaperType(pt);
    if (from === "plagiarism") setFromPlagiarism(true);
  }, []);

  // ── autofill from rubric
  const handleRubricExtracted = useCallback((file: ExtractedFile) => {
    setRubricText(file.text.slice(0, 3000));
  }, []);

  // ── accumulate reference / reading materials
  const handleReferenceExtracted = useCallback((file: ExtractedFile) => {
    setReferenceText(prev => (prev ? prev + "\n\n" : "") + file.text.slice(0, 5000));
  }, []);

  // ── dataset upload (CSV / TSV / text)
  const handleDatasetUpload = useCallback((file: ExtractedFile) => {
    const raw = file.text.slice(0, 50000);
    setDatasetText(raw);
    const lines = raw.trim().split("\n").filter(Boolean);
    if (lines.length > 0) {
      const firstLine = lines[0];
      const sep = firstLine.split("\t").length > firstLine.split(",").length ? "\t" : ",";
      setDatasetPreview(lines.slice(0, 4).map(l => l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""))));
    }
  }, []);

  // ── financial statement upload (PDF / DOCX / TXT)
  const handleFsFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsFsExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/files/extract`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Extract failed");
      const data = await res.json() as { text?: string; isImage?: boolean };
      if (data.isImage) return;
      setFinancialStatements((data.text ?? "").slice(0, 50000));
    } catch { /* silent */ } finally {
      setIsFsExtracting(false);
    }
  }, []);

  // ── PAYG-only tier helper
  function getWordCountTier(words: number): "discussion" | "essay" | "research" | "proposal" | "dissertation" {
    if (words < 500) return "discussion";
    if (words < 1500) return "essay";
    if (words < 3500) return "research";
    if (words < 6000) return "proposal";
    return "dissertation";
  }

  // ── generate
  const handleGenerate = async () => {
    if (!topic.trim() || !subject.trim()) return;

    // Proposal / Dissertation tiers are PAYG-only — subscribers must still pay per use
    const tier = getWordCountTier(wordCount);
    if (tier === "proposal" || tier === "dissertation") {
      openBuy("paper", tier);
      return;
    }

    if (isAtLimit("paper")) { guard("paper", () => {}); return; }

    targetWordCountRef.current = wordCount;
    setPhase("generating");
    setStreamedContent("");
    setGenError("");
    const initialSteps: Step[] = STEP_ORDER
      .filter(id => id !== "stem" || isStem)
      .filter(id => id !== "data" || !!datasetText.trim() || !!financialStatements.trim())
      .map(id => ({ id, message: "", status: "pending" }));
    setSteps(initialSteps);

    try {
      
      const resp = await apiFetch(`/writing/generate-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({
          topic: topic.trim(),
          subject: subject.trim(),
          paperType,
          wordCount,
          citationStyle,
          academicLevel,
          isStem,
          spacing,
          numSources: numSources || undefined,
          language,
          additionalInstructions: additionalInstructions.trim() || undefined,
          rubricText: rubricText.trim() || undefined,
          referenceText: referenceText.trim() || undefined,
          datasetText: datasetText.trim() || undefined,
          analysisTool: datasetText.trim() ? analysisTool : undefined,
          selectedTests: datasetText.trim() && selectedTests.length > 0 ? selectedTests : undefined,
          includeAssumptionsCheck: datasetText.trim() ? includeAssumptionsCheck : undefined,
          financialStatements: financialStatements.trim() || undefined,
          financialStatementType: financialStatements.trim() ? financialStatementType : undefined,
          includeInterpretiveCommentary: (datasetText.trim() || financialStatements.trim()) ? includeInterpretiveCommentary : undefined,
        }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error("Server error — please try again");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const updateStep = (id: string, message: string, status: Step["status"]) => {
        setSteps(prev => {
          const exists = prev.some(s => s.id === id);
          if (exists) return prev.map(s => s.id === id ? { ...s, message, status } : s);
          return [...prev, { id, message, status }];
        });
      };

      let receivedFinalEvent = false;
      let event = ""; // persists across chunks — event: and data: lines may arrive in different chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("event: ")) { event = line.slice(7).trim(); }
          else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (event === "step") {
                updateStep(data.id, data.message, data.status);
              } else if (event === "token") {
                setStreamedContent(prev => {
                  const next = prev + data.text;
                  setTimeout(() => streamRef.current?.scrollTo(0, streamRef.current.scrollHeight), 0);
                  return next;
                });
              } else if (event === "done") {
                receivedFinalEvent = true;
                setResult(data as PaperResult);
                setEditedContent(data.content);
                setPhase("results");
                setResultTab("paper");
                setViewMode("view");
              } else if (event === "error") {
                receivedFinalEvent = true;
                setGenError(data.message ?? "Unknown error");
                setPhase("config");
              }
            } catch { /* ignore parse errors */ }
            event = "";
          }
        }
      }
      // Stream ended without a final "done" or "error" event — connection was interrupted
      if (!receivedFinalEvent) {
        setGenError("Connection was interrupted before the paper was completed. The server may need more time — please try again.");
        setPhase("config");
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Network error — please try again");
      setPhase("config");
    }
  };

  // ── save edits
  const handleSave = async () => {
    if (!result) return;
    setIsSaving(true);
    // Always apply edits locally and switch to view immediately
    setResult(prev => prev ? { ...prev, content: editedContent } : prev);
    setViewMode("view");

    if (!result.documentId) {
      setSaveMsg("Edits applied");
      setTimeout(() => setSaveMsg(""), 2000);
      setIsSaving(false);
      return;
    }

    try {
      const resp = await apiFetch(`/writing/save/${result.documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editedContent }),
      });
      if (resp.ok) {
        const data = await resp.json() as { wordCount: number };
        setResult(prev => prev ? { ...prev, stats: { ...prev.stats, bodyWordCount: data.wordCount } } : prev);
        setSaveMsg("Changes saved!");
      } else {
        setSaveMsg("Server save failed — edits kept locally");
      }
    } catch {
      setSaveMsg("Save failed — edits kept locally");
    }
    setTimeout(() => setSaveMsg(""), 3000);
    setIsSaving(false);
  };

  // ── GENERATING PHASE ──────────────────────────────────────────────────────

  if (phase === "generating") {
    const doneCount = steps.filter(s => s.status === "done").length;
    const total = steps.filter(s => s.status !== "pending" || s.message).length || steps.length;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    // Approximate live word count from streamed content
    const liveWords = streamedContent.trim().split(" ").filter(Boolean).length;
    const runningStep = steps.find(s => s.status === "running");

    return (
      <div className="h-full flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-border bg-card flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-primary" />
            <span className="font-bold tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
              LIGHT SPEED AI
            </span>
          </div>
          <span className="text-muted-foreground text-sm hidden sm:inline">— Working on your paper</span>
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            {liveWords > 0 && (
              <span className="tabular-nums">{liveWords.toLocaleString()} words written</span>
            )}
            <span>{pct}%</span>
            {elapsedSecs > 0 && (
              <span className="tabular-nums opacity-60">
                {elapsedSecs >= 60
                  ? `${Math.floor(elapsedSecs / 60)}m ${elapsedSecs % 60}s`
                  : `${elapsedSecs}s`}
              </span>
            )}
          </div>
        </div>

        {/* Slim progress bar */}
        <div className="h-0.5 bg-muted shrink-0">
          <div
            className="h-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-700"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Left: narrative activity feed */}
          <div className="shrink-0 border-b md:border-b-0 md:w-80 md:border-r border-border flex flex-col overflow-hidden max-h-44 md:max-h-none">
            {/* Current action headline */}
            <div className="px-5 py-4 border-b border-border bg-muted/20 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Currently</p>
              <p className="text-sm font-medium text-foreground leading-snug min-h-[2.5rem]">
                {runningStep?.message ?? (doneCount === total && total > 0 ? "Finalising paper…" : "Preparing to start…")}
              </p>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0">
              {steps.map((step, i) => (
                <div key={step.id} className="relative">
                  {/* Vertical connector */}
                  {i < steps.length - 1 && (
                    <div className="absolute left-[7px] top-5 w-px h-full bg-border" />
                  )}

                  <div className="flex items-start gap-3 py-2.5">
                    {/* Status indicator — no spinner, just dots and marks */}
                    <div className="shrink-0 mt-0.5 z-10">
                      {step.status === "done" && (
                        <div className="w-3.5 h-3.5 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        </div>
                      )}
                      {step.status === "running" && (
                        <div className="w-3.5 h-3.5 rounded-full bg-primary/20 border border-primary animate-pulse" />
                      )}
                      {step.status === "pending" && (
                        <div className="w-3.5 h-3.5 rounded-full bg-background border border-border" />
                      )}
                      {step.status === "error" && (
                        <div className="w-3.5 h-3.5 rounded-full bg-destructive/20 border border-destructive" />
                      )}
                    </div>

                    <p className={cn(
                      "text-xs leading-relaxed flex-1",
                      step.status === "done"    && "text-muted-foreground",
                      step.status === "running" && "text-foreground font-medium",
                      step.status === "pending" && "text-muted-foreground/35",
                      step.status === "error"   && "text-destructive",
                    )}>
                      {step.message || (step.status === "pending" ? "Queued…" : "—")}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-border shrink-0">
              <p className="text-[10px] text-muted-foreground/50">Keep this window open while LightSpeed AI works</p>
            </div>
          </div>

          {/* Right: live paper stream */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-muted/10 shrink-0 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Live Paper Preview</span>
              {streamedContent && (
                <span className="text-[10px] text-muted-foreground/60 ml-auto">{liveWords.toLocaleString()} words</span>
              )}
            </div>
            <div
              ref={streamRef}
              className="flex-1 p-5 overflow-y-auto"
            >
              {streamedContent ? (
                <div className="text-xs leading-relaxed">
                  {renderMarkdown(streamedContent)}
                  <span className="inline-block w-0.5 h-3.5 bg-primary align-middle ml-0.5 animate-pulse" />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground/30">
                  <Zap size={32} className="text-primary/20" />
                  <p className="text-sm">Paper will appear here as it is written…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS PHASE ─────────────────────────────────────────────────────────

  if (phase === "results" && result) {
    const { stats } = result;
    const targetWords = targetWordCountRef.current;
    const maxWords     = Math.ceil(targetWords * 1.05);
    const gradePassing = stats.grade >= 92;
    const aiPassing    = stats.aiScore === 0;
    const plagPassing  = stats.plagiarismScore <= 8;
    const minWords     = Math.floor(targetWords * 0.95);
    const wordsPassing = stats.bodyWordCount >= minWords && stats.bodyWordCount <= maxWords;
    const citePassing  = result.citations.length >= 5;
    const gradeColor = gradePassing
      ? "border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400"
      : "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400";
    const aiColor  = aiPassing  ? "border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400" : "border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400";
    const plagColor= plagPassing ? "border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400" : "border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400";

    return (
      <div className="h-full flex flex-col bg-background overflow-hidden">
        {/* Stats header */}
        <div className="shrink-0 px-3 sm:px-5 py-2 sm:py-3 border-b border-border bg-card flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 sm:gap-2 flex-wrap overflow-x-auto">
            <StatCard label="Est. Grade" value={`${stats.grade}%`} color={gradeColor} sublabel="Academic quality" passing={gradePassing} />
            <StatCard label="AI Score" value={`${stats.aiScore}%`} color={aiColor} sublabel="AI detection est." passing={aiPassing} />
            <StatCard label="Plagiarism" value={`${stats.plagiarismScore}%`} color={plagColor} sublabel="Originality est." passing={plagPassing} />
            <StatCard label="Body Words" value={stats.bodyWordCount.toLocaleString()} color="border-border bg-muted/30 text-foreground" sublabel={`${minWords.toLocaleString()}–${maxWords.toLocaleString()} words`} passing={wordsPassing} />
            <StatCard label="Citations" value={String(result.citations.length)} color="border-border bg-muted/30 text-foreground" sublabel="Verified sources" passing={citePassing} />
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {saveMsg && (
              <span className={cn("text-xs px-2 py-1 rounded", saveMsg.includes("fail") ? "text-destructive" : "text-green-600 dark:text-green-400")}>
                {saveMsg}
              </span>
            )}
            {resultTab === "paper" && viewMode === "edit" && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
            )}
            <ExportButtons
              getHtml={() => wrapDocHtml(result.title, mdToBodyHtml(result.content) + (result.bibliography ? `<hr class="section-rule"><h2>References</h2><p>${result.bibliography.replace(/\n/g, "<br>")}</p>` : ""))}
              getText={() => `${result.content}\n\nReferences:\n${result.bibliography}`}
              filename={makeLsgFilename("paper", topic || result.title || "PAPER")}
              formats={["docx", "pdf", "copy"]}
            />
            <FeedbackWidget type="paper" subject={subject} className="shrink-0" />
            <button
              onClick={() => { setPhase("config"); setResult(null); setStreamedContent(""); }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
            >
              <RotateCcw size={12} />
              New Paper
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="shrink-0 px-3 sm:px-5 py-2 border-b border-border bg-card flex items-center justify-between overflow-x-auto">
          <div className="flex gap-1 flex-nowrap shrink-0">
            {([
              { id: "paper", label: "Paper", icon: FileText },
              { id: "citations", label: `Citations (${result.citations.length})`, icon: BookMarked },
              { id: "bibliography", label: "Bibliography", icon: ListOrdered },
              { id: "stats", label: "Quality Report", icon: BarChart3 },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setResultTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  resultTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>
          {resultTab === "paper" && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("view")}
                className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs", viewMode === "view" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <Eye size={11} /> View
              </button>
              <button
                onClick={() => setViewMode("edit")}
                className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs", viewMode === "edit" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <Edit3 size={11} /> Edit
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Paper tab ── */}
          {resultTab === "paper" && viewMode === "view" && (
            <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 sm:py-6">
              <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 text-xs text-green-700 dark:text-green-400">
                <CheckCircle size={12} />
                All citations verified from Semantic Scholar & arXiv — no hallucinated references
              </div>
              {renderMarkdown(result.content)}
            </div>
          )}

          {resultTab === "paper" && viewMode === "edit" && (
            <div className="h-full p-4">
              <p className="text-xs text-muted-foreground mb-2 px-1">Edit the paper below. Click Save Changes when done to persist your edits.</p>
              <textarea
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                className="w-full h-[calc(100%-2rem)] p-4 font-mono text-sm bg-muted/20 border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                spellCheck
              />
            </div>
          )}

          {/* ── Citations tab ── */}
          {resultTab === "citations" && (
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-3">
              {result.citations.map((citation) => (
                <div key={citation.id} className="p-4 bg-muted/30 rounded-xl border border-border hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">[{citation.index}]</span>
                      <CheckCircle size={12} className="text-green-500" />
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Verified · {citation.source}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{citation.year}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-snug">{citation.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{citation.authors}</p>
                  {citation.url && (
                    <a href={citation.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                      View paper <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Bibliography tab ── */}
          {resultTab === "bibliography" && (
            <div className="max-w-3xl mx-auto px-6 py-6">
              <div className="text-sm text-foreground leading-relaxed font-mono whitespace-pre-wrap bg-muted/20 rounded-xl p-5 border border-border">
                {result.bibliography}
              </div>
            </div>
          )}

          {/* ── Stats tab ── */}
          {resultTab === "stats" && (
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className={cn("rounded-xl border p-2.5 sm:p-4 text-center", gradeColor)}>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    {gradePassing ? <CheckCircle size={11} /> : <XCircle size={11} className="text-red-400" />}
                    <div className="text-xl sm:text-3xl font-bold leading-none">{stats.grade}%</div>
                  </div>
                  <div className="text-[10px] sm:text-xs mt-1 opacity-70">Estimated Grade</div>
                  <div className="text-[9px] sm:text-[10px] mt-0.5 font-semibold">
                    {stats.grade >= 95 ? "Distinction" : stats.grade >= 92 ? "High Merit" : stats.grade >= 85 ? "Merit" : "Pass"}
                  </div>
                </div>
                <div className={cn("rounded-xl border p-2.5 sm:p-4 text-center", aiColor)}>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    {aiPassing ? <CheckCircle size={11} /> : <XCircle size={11} className="text-red-400" />}
                    <div className="text-xl sm:text-3xl font-bold leading-none">{stats.aiScore}%</div>
                  </div>
                  <div className="text-[10px] sm:text-xs mt-1 opacity-70">AI Detection</div>
                  <div className="text-[9px] sm:text-[10px] mt-0.5 font-semibold">
                    {stats.aiScore === 0 ? "Undetectable" : stats.aiScore <= 5 ? "Excellent" : "Review"}
                  </div>
                </div>
                <div className={cn("rounded-xl border p-2.5 sm:p-4 text-center", plagColor)}>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    {plagPassing ? <CheckCircle size={11} /> : <XCircle size={11} className="text-red-400" />}
                    <div className="text-xl sm:text-3xl font-bold leading-none">{stats.plagiarismScore}%</div>
                  </div>
                  <div className="text-[10px] sm:text-xs mt-1 opacity-70">Plagiarism Risk</div>
                  <div className="text-[9px] sm:text-[10px] mt-0.5 font-semibold">
                    {stats.plagiarismScore <= 4 ? "Original" : stats.plagiarismScore <= 8 ? "Acceptable" : "High Risk"}
                  </div>
                </div>
              </div>

              {/* ── Financial Health Score ── */}
              {financialStatements.trim() && (() => {
                const fhs   = computeFinancialHealthScores(financialStatements);
                const trend = detectTrendData(financialStatements);
                if (!fhs && !trend) return null;
                const cats = fhs ? [
                  { key: "profitability", label: "Profitability", data: fhs.profitability },
                  { key: "liquidity",     label: "Liquidity",     data: fhs.liquidity },
                  { key: "solvency",      label: "Solvency",      data: fhs.solvency },
                  { key: "efficiency",    label: "Efficiency",    data: fhs.efficiency },
                ].filter(c => c.data.computed) : [];
                if (cats.length === 0 && !trend) return null;
                return (
                  <div className="bg-card border border-amber-400/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-amber-500" />
                        <h3 className="text-sm font-semibold">Financial Health Score</h3>
                        {trend && (
                          <span className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-400/30 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                            {trend.years.length}-year trend · {trend.years.join(", ")}
                          </span>
                        )}
                      </div>
                      {fhs && cats.length > 0 && (
                        <div className={cn("px-2.5 py-1 rounded-lg border text-xs font-bold", fhs.overall.color)}>
                          Overall: {fhs.overall.grade}
                        </div>
                      )}
                    </div>
                    {cats.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {cats.map(c => (
                          <div key={c.key} className={cn("rounded-xl border p-3 text-center", c.data.color)}>
                            <div className="text-2xl sm:text-3xl font-bold leading-none mb-1">{c.data.grade}</div>
                            <div className="text-[10px] sm:text-[11px] font-semibold opacity-80">{c.label}</div>
                            {c.data.metrics.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {c.data.metrics.map((m, i) => (
                                  <div key={i} className="text-[8px] sm:text-[9px] opacity-60 leading-tight">{m}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {trend && trend.rows.length > 0 && (
                      <div className="rounded-xl border border-violet-400/20 bg-violet-50/5 dark:bg-violet-900/5 p-3 space-y-1.5">
                        <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-400 flex items-center gap-1.5">
                          <TrendingUp size={10} /> Year-over-Year Trends
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {trend.rows.map((row, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                              <span className="text-muted-foreground">{row.label}</span>
                              <span className={cn(
                                "font-semibold tabular-nums",
                                row.up === true  ? "text-green-600 dark:text-green-400" :
                                row.up === false ? "text-red-500 dark:text-red-400" :
                                "text-muted-foreground"
                              )}>
                                {row.up === true ? "↑ " : row.up === false ? "↓ " : ""}{row.yoy}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[9px] text-muted-foreground/40 pt-0.5">
                          Full trend narrative, CAGR &amp; flag analysis included in the AI output
                        </p>
                      </div>
                    )}
                    {trend && trend.rows.length === 0 && (
                      <div className="rounded-xl border border-violet-400/20 bg-violet-50/5 dark:bg-violet-900/5 px-3 py-2">
                        <p className="text-[10px] text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                          <TrendingUp size={10} />
                          Multi-year data detected ({trend.years.join(", ")}) — AI will compute YoY growth rates, CAGR &amp; flag deteriorating metrics
                        </p>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/50">
                      A = excellent · B = good · C = average · D = below average · F = critical — benchmarked against industry standards
                    </p>
                  </div>
                );
              })()}

              {stats.feedback.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3">AI Quality Feedback</h3>
                  <ul className="space-y-2">
                    {stats.feedback.map((fb, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle size={14} className="text-primary shrink-0 mt-0.5" />
                        {fb}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.content && (
                <>
                  <GrammarPanel text={result.content} />
                  <TonePanel text={result.content} />
                  <ReadabilityPanel text={result.content} />
                  <CitationFromUrl />
                </>
              )}

              <div className="bg-muted/20 border border-border rounded-xl p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Important note on estimates</p>
                These scores are AI-estimated quality indicators, not results from a live plagiarism scanner or certified AI detector. For final submission, run your paper through Turnitin or Copyleaks for authoritative results.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── CONFIG PHASE ──────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6">

          {/* Page header */}
          <div className="text-center space-y-1.5 pt-2">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Zap size={16} className="text-primary" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Write a Paper</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real verified citations · Live generation · Grade &amp; plagiarism estimates
            </p>
          </div>

          {/* Outline nudge */}
          <button
            type="button"
            onClick={() => navigate("/outline")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-indigo-500/25 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors text-left group"
          >
            <ListTree size={16} className="text-indigo-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-indigo-300">Plan first with Outline Generator</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Generate a structured outline → write the full paper in one click</p>
            </div>
            <span className="text-[10px] text-indigo-400/70 group-hover:text-indigo-400 transition-colors shrink-0">Try it →</span>
          </button>

        {fromPlagiarism && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-primary/10 border border-primary/30 rounded-xl text-sm text-primary">
            <div className="flex items-center gap-2">
              <Zap size={14} className="shrink-0" />
              <span>Topic and subject pre-filled from your AI & Plagiarism check — review and add any missing details below</span>
            </div>
            <button onClick={() => setFromPlagiarism(false)} className="shrink-0 hover:opacity-60 transition-opacity text-base leading-none">&times;</button>
          </div>
        )}

        {genError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
            <AlertTriangle size={14} />
            {genError}
          </div>
        )}

        {/* ── File uploads ── */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Assignment Instructions</label>
            <FileUploadZone
              onExtracted={handleBriefExtracted}
              accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
              label="Upload brief / instructions"
              hint="PDF, Word, image — auto-fills form fields"
              compact
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Marking Rubric (optional)</label>
            <FileUploadZone
              onExtracted={handleRubricExtracted}
              accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
              label="Upload grading criteria"
              hint="Used to optimise grade estimation"
              compact
            />
            {rubricText && (
              <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                <CheckCircle size={10} /> Rubric loaded ({rubricText.trim().split(" ").filter(Boolean).length} words)
              </p>
            )}
          </div>
        </div>

        {/* ── Reference / Reading Materials ── */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
            Class Materials &amp; Reading References
            <span className="text-[10px] font-normal ml-1 text-muted-foreground/60">(optional — AI will draw on these when writing)</span>
          </label>
          <FileUploadZone
            onExtracted={handleReferenceExtracted}
            accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
            label="Upload class notes, textbook excerpts, recommended studies…"
            hint="Lecture slides, required readings, journal articles — the AI uses these as source material"
          />
          {referenceText && (
            <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
              <CheckCircle size={10} /> Reference materials loaded ({referenceText.trim().split(" ").filter(Boolean).length.toLocaleString()} words) — AI will draw on these while writing
            </p>
          )}
        </div>

        {/* ── Dataset upload (quantitative paper types only) ── */}
        {DATA_PAPER_TYPES.has(paperType) && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
              Your Dataset
              <span className="text-[10px] font-normal ml-1 text-muted-foreground/60">(optional — for Results/Findings sections)</span>
            </label>
            <FileUploadZone
              onExtracted={handleDatasetUpload}
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              label="Upload your data file (CSV, TSV, Excel)…"
              hint="The AI computes descriptive statistics and writes your Results section from actual data"
            />
            <div className="mt-2">
              <textarea
                value={datasetText}
                onChange={e => {
                  const raw = e.target.value;
                  setDatasetText(raw);
                  const lines = raw.trim().split("\n").filter(Boolean);
                  if (lines.length > 1) {
                    const sep = lines[0].split("\t").length > lines[0].split(",").length ? "\t" : ",";
                    setDatasetPreview(lines.slice(0, 4).map(l => l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""))));
                  } else {
                    setDatasetPreview([]);
                  }
                }}
                rows={3}
                placeholder={"Or paste CSV / tab-separated data directly here…\ne.g.  Group,Score,Age\n      Control,72.3,21\n      Treatment,84.1,23"}
                className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            {datasetPreview.length > 1 && (
              <div className="mt-1.5 rounded-lg border border-green-500/30 bg-green-500/5 p-2 overflow-x-auto">
                <p className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1 mb-1.5 font-medium">
                  <CheckCircle size={10} /> Dataset ready — {datasetText.trim().split("\n").length - 1} rows × {datasetPreview[0]?.length ?? 0} variables
                </p>
                <table className="text-[10px] w-full border-collapse">
                  <thead>
                    <tr>
                      {datasetPreview[0]?.map((h, i) => (
                        <th key={i} className="text-left px-2 py-0.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datasetPreview.slice(1).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-0.5 text-muted-foreground whitespace-nowrap">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* ── Analysis tool selector — shown as soon as dataset text exists ── */}
            {datasetText.trim() && (
              <div className="mt-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block flex items-center gap-1.5">
                  <BarChart3 size={11} />
                  Analysis Tool
                  <span className="text-[10px] font-normal lowercase tracking-normal ml-1 text-muted-foreground/60">— AI will use this tool's exact conventions, function names &amp; output format</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {ANALYSIS_TOOLS.map(tool => (
                    <button
                      key={tool.value}
                      type="button"
                      onClick={() => setAnalysisTool(tool.value)}
                      className={cn(
                        "flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left transition-all",
                        analysisTool === tool.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/30 bg-background"
                      )}
                    >
                      <span className={cn(
                        "shrink-0 text-[9px] font-bold px-1 py-0.5 rounded mt-0.5 leading-none",
                        analysisTool === tool.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {tool.badge}
                      </span>
                      <div className="min-w-0">
                        <p className={cn("text-xs font-medium leading-tight truncate", analysisTool === tool.value ? "text-primary" : "text-foreground")}>
                          {tool.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5 truncate">{tool.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                  Results section will reference {ANALYSIS_TOOLS.find(t => t.value === analysisTool)?.label ?? "your chosen tool"}'s output labels, test names, and citation.
                </p>
              </div>
            )}

            {/* ── Statistical tests multi-select ── */}
            {datasetText.trim() && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <ListOrdered size={11} />
                    Statistical Tests
                    <span className="text-[10px] font-normal lowercase tracking-normal ml-1 text-muted-foreground/60">— select all tests to run (leave blank to let AI decide)</span>
                  </label>
                  {selectedTests.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTests([])}
                      className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      <X size={9} /> Clear all
                    </button>
                  )}
                </div>

                {TEST_CATEGORIES.map(cat => {
                  const tests = STATISTICAL_TESTS.filter(t => t.cat === cat);
                  return (
                    <div key={cat} className="mb-3">
                      <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-1.5">{cat}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tests.map(test => {
                          const active = selectedTests.includes(test.value);
                          return (
                            <button
                              key={test.value}
                              type="button"
                              title={test.hint}
                              onClick={() => setSelectedTests(prev =>
                                active ? prev.filter(v => v !== test.value) : [...prev, test.value]
                              )}
                              className={cn(
                                "group relative px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
                                active
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                              )}
                            >
                              {active && <CheckCircle size={9} className="inline mr-1 mb-0.5" />}
                              {test.label}
                              <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover border border-border rounded text-[10px] text-muted-foreground whitespace-nowrap z-10 shadow-md pointer-events-none">
                                {test.hint}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {selectedTests.length > 0 && (
                  <p className="text-[10px] text-primary mt-1 flex items-center gap-1">
                    <CheckCircle size={10} />
                    {selectedTests.length} test{selectedTests.length > 1 ? "s" : ""} selected — AI will perform and fully report each one in the Results section
                  </p>
                )}
                {selectedTests.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50 mt-1">
                    No tests selected — AI will choose appropriate tests based on your data structure
                  </p>
                )}

                {/* ── Assumptions check toggle ── */}
                <div className="mt-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIncludeAssumptionsCheck(v => !v)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border transition-all text-left",
                      includeAssumptionsCheck ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"
                    )}
                  >
                    <div className={cn("relative w-8 h-4 rounded-full transition-colors shrink-0", includeAssumptionsCheck ? "bg-primary" : "bg-muted")}>
                      <div className={cn("absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform", includeAssumptionsCheck ? "translate-x-4" : "")} />
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-xs font-medium leading-tight", includeAssumptionsCheck ? "text-primary" : "text-foreground")}>
                        Include Assumptions Testing Section
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">
                        {includeAssumptionsCheck
                          ? "AI will write a dedicated subsection verifying normality, homogeneity, multicollinearity, sphericity & more before presenting results"
                          : "Skip assumption checks — results will be presented without formal verification"}
                      </p>
                    </div>
                    {includeAssumptionsCheck && <CheckCircle size={12} className="text-primary shrink-0 ml-auto" />}
                  </button>
                  {includeAssumptionsCheck && selectedTests.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5 pl-1">
                      Checks for: {selectedTests.map(v => {
                        const labels: Record<string, string> = {
                          ttest_ind: "normality + Levene's",
                          ttest_paired: "normality of differences",
                          oneway_anova: "normality + Levene's + post-hoc",
                          twoway_anova: "normality + Levene's + interaction",
                          manova: "Box's M + multivariate normality",
                          repeated_anova: "Mauchly's sphericity + G-G correction",
                          mann_whitney: "distribution shape + independence",
                          wilcoxon: "symmetry of differences",
                          kruskal_wallis: "distribution shape + sample size",
                          friedman: "within-subjects design",
                          pearson: "linearity + bivariate normality + outliers",
                          spearman: "monotonicity + ties",
                          chi_square: "expected frequencies ≥ 5",
                          fishers_exact: "2×2 structure",
                          simple_regression: "linearity + D-W + homoscedasticity + normality of residuals + Cook's D",
                          multiple_regression: "VIF + multicollinearity + all OLS",
                          logistic_regression: "no separation + EPV ratio + VIF",
                          polynomial_regression: "mean-centring + residuals",
                          hierarchical_regression: "F-change per block + all OLS",
                          pca: "KMO + Bartlett's + intercorrelations",
                          factor_analysis: "KMO + Bartlett's + communalities",
                          cluster_kmeans: "standardisation + elbow/silhouette",
                          reliability: "unidimensionality + item scale",
                          mediation: "causal ordering + regression assumptions",
                          moderation: "mean-centring + VIF + power",
                          time_series: "stationarity + Durbin-Watson",
                          survival: "non-informative censoring + proportional hazards",
                          effect_size: "effect size interpretation benchmarks",
                          normality: "Shapiro-Wilk / K-S per variable",
                          descriptives: "descriptive statistics review",
                          confidence_intervals: "95% CI coverage",
                          frequency: "frequency distribution review",
                          point_biserial: "binary × continuous",
                          cramers_v: "chi-square effect size",
                        };
                        return labels[v] ?? v;
                      }).join(" · ")}
                    </p>
                  )}
                  {includeAssumptionsCheck && selectedTests.length === 0 && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5 pl-1">
                      General assumptions guidance — select specific tests above for targeted checks
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Financial Statements (finance/accounting/economics subjects) — paid users only ── */}
        {!!user && FINANCE_SUBJECT_RE.test(subject) && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block flex items-center gap-1.5">
              <TrendingUp size={11} />
              Financial Statements
              <span className="text-[10px] font-normal lowercase tracking-normal ml-1 text-muted-foreground/60">— AI computes all profitability, liquidity, solvency &amp; efficiency ratios</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {FINANCIAL_STATEMENT_TYPES.map(st => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => setFinancialStatementType(st.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                    financialStatementType === st.value
                      ? "border-amber-500/60 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                      : "border-border text-muted-foreground hover:border-amber-400/40 hover:text-foreground"
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>
            <input ref={fsInputRef} type="file" accept=".pdf,.docx,.doc,.txt,.md" className="sr-only" onChange={handleFsFileChange} />
            <button
              type="button"
              disabled={isFsExtracting}
              onClick={() => fsInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-amber-300 dark:border-amber-700 rounded-lg py-2 mb-2 transition-colors hover:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFsExtracting ? <Loader2 size={12} className="animate-spin" /> : <TrendingUp size={12} />}
              {isFsExtracting ? "Extracting…" : "Upload PDF, Word or text file"}
            </button>
            <textarea
              value={financialStatements}
              onChange={e => setFinancialStatements(e.target.value)}
              rows={4}
              placeholder={"Or paste financial statements directly…\n\nSingle year:\n  Revenue:             $2,450,000\n  Net Income:          $416,500\n\nMulti-year (auto YoY + CAGR):\n  FY2023\n  Revenue:             $2,450,000\n  Net Income:          $416,500\n\n  FY2022\n  Revenue:             $2,100,000\n  Net Income:          $315,000"}
              className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            {financialStatements.trim() && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <CheckCircle size={10} /> Financial statements loaded — AI will compute &amp; interpret all key ratios in the analysis
              </p>
            )}
          </div>
        )}

        {/* ── Interpretive Commentary toggle (when dataset or financial statements present) — paid users only ── */}
        {!!user && (datasetText.trim() || financialStatements.trim()) && (
          <div>
            <button
              type="button"
              onClick={() => setIncludeInterpretiveCommentary(v => !v)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border transition-all text-left",
                includeInterpretiveCommentary ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"
              )}
            >
              <div className={cn("relative w-8 h-4 rounded-full transition-colors shrink-0", includeInterpretiveCommentary ? "bg-primary" : "bg-muted")}>
                <div className={cn("absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform", includeInterpretiveCommentary ? "translate-x-4" : "")} />
              </div>
              <div className="min-w-0">
                <p className={cn("text-xs font-medium leading-tight", includeInterpretiveCommentary ? "text-primary" : "text-foreground")}>
                  Include Interpretive Commentary
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">
                  {includeInterpretiveCommentary
                    ? "AI will add plain-English explanations after every statistic and ratio — each number gets a practical interpretation"
                    : "Enable to get plain-English explanations after every statistic, p-value, and financial ratio"}
                </p>
              </div>
              {includeInterpretiveCommentary && <CheckCircle size={12} className="text-primary shrink-0 ml-auto" />}
            </button>
          </div>
        )}

        {/* ── Topic & Subject ── */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Topic *</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g., Impact of social media on mental health"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <SubjectSelect
            value={subject}
            onChange={setSubject}
            label="Subject"
            required
          />
        </div>

        {/* ── Paper type ── */}
        <div>
          <label className="text-sm font-medium mb-2 block">Paper Type</label>
          <div className="flex gap-2 flex-wrap">
            {PAPER_TYPES.map(pt => (
              <button
                key={pt.value}
                type="button"
                onClick={() => setPaperType(pt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                  paperType === pt.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Word count ── */}
        <div>
          <label className="text-sm font-medium mb-2 block">Word Count</label>
          <input
            type="number"
            min={100}
            max={15000}
            value={wordCount}
            onChange={e => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) setWordCount(v);
            }}
            className="w-44 px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Paper will be written to exactly <strong>{wordCount.toLocaleString()}</strong> words (±5%).
          </p>
        </div>

        {/* ── Citation style ── */}
        <div>
          <label className="text-sm font-medium mb-2 block">Citation Style</label>
          {/* Citation confirmation banner */}
          {detectedStyle && !styleConfirmed && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs">
              <BookMarked size={11} className="text-primary" />
              <span>Detected <strong>{detectedStyle.toUpperCase()}</strong> from your instructions.</span>
              <button
                onClick={() => { setCitationStyle(detectedStyle); setStyleConfirmed(true); }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary text-primary-foreground font-medium ml-1"
              >
                <Check size={10} /> Confirm
              </button>
              <button onClick={() => setDetectedStyle(null)} className="text-muted-foreground hover:text-foreground ml-1">
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {CITATION_STYLES.map(style => (
              <button
                key={style}
                type="button"
                onClick={() => { setCitationStyle(style); setStyleConfirmed(true); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-all",
                  citationStyle === style ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        {/* ── Spacing, Sources, Language ── */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium mb-2 block">Spacing</label>
            <div className="flex gap-2">
              {SPACING_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSpacing(opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex-1",
                    spacing === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Min. Sources</label>
            <input
              type="number"
              min={0}
              max={100}
              value={numSources}
              onChange={e => {
                const v = e.target.value;
                setNumSources(v === "" ? "" : parseInt(v, 10));
              }}
              placeholder="Auto"
              className="w-full px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Language</label>
            <div className="flex gap-2">
              {LANGUAGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLanguage(opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex-1",
                    language === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Academic level ── */}
        <div>
          <label className="text-sm font-medium mb-2 flex items-center gap-1.5 block">
            <GraduationCap size={14} />
            Academic Level
          </label>
          <div className="flex gap-2 flex-wrap">
            {ACADEMIC_LEVELS.map(lvl => (
              <button
                key={lvl.value}
                type="button"
                onClick={() => saveAcademicLevel(lvl.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                  academicLevel === lvl.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── STEM toggle ── */}
        <button
          type="button"
          onClick={() => setIsStem(!isStem)}
          className={cn(
            "flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all text-left",
            isStem ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
          )}
        >
          <div className={cn("relative w-9 h-5 rounded-full transition-colors", isStem ? "bg-primary" : "bg-muted")}>
            <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", isStem ? "translate-x-4" : "")} />
          </div>
          <FlaskConical size={15} className={isStem ? "text-primary" : "text-muted-foreground"} />
          <div>
            <p className="text-sm font-medium">STEM Paper</p>
            <p className="text-[11px] text-muted-foreground">Activates equations, derivations & technical analysis module</p>
          </div>
        </button>

        {/* ── Additional instructions ── */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Additional Instructions</label>
          <textarea
            value={additionalInstructions}
            onChange={e => setAdditionalInstructions(e.target.value)}
            rows={3}
            placeholder="Specific requirements, key arguments to cover, formatting preferences…"
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* ── Generate button ── */}
        <div className="pt-2">
          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || !subject.trim()}
            className="w-full flex items-center justify-center gap-2.5 bg-primary text-primary-foreground px-4 py-4 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <Zap size={18} className="shrink-0" />
            Generate Paper with LightSpeed AI
          </button>
          {(!topic.trim() || !subject.trim()) && (
            <p className="text-center text-xs text-muted-foreground mt-2">Enter a topic and subject to continue</p>
          )}
          <p className="text-center text-[11px] text-muted-foreground/50 mt-1.5">
            or{" "}
            <button type="button" onClick={() => openBuy("paper")} className="text-orange-400 hover:text-orange-300 transition-colors font-medium">
              buy a single paper →
            </button>
          </p>
        </div>
        </div>
      </div>
      <PaywallFlow
        pickerState={pickerState}
        checkoutState={checkoutState}
        plan={plan}
        closePicker={closePicker}
        closeCheckout={closeCheckout}
        chooseSubscription={chooseSubscription}
        choosePayg={choosePayg}
      />
    </div>
  );
}
