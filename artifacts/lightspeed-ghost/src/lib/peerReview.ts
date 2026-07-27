// ── Peer Review engine — 100% no-LLM, fully client-side ───────────────────────
// A professor-style "peer review before you submit" that never calls an AI model.
// Everything here is deterministic heuristics over the text: a rubric per paper
// type, the academic rules for that type, a three-professor validation panel
// (systems that *imitate* the rigour of MIT / Harvard / Yale reviewers — no real
// people), a grade approximation calibrated to academic level, concrete gaps /
// mistakes / improvements, weak-spot highlights, and a set of probable
// examiner/defence questions scaled to the length of the material.

import {
  analyzeReadability,
  checkGrammar,
  analyzeAiLikelihood,
} from "@/lib/textAnalysis";
import type { HighlightSegment } from "@/lib/scanReport";

// ── Options (mirror the writer's controls) ────────────────────────────────────
export const PAPER_TYPES = [
  "Research Paper", "Essay", "Argumentative Essay", "Persuasive Essay",
  "Narrative Essay", "Descriptive Essay", "Expository Essay", "Admission Essay",
  "Scholarship Essay", "Thesis", "Dissertation", "Lit. Review",
  "Annotated Bibliography", "Research Proposal", "Grant Proposal",
  "General Proposal", "Report", "Lab Report", "Case Study", "Term Paper",
  "Coursework", "Capstone Project", "Critical Analysis", "Article Review",
  "Book Review", "Film/Movie Review", "Reflective Essay", "Personal Statement",
  "Speech", "Presentation", "Position Paper", "Policy Brief", "White Paper",
  "Business Plan", "Financial Analysis",
] as const;
export type PaperType = (typeof PAPER_TYPES)[number];

export const CITATION_STYLES = [
  "apa", "mla", "chicago", "harvard", "ieee", "turabian", "vancouver", "ama",
  "asa", "bluebook", "oscola",
] as const;
export type CitationStyle = (typeof CITATION_STYLES)[number];

export const SPACINGS = ["Double", "1.5", "Single"] as const;
export const LANGUAGES = ["US English", "UK English", "Australian English"] as const;
export const ACADEMIC_LEVELS = [
  "High School", "UG Year 1–2", "UG Year 3–4", "Honours", "Masters", "PhD",
] as const;
export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number];

export interface PeerReviewOptions {
  paperType: PaperType;
  citationStyle: CitationStyle;
  spacing: (typeof SPACINGS)[number];
  minSources: number | "auto";
  language: (typeof LANGUAGES)[number];
  level: AcademicLevel;
}

// ── Rubric families ───────────────────────────────────────────────────────────
type Family =
  | "essay" | "argument" | "narrative" | "admissions" | "research" | "thesis"
  | "litreview" | "annotated" | "proposal" | "report" | "lab" | "casestudy"
  | "review" | "speech" | "policy" | "business" | "finance";

interface Section { name: string; keywords: string[]; required: boolean; }
interface Criterion { key: string; label: string; weight: number; }

interface Rubric {
  family: Family;
  summary: string;
  sections: Section[];
  criteria: Criterion[];
  rules: string[];
  minSources: number;      // recommended sources at UG level
  wantsCitations: boolean;
  firstPerson: "expected" | "allowed" | "avoid";
}

const TYPE_FAMILY: Record<PaperType, Family> = {
  "Research Paper": "research", "Term Paper": "research", "Coursework": "research",
  "Capstone Project": "research",
  "Essay": "essay", "Expository Essay": "essay", "Descriptive Essay": "essay",
  "Critical Analysis": "argument", "Argumentative Essay": "argument",
  "Persuasive Essay": "argument", "Position Paper": "policy",
  "Narrative Essay": "narrative", "Reflective Essay": "narrative",
  "Admission Essay": "admissions", "Scholarship Essay": "admissions",
  "Personal Statement": "admissions",
  "Thesis": "thesis", "Dissertation": "thesis",
  "Lit. Review": "litreview", "Annotated Bibliography": "annotated",
  "Research Proposal": "proposal", "Grant Proposal": "proposal",
  "General Proposal": "proposal",
  "Report": "report", "Lab Report": "lab", "Case Study": "casestudy",
  "Article Review": "review", "Book Review": "review", "Film/Movie Review": "review",
  "Speech": "speech", "Presentation": "speech",
  "Policy Brief": "policy", "White Paper": "policy",
  "Business Plan": "business", "Financial Analysis": "finance",
};

// Base academic-integrity + writing rules that apply to almost everything.
const COMMON_RULES = [
  "Open with a clear, specific thesis or purpose statement.",
  "Every major claim is supported by evidence and a citation.",
  "Paragraphs follow one idea each, with topic sentences and transitions.",
  "Sources are cited in-text and listed in a matching reference section.",
  "No unsupported generalisations, clichés, or filler.",
];

function sec(name: string, keywords: string[], required = true): Section {
  return { name, keywords, required };
}

const RUBRICS: Record<Family, Rubric> = {
  research: {
    family: "research",
    summary: "An evidence-led paper that poses a question and answers it with cited research.",
    sections: [
      sec("Introduction & thesis", ["introduction", "this paper", "this study", "aims to", "argues", "thesis"]),
      sec("Literature / background", ["literature", "prior", "previous", "background", "research has", "studies"]),
      sec("Methods / approach", ["method", "approach", "data", "sample", "procedure", "analysis"], false),
      sec("Findings / discussion", ["results", "findings", "discussion", "shows", "demonstrates", "evidence"]),
      sec("Conclusion", ["conclusion", "in conclusion", "to conclude", "in summary"]),
      sec("References", ["references", "bibliography", "works cited", "doi", "et al", "(19", "(20"]),
    ],
    criteria: [
      { key: "thesis", label: "Thesis & focus", weight: 0.18 },
      { key: "evidence", label: "Evidence & citations", weight: 0.24 },
      { key: "analysis", label: "Depth of analysis", weight: 0.20 },
      { key: "structure", label: "Structure & coherence", weight: 0.16 },
      { key: "mechanics", label: "Grammar & style", weight: 0.12 },
      { key: "originality", label: "Original voice", weight: 0.10 },
    ],
    rules: [
      ...COMMON_RULES,
      "State the research question and scope in the introduction.",
      "Situate the work against existing literature before presenting your own analysis.",
      "Distinguish your findings/interpretation from cited sources.",
      "Discuss limitations and implications in the conclusion.",
    ],
    minSources: 6, wantsCitations: true, firstPerson: "avoid",
  },
  essay: {
    family: "essay",
    summary: "A focused academic essay that develops one central idea across body paragraphs.",
    sections: [
      sec("Introduction & thesis", ["introduction", "this essay", "argues", "thesis", "will discuss"]),
      sec("Body paragraphs", ["firstly", "secondly", "furthermore", "for example", "however", "in addition"]),
      sec("Conclusion", ["conclusion", "in conclusion", "to conclude", "overall"]),
      sec("References", ["references", "works cited", "bibliography", "et al", "(20", "(19"], false),
    ],
    criteria: [
      { key: "thesis", label: "Thesis & focus", weight: 0.22 },
      { key: "evidence", label: "Support & examples", weight: 0.18 },
      { key: "analysis", label: "Development of ideas", weight: 0.22 },
      { key: "structure", label: "Structure & flow", weight: 0.18 },
      { key: "mechanics", label: "Grammar & style", weight: 0.14 },
      { key: "originality", label: "Original voice", weight: 0.06 },
    ],
    rules: [
      ...COMMON_RULES,
      "Put the thesis at the end of the introduction.",
      "Give each body paragraph a single controlling idea.",
      "End with a conclusion that synthesises rather than repeats.",
    ],
    minSources: 3, wantsCitations: true, firstPerson: "avoid",
  },
  argument: {
    family: "argument",
    summary: "A persuasive/argumentative piece that defends a position and answers objections.",
    sections: [
      sec("Claim / thesis", ["argue", "claim", "should", "must", "contend", "position"]),
      sec("Reasons & evidence", ["because", "evidence", "for example", "data", "study", "shows"]),
      sec("Counterargument & rebuttal", ["however", "critics", "opponents", "although", "some argue", "on the other hand", "nevertheless"]),
      sec("Conclusion / call to action", ["conclusion", "therefore", "in conclusion", "should"]),
      sec("References", ["references", "works cited", "et al", "(20", "(19"], false),
    ],
    criteria: [
      { key: "thesis", label: "Clarity of claim", weight: 0.20 },
      { key: "evidence", label: "Evidence & reasoning", weight: 0.22 },
      { key: "counter", label: "Counter-argument handled", weight: 0.18 },
      { key: "analysis", label: "Logical development", weight: 0.16 },
      { key: "structure", label: "Structure & flow", weight: 0.14 },
      { key: "mechanics", label: "Grammar & style", weight: 0.10 },
    ],
    rules: [
      ...COMMON_RULES,
      "State a debatable, specific claim — not a fact everyone accepts.",
      "Address at least one strong counter-argument and rebut it fairly.",
      "Use logic (no fallacies): correlation is not causation; avoid straw men.",
    ],
    minSources: 4, wantsCitations: true, firstPerson: "allowed",
  },
  narrative: {
    family: "narrative",
    summary: "A reflective/narrative piece driven by a personal experience and insight.",
    sections: [
      sec("Opening / hook", ["i", "when", "one", "remember", "moment"]),
      sec("Experience / arc", ["then", "after", "later", "realised", "realized", "felt", "because"]),
      sec("Reflection / meaning", ["learned", "taught", "understand", "now i", "growth", "changed", "reflect"]),
      sec("Conclusion", ["conclusion", "looking back", "in the end", "today"]),
    ],
    criteria: [
      { key: "voice", label: "Authentic voice", weight: 0.24 },
      { key: "arc", label: "Narrative arc", weight: 0.22 },
      { key: "reflection", label: "Reflection & insight", weight: 0.24 },
      { key: "detail", label: "Concrete detail", weight: 0.16 },
      { key: "mechanics", label: "Grammar & style", weight: 0.14 },
    ],
    rules: [
      "Open with a specific scene or moment, not a generality.",
      "Show, don't tell — use concrete sensory detail.",
      "End with genuine reflection on what changed or what it meant.",
      "First person is expected; keep it honest and specific.",
    ],
    minSources: 0, wantsCitations: false, firstPerson: "expected",
  },
  admissions: {
    family: "admissions",
    summary: "A personal/admissions statement showing fit, motivation and trajectory.",
    sections: [
      sec("Hook / motivation", ["i", "when", "why", "always", "passion", "drawn"]),
      sec("Evidence of fit", ["experience", "project", "research", "led", "built", "volunteered", "achieved"]),
      sec("Goals / future", ["goal", "aspire", "hope to", "future", "career", "plan to", "next"]),
      sec("Why this program", ["your program", "this university", "this school", "because", "specifically"]),
    ],
    criteria: [
      { key: "voice", label: "Authentic voice", weight: 0.24 },
      { key: "fit", label: "Evidence of fit", weight: 0.22 },
      { key: "goals", label: "Clear goals", weight: 0.20 },
      { key: "specificity", label: "Specific detail", weight: 0.20 },
      { key: "mechanics", label: "Grammar & style", weight: 0.14 },
    ],
    rules: [
      "Answer the prompt directly and specifically.",
      "Show, with concrete examples, don't just assert qualities.",
      "Tie your story to why this program/opportunity specifically.",
      "Avoid clichés ('I want to help people') without evidence.",
    ],
    minSources: 0, wantsCitations: false, firstPerson: "expected",
  },
  thesis: {
    family: "thesis",
    summary: "A long-form research thesis/dissertation with a full academic apparatus.",
    sections: [
      sec("Abstract", ["abstract"]),
      sec("Introduction & research question", ["introduction", "research question", "aims", "objectives", "hypothesis"]),
      sec("Literature review", ["literature review", "prior work", "previous studies", "theoretical framework"]),
      sec("Methodology", ["methodology", "method", "data collection", "sample", "participants", "procedure"]),
      sec("Results", ["results", "findings", "table", "figure", "analysis"]),
      sec("Discussion", ["discussion", "implications", "interpretation", "suggests"]),
      sec("Conclusion & limitations", ["conclusion", "limitations", "future research", "further study"]),
      sec("References", ["references", "bibliography", "et al", "doi", "(20", "(19"]),
    ],
    criteria: [
      { key: "thesis", label: "Research question & rigour", weight: 0.18 },
      { key: "evidence", label: "Evidence & citations", weight: 0.20 },
      { key: "method", label: "Methodology soundness", weight: 0.18 },
      { key: "analysis", label: "Depth of analysis", weight: 0.18 },
      { key: "structure", label: "Structure & apparatus", weight: 0.14 },
      { key: "mechanics", label: "Academic style", weight: 0.12 },
    ],
    rules: [
      ...COMMON_RULES,
      "Include an abstract, methodology, results, discussion and limitations.",
      "State the research question, hypotheses and contribution explicitly.",
      "Justify methodological choices and address validity/reliability.",
      "Reference recent, peer-reviewed sources; no encyclopaedias.",
    ],
    minSources: 30, wantsCitations: true, firstPerson: "avoid",
  },
  litreview: {
    family: "litreview",
    summary: "A synthesis of existing scholarship organised by theme, not by source.",
    sections: [
      sec("Scope & question", ["review", "this paper", "scope", "aims", "examines"]),
      sec("Thematic synthesis", ["theme", "similarly", "in contrast", "consistent with", "whereas", "collectively"]),
      sec("Gap identification", ["gap", "however", "little research", "remains unclear", "under-explored", "future"]),
      sec("References", ["references", "bibliography", "et al", "doi", "(20", "(19"]),
    ],
    criteria: [
      { key: "synthesis", label: "Synthesis (not summary)", weight: 0.28 },
      { key: "evidence", label: "Breadth of sources", weight: 0.22 },
      { key: "gap", label: "Gap identification", weight: 0.18 },
      { key: "structure", label: "Thematic organisation", weight: 0.18 },
      { key: "mechanics", label: "Academic style", weight: 0.14 },
    ],
    rules: [
      ...COMMON_RULES,
      "Organise by theme or debate, never as a list of source summaries.",
      "Compare and contrast findings across studies.",
      "Identify the gap your review exposes.",
    ],
    minSources: 15, wantsCitations: true, firstPerson: "avoid",
  },
  annotated: {
    family: "annotated",
    summary: "A list of sources, each with a citation plus a summary + evaluation annotation.",
    sections: [
      sec("Citations", ["et al", "doi", "(20", "(19", "retrieved", "pp."]),
      sec("Summaries", ["argues", "examines", "presents", "the author", "this source", "study"]),
      sec("Evaluations", ["useful", "limitation", "relevant", "strength", "weakness", "credible", "bias"]),
    ],
    criteria: [
      { key: "citations", label: "Citation correctness", weight: 0.28 },
      { key: "summary", label: "Summary quality", weight: 0.26 },
      { key: "evaluation", label: "Critical evaluation", weight: 0.28 },
      { key: "mechanics", label: "Consistency & style", weight: 0.18 },
    ],
    rules: [
      "Each entry starts with a full, correctly formatted citation.",
      "Summarise the source's argument in your own words.",
      "Evaluate credibility, relevance and limitations — not just summary.",
      "Keep formatting consistent across every entry.",
    ],
    minSources: 8, wantsCitations: true, firstPerson: "avoid",
  },
  proposal: {
    family: "proposal",
    summary: "A forward-looking proposal that justifies a project and its plan.",
    sections: [
      sec("Problem & rationale", ["problem", "need", "rationale", "significance", "gap", "importance"]),
      sec("Objectives / aims", ["objective", "aim", "goal", "propose", "hypothesis"]),
      sec("Methods / plan", ["method", "plan", "approach", "timeline", "budget", "activities", "will"]),
      sec("Expected outcomes", ["expected", "outcome", "impact", "deliverable", "results"]),
      sec("References", ["references", "et al", "doi", "(20", "(19"], false),
    ],
    criteria: [
      { key: "problem", label: "Problem & significance", weight: 0.22 },
      { key: "objectives", label: "Clear objectives", weight: 0.18 },
      { key: "method", label: "Feasible plan/method", weight: 0.22 },
      { key: "outcomes", label: "Outcomes & impact", weight: 0.18 },
      { key: "structure", label: "Structure & clarity", weight: 0.12 },
      { key: "mechanics", label: "Grammar & style", weight: 0.08 },
    ],
    rules: [
      ...COMMON_RULES,
      "State the problem and why it matters before the solution.",
      "Give measurable objectives and a realistic plan/timeline.",
      "Explain expected outcomes and how success is evaluated.",
    ],
    minSources: 5, wantsCitations: true, firstPerson: "allowed",
  },
  report: {
    family: "report",
    summary: "A structured report with clear sections and findings.",
    sections: [
      sec("Executive summary / intro", ["summary", "introduction", "purpose", "overview", "this report"]),
      sec("Body / findings", ["findings", "results", "analysis", "section", "figure", "table"]),
      sec("Recommendations", ["recommend", "should", "suggest", "propose", "action"]),
      sec("Conclusion", ["conclusion", "in summary", "to conclude"]),
    ],
    criteria: [
      { key: "structure", label: "Structure & sections", weight: 0.24 },
      { key: "evidence", label: "Data & evidence", weight: 0.22 },
      { key: "analysis", label: "Analysis & insight", weight: 0.20 },
      { key: "recommendations", label: "Actionable recommendations", weight: 0.18 },
      { key: "mechanics", label: "Clarity & style", weight: 0.16 },
    ],
    rules: [
      "Use clear headed sections and, if long, an executive summary.",
      "Present evidence in figures/tables where useful and reference them.",
      "End with specific, actionable recommendations.",
      "Write concisely in a professional register.",
    ],
    minSources: 3, wantsCitations: true, firstPerson: "avoid",
  },
  lab: {
    family: "lab",
    summary: "A scientific lab report following the IMRaD structure.",
    sections: [
      sec("Aim / hypothesis", ["aim", "hypothesis", "objective", "purpose", "predict"]),
      sec("Method", ["method", "materials", "procedure", "apparatus", "measured"]),
      sec("Results", ["results", "table", "figure", "data", "observed", "recorded"]),
      sec("Discussion / analysis", ["discussion", "because", "suggests", "error", "uncertainty", "compared"]),
      sec("Conclusion", ["conclusion", "in conclusion", "confirms", "rejects"]),
    ],
    criteria: [
      { key: "method", label: "Method reproducibility", weight: 0.22 },
      { key: "results", label: "Results & data", weight: 0.22 },
      { key: "analysis", label: "Analysis & error", weight: 0.22 },
      { key: "structure", label: "IMRaD structure", weight: 0.18 },
      { key: "mechanics", label: "Precision & style", weight: 0.16 },
    ],
    rules: [
      "Follow IMRaD: Aim, Method, Results, Discussion, Conclusion.",
      "Write the method so it can be reproduced exactly.",
      "Report data with units and uncertainty; use tables/figures.",
      "Discuss sources of error and whether the hypothesis held.",
    ],
    minSources: 2, wantsCitations: true, firstPerson: "avoid",
  },
  casestudy: {
    family: "casestudy",
    summary: "A case study that analyses a specific instance against theory.",
    sections: [
      sec("Background / context", ["background", "context", "case", "company", "patient", "situation"]),
      sec("Problem / question", ["problem", "issue", "challenge", "question", "faced"]),
      sec("Analysis", ["analysis", "because", "framework", "theory", "evidence", "suggests"]),
      sec("Recommendations / outcome", ["recommend", "solution", "outcome", "should", "result"]),
    ],
    criteria: [
      { key: "context", label: "Context & framing", weight: 0.18 },
      { key: "analysis", label: "Analytical depth", weight: 0.26 },
      { key: "evidence", label: "Evidence & theory", weight: 0.20 },
      { key: "recommendations", label: "Recommendations", weight: 0.20 },
      { key: "mechanics", label: "Structure & style", weight: 0.16 },
    ],
    rules: [
      ...COMMON_RULES,
      "Ground the analysis in an explicit framework or theory.",
      "Link recommendations directly to your analysis and evidence.",
    ],
    minSources: 4, wantsCitations: true, firstPerson: "avoid",
  },
  review: {
    family: "review",
    summary: "A critical review that summarises and then evaluates a work.",
    sections: [
      sec("Summary of the work", ["the author", "the book", "the film", "the article", "summarises", "presents", "plot"]),
      sec("Critical evaluation", ["however", "strength", "weakness", "effective", "fails", "succeeds", "convincing"]),
      sec("Judgement / recommendation", ["overall", "recommend", "worth", "conclusion", "verdict"]),
    ],
    criteria: [
      { key: "summary", label: "Fair summary", weight: 0.22 },
      { key: "evaluation", label: "Critical evaluation", weight: 0.30 },
      { key: "evidence", label: "Support from the work", weight: 0.20 },
      { key: "structure", label: "Structure & flow", weight: 0.14 },
      { key: "mechanics", label: "Grammar & style", weight: 0.14 },
    ],
    rules: [
      "Summarise fairly before evaluating — don't just retell the plot.",
      "Judge against clear criteria and support with specifics from the work.",
      "Reach an explicit overall judgement.",
    ],
    minSources: 1, wantsCitations: true, firstPerson: "allowed",
  },
  speech: {
    family: "speech",
    summary: "A spoken piece written for the ear, with a clear arc and delivery cues.",
    sections: [
      sec("Hook / opening", ["imagine", "today", "let me", "have you", "picture", "story"]),
      sec("Main points", ["first", "second", "next", "point", "reason", "importantly"]),
      sec("Call to action / close", ["so", "today", "let us", "call", "remember", "in closing", "thank you"]),
    ],
    criteria: [
      { key: "hook", label: "Opening & engagement", weight: 0.22 },
      { key: "structure", label: "Clear arc / signposting", weight: 0.22 },
      { key: "delivery", label: "Spoken rhythm", weight: 0.22 },
      { key: "impact", label: "Memorable close", weight: 0.18 },
      { key: "mechanics", label: "Clarity", weight: 0.16 },
    ],
    rules: [
      "Write for the ear: short sentences, repetition, signposting.",
      "Open with a hook and close with a clear call to action.",
      "Signpost the main points so listeners can follow.",
    ],
    minSources: 0, wantsCitations: false, firstPerson: "expected",
  },
  policy: {
    family: "policy",
    summary: "A policy/position document that recommends action on evidence.",
    sections: [
      sec("Issue & context", ["issue", "problem", "context", "background", "challenge"]),
      sec("Position / options", ["recommend", "position", "option", "propose", "should", "policy"]),
      sec("Evidence & analysis", ["evidence", "data", "study", "because", "cost", "impact"]),
      sec("Recommendation", ["recommend", "therefore", "call", "action", "must"]),
      sec("References", ["references", "et al", "(20", "(19"], false),
    ],
    criteria: [
      { key: "issue", label: "Issue framing", weight: 0.18 },
      { key: "position", label: "Clear position", weight: 0.20 },
      { key: "evidence", label: "Evidence & analysis", weight: 0.24 },
      { key: "recommendations", label: "Feasible recommendation", weight: 0.20 },
      { key: "mechanics", label: "Concision & style", weight: 0.18 },
    ],
    rules: [
      ...COMMON_RULES,
      "Lead with the issue and your recommended position.",
      "Weigh options against evidence, cost and feasibility.",
      "Make the recommendation specific and actionable.",
    ],
    minSources: 4, wantsCitations: true, firstPerson: "avoid",
  },
  business: {
    family: "business",
    summary: "A business plan covering opportunity, model, market and financials.",
    sections: [
      sec("Executive summary", ["executive summary", "overview", "we", "our company", "mission"]),
      sec("Market & opportunity", ["market", "customer", "opportunity", "competitor", "demand", "segment"]),
      sec("Business model", ["revenue", "model", "pricing", "product", "service", "strategy"]),
      sec("Financials", ["revenue", "cost", "profit", "forecast", "projection", "margin", "$"]),
      sec("Plan / milestones", ["milestone", "timeline", "plan", "roadmap", "goal"]),
    ],
    criteria: [
      { key: "opportunity", label: "Opportunity & market", weight: 0.22 },
      { key: "model", label: "Business model clarity", weight: 0.20 },
      { key: "financials", label: "Financial realism", weight: 0.22 },
      { key: "structure", label: "Structure & completeness", weight: 0.18 },
      { key: "mechanics", label: "Professional style", weight: 0.18 },
    ],
    rules: [
      "Open with a tight executive summary.",
      "Size the market and name the competition honestly.",
      "Show a credible revenue model and financial projections.",
      "Include milestones and the funding/plan ask.",
    ],
    minSources: 2, wantsCitations: false, firstPerson: "allowed",
  },
  finance: {
    family: "finance",
    summary: "A financial analysis grounded in figures, ratios and interpretation.",
    sections: [
      sec("Overview / objective", ["objective", "overview", "analysis of", "purpose", "this report"]),
      sec("Data & figures", ["revenue", "ratio", "margin", "cash flow", "balance", "$", "%", "table"]),
      sec("Analysis & interpretation", ["because", "indicates", "suggests", "trend", "compared", "growth", "risk"]),
      sec("Conclusion / recommendation", ["conclusion", "recommend", "should", "overall", "outlook"]),
    ],
    criteria: [
      { key: "data", label: "Data & figures", weight: 0.24 },
      { key: "analysis", label: "Interpretation & ratios", weight: 0.26 },
      { key: "evidence", label: "Support & sources", weight: 0.16 },
      { key: "recommendations", label: "Recommendation", weight: 0.18 },
      { key: "mechanics", label: "Precision & style", weight: 0.16 },
    ],
    rules: [
      "Anchor every claim in specific figures, ratios or trends.",
      "Interpret the numbers — don't just report them.",
      "State assumptions and the basis of any projection.",
      "Close with a clear, evidence-backed recommendation.",
    ],
    minSources: 2, wantsCitations: true, firstPerson: "avoid",
  },
};

export function getRubric(paperType: PaperType): Rubric {
  return RUBRICS[TYPE_FAMILY[paperType]];
}

// ── Professors (imitated review lenses — not real people) ─────────────────────
export interface Professor {
  id: "mit" | "harvard" | "yale";
  name: string;
  school: string;
  focus: string;
  // criterion keys this professor weights most heavily
  emphasis: string[];
}
export const PROFESSORS: Professor[] = [
  { id: "mit", name: "Reviewer M (MIT-style)", school: "MIT", focus: "rigour, method, evidence and quantitative reasoning",
    emphasis: ["evidence", "method", "results", "data", "analysis", "citations", "financials"] },
  { id: "harvard", name: "Reviewer H (Harvard-style)", school: "Harvard", focus: "argument, critical thinking and clarity",
    emphasis: ["thesis", "analysis", "counter", "evaluation", "position", "structure", "recommendations"] },
  { id: "yale", name: "Reviewer Y (Yale-style)", school: "Yale", focus: "originality, depth, structure and voice",
    emphasis: ["originality", "voice", "synthesis", "reflection", "arc", "hook", "specificity", "summary"] },
];

// ── Result shape ──────────────────────────────────────────────────────────────
export interface CriterionScore { key: string; label: string; weight: number; score: number; note: string; }
export interface ProfessorReview { id: string; name: string; school: string; focus: string; score: number; verdict: string; comments: string[]; }
export interface PeerReviewResult {
  options: PeerReviewOptions;
  rubricSummary: string;
  grade: { percent: number; letter: string; band: string };
  professors: ProfessorReview[];
  criteria: CriterionScore[];
  presentSections: string[];
  missingSections: string[];
  strengths: string[];
  gaps: string[];
  mistakes: string[];
  improvements: string[];
  questions: string[];
  rules: string[];
  highlights: HighlightSegment[];
  metrics: { words: number; sentences: number; paragraphs: number; citations: number; avgSentence: number; readingEase: number };
  citationStyleMatch: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z"'])/).map((s) => s.trim()).filter((s) => s.length > 3);
}
function countCitations(text: string): number {
  let n = 0;
  n += (text.match(/\([A-Z][A-Za-z.'-]+(?:\s(?:et al\.?|and|&)\s?[A-Za-z.'-]*)?,?\s*(?:19|20)\d{2}[a-z]?\)/g) || []).length; // (Author, 2020)
  n += (text.match(/\[\d{1,3}\]/g) || []).length; // [1]
  n += (text.match(/\bet al\.?/gi) || []).length;
  n += (text.match(/\bdoi:\s*\S+/gi) || []).length;
  n += (text.match(/https?:\/\/\S+/g) || []).length;
  return n;
}
function detectCitationStyle(text: string): { style: CitationStyle | null } {
  if (/\[\d{1,3}\]/.test(text)) return { style: "ieee" };
  if (/\([A-Z][A-Za-z.'-]+,?\s*(?:19|20)\d{2}\)/.test(text)) return { style: "apa" };
  if (/\([A-Z][A-Za-z.'-]+\s\d{1,4}\)/.test(text)) return { style: "mla" };
  return { style: null };
}
function has(textLower: string, keywords: string[]): number {
  let hits = 0;
  for (const k of keywords) if (textLower.includes(k)) hits++;
  return hits;
}
function clamp(n: number, lo = 0, hi = 100): number { return Math.max(lo, Math.min(hi, Math.round(n))); }

const LEVEL_FACTOR: Record<AcademicLevel, number> = {
  "High School": 1.08, "UG Year 1–2": 1.0, "UG Year 3–4": 0.95,
  "Honours": 0.9, "Masters": 0.86, "PhD": 0.8,
};
const LEVEL_MIN_SOURCE_FACTOR: Record<AcademicLevel, number> = {
  "High School": 0.5, "UG Year 1–2": 0.8, "UG Year 3–4": 1.0,
  "Honours": 1.3, "Masters": 1.7, "PhD": 2.4,
};

function letterFor(percent: number): { letter: string; band: string } {
  if (percent >= 93) return { letter: "A", band: "First Class / Distinction" };
  if (percent >= 90) return { letter: "A−", band: "First Class / Distinction" };
  if (percent >= 87) return { letter: "B+", band: "Upper Second / Merit" };
  if (percent >= 83) return { letter: "B", band: "Upper Second / Merit" };
  if (percent >= 80) return { letter: "B−", band: "Upper Second / Merit" };
  if (percent >= 77) return { letter: "C+", band: "Lower Second / Pass" };
  if (percent >= 73) return { letter: "C", band: "Lower Second / Pass" };
  if (percent >= 70) return { letter: "C−", band: "Lower Second / Pass" };
  if (percent >= 60) return { letter: "D", band: "Third / Marginal pass" };
  return { letter: "F", band: "Fail / Needs major revision" };
}

// ── The engine ────────────────────────────────────────────────────────────────
export function runPeerReview(text: string, options: PeerReviewOptions): PeerReviewResult {
  const rubric = getRubric(options.paperType);
  const lower = text.toLowerCase();
  const sentences = splitSentences(text);
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean).length;
  const readability = analyzeReadability(text);
  const grammar = checkGrammar(text);
  const aiLike = analyzeAiLikelihood(text);
  const citations = countCitations(text);
  const detected = detectCitationStyle(text);
  const requiredSources = Math.round(
    (options.minSources === "auto" ? rubric.minSources : options.minSources) *
      LEVEL_MIN_SOURCE_FACTOR[options.level],
  );

  // Section presence
  const presentSections: string[] = [];
  const missingSections: string[] = [];
  for (const s of rubric.sections) {
    const hits = has(lower, s.keywords);
    if (hits >= (s.keywords.length > 4 ? 2 : 1)) presentSections.push(s.name);
    else if (s.required) missingSections.push(s.name);
  }
  const sectionCoverage = rubric.sections.filter((s) => s.required).length
    ? presentSections.length / rubric.sections.filter((s) => s.required).length
    : 1;

  // Analytical / transition signal
  const analyticalMarkers = ["because", "therefore", "however", "thus", "consequently", "moreover", "furthermore", "in contrast", "as a result", "this suggests", "which means", "for instance", "for example", "evidence", "demonstrates", "indicates"];
  const analyticalHits = analyticalMarkers.reduce((n, m) => n + (lower.split(m).length - 1), 0);
  const analyticalDensity = words ? (analyticalHits / words) * 1000 : 0; // per 1k words

  // Signal → per-criterion scoring
  function scoreCriterion(key: string): { score: number; note: string } {
    switch (key) {
      case "thesis": {
        const early = paragraphs[0]?.toLowerCase() ?? lower.slice(0, 600);
        const hasThesis = /\b(argue|argues|claim|thesis|this (paper|essay|study|report)|will (show|argue|examine|demonstrate)|aims? to|the purpose|i contend)\b/.test(early);
        return { score: clamp(hasThesis ? 82 : 48), note: hasThesis ? "A thesis/purpose is stated early." : "No clear thesis or purpose statement in the opening." };
      }
      case "claim": case "position": {
        const hasClaim = /\b(argue|claim|should|must|contend|propose|position is|recommend)\b/.test(lower.slice(0, 900));
        return { score: clamp(hasClaim ? 84 : 50), note: hasClaim ? "A debatable position is stated." : "State a clearer, debatable position up front." };
      }
      case "evidence": case "citations": {
        const ratio = requiredSources ? citations / requiredSources : 1;
        const base = rubric.wantsCitations ? clamp(35 + ratio * 55) : clamp(70 + Math.min(citations, 5) * 4);
        return { score: base, note: rubric.wantsCitations ? `${citations} citation signal(s) found; ~${requiredSources} expected at this level.` : "Support is largely from experience/example (citations optional here)." };
      }
      case "counter": {
        const hasCounter = /\b(however|critics|opponents|although|some (argue|say|claim)|on the other hand|nevertheless|conversely|admittedly)\b/.test(lower);
        return { score: clamp(hasCounter ? 85 : 45), note: hasCounter ? "A counter-argument is acknowledged." : "No counter-argument is addressed — add and rebut one." };
      }
      case "analysis": case "reflection": {
        const s = clamp(40 + analyticalDensity * 6);
        return { score: s, note: analyticalDensity < 4 ? "Mostly descriptive — add more 'because/therefore/this suggests' reasoning." : "Good analytical linking of ideas." };
      }
      case "structure": {
        const paraOk = paragraphs.length >= 3;
        const s = clamp(sectionCoverage * 70 + (paraOk ? 25 : 5));
        return { score: s, note: paraOk ? `${paragraphs.length} paragraphs; ${presentSections.length}/${rubric.sections.length} expected sections present.` : "Break the text into clear paragraphs/sections." };
      }
      case "mechanics": {
        const errs = grammar.filter((g) => g.severity === "error").length;
        const s = clamp(94 - errs * 6 - Math.max(0, readability.avgSentenceLength - 26) * 1.5);
        return { score: s, note: errs ? `${errs} likely grammar/style issue(s); avg sentence ${readability.avgSentenceLength} words.` : `Clean mechanics; avg sentence ${readability.avgSentenceLength} words.` };
      }
      case "originality": case "voice": {
        const s = clamp(100 - aiLike.score * 0.7);
        return { score: s, note: aiLike.score > 60 ? "Reads AI-patterned/generic — add a specific, personal voice." : "Voice reads natural and specific." };
      }
      case "method": case "results": case "data": {
        const kw = key === "method" ? ["method", "procedure", "sample", "data collection", "approach", "materials"]
          : key === "results" ? ["results", "findings", "table", "figure", "data"]
          : ["$", "%", "ratio", "figure", "table", "data"];
        const hits = has(lower, kw);
        return { score: clamp(45 + hits * 12), note: hits ? "Relevant method/data content present." : "Add explicit method/data detail." };
      }
      case "synthesis": {
        const kw = ["similarly", "in contrast", "consistent with", "whereas", "collectively", "taken together", "across studies"];
        const hits = has(lower, kw);
        return { score: clamp(40 + hits * 12), note: hits ? "Sources are synthesised, not just summarised." : "Synthesise across sources (compare/contrast), don't list summaries." };
      }
      case "gap": {
        const hasGap = /\b(gap|little research|remains unclear|under-?explored|has not been|few studies)\b/.test(lower);
        return { score: clamp(hasGap ? 82 : 52), note: hasGap ? "A research gap is identified." : "Name the gap your work addresses." };
      }
      case "summary": {
        const s = clamp(60 + Math.min(sentences.length, 20));
        return { score: s, note: "Summarise the work fairly before evaluating." };
      }
      case "evaluation": {
        const kw = ["strength", "weakness", "effective", "fails", "succeeds", "convincing", "however", "limitation"];
        const hits = has(lower, kw);
        return { score: clamp(45 + hits * 9), note: hits ? "Critical evaluation is present." : "Add explicit evaluation (strengths/weaknesses), not just summary." };
      }
      case "recommendations": {
        const kw = ["recommend", "should", "propose", "suggest", "action", "next step"];
        const hits = has(lower, kw);
        return { score: clamp(45 + hits * 11), note: hits ? "Actionable recommendations present." : "End with specific, actionable recommendations." };
      }
      case "problem": case "issue": case "context": case "opportunity": {
        const s = clamp(50 + Math.min(paragraphs.length, 6) * 6);
        return { score: s, note: "Frame the problem/context clearly before the solution." };
      }
      case "objectives": case "goals": {
        const hasGoals = /\b(objective|aim|goal|hypothesis|hope to|plan to|aspire)\b/.test(lower);
        return { score: clamp(hasGoals ? 80 : 52), note: hasGoals ? "Objectives/goals are stated." : "State measurable objectives/goals." };
      }
      case "outcomes": {
        const hasOut = /\b(expected|outcome|impact|deliverable|result|benefit)\b/.test(lower);
        return { score: clamp(hasOut ? 80 : 55), note: hasOut ? "Expected outcomes are described." : "Describe expected outcomes and how success is measured." };
      }
      case "arc": {
        const hasArc = /\b(then|after|later|realised|realized|changed|until|finally)\b/.test(lower);
        return { score: clamp(hasArc ? 80 : 55), note: hasArc ? "There is a narrative arc." : "Build a clearer beginning → turning point → resolution arc." };
      }
      case "detail": case "specificity": {
        const s = clamp(50 + Math.min(sentences.length, 25));
        return { score: s, note: "Add concrete, specific detail rather than generalities." };
      }
      case "fit": {
        const kw = ["experience", "project", "research", "led", "built", "volunteered", "achieved", "internship"];
        const hits = has(lower, kw);
        return { score: clamp(45 + hits * 9), note: hits ? "Concrete evidence of fit present." : "Show evidence of fit with specific achievements." };
      }
      case "hook": {
        const early = (paragraphs[0] ?? "").toLowerCase();
        const hasHook = /\b(imagine|picture|have you|when i|one|story|remember)\b/.test(early);
        return { score: clamp(hasHook ? 82 : 55), note: hasHook ? "Opening hooks the reader." : "Open with a specific hook, not a generality." };
      }
      case "delivery": {
        const s = clamp(90 - Math.max(0, readability.avgSentenceLength - 18) * 3);
        return { score: s, note: readability.avgSentenceLength > 22 ? "Sentences are long for speech — shorten for the ear." : "Good spoken rhythm." };
      }
      case "impact": {
        const kw = ["call", "today", "remember", "let us", "thank you", "in closing", "so"];
        const hits = has(lower, kw);
        return { score: clamp(55 + hits * 8), note: hits ? "Ends with a memorable close/call to action." : "Finish with a clear call to action." };
      }
      case "model": case "financials": {
        const kw = ["revenue", "cost", "profit", "margin", "pricing", "forecast", "$", "%"];
        const hits = has(lower, kw);
        return { score: clamp(45 + hits * 9), note: hits ? "Financial/model detail present." : "Add revenue model and financial projections." };
      }
      default:
        return { score: 65, note: "Reviewed." };
    }
  }

  const criteria: CriterionScore[] = rubric.criteria.map((c) => {
    const { score, note } = scoreCriterion(c.key);
    return { key: c.key, label: c.label, weight: c.weight, score, note };
  });

  // Overall weighted score → level-adjusted grade
  const raw = criteria.reduce((sum, c) => sum + c.score * c.weight, 0);
  const percent = clamp(raw * LEVEL_FACTOR[options.level]);
  const { letter, band } = letterFor(percent);

  // Professor reviews — each weights criteria in its focus more heavily.
  const professors: ProfessorReview[] = PROFESSORS.map((prof) => {
    let wsum = 0, tot = 0;
    for (const c of criteria) {
      const w = c.weight * (prof.emphasis.includes(c.key) ? 2.2 : 0.7);
      wsum += c.score * w; tot += w;
    }
    const pscore = clamp((tot ? wsum / tot : raw) * LEVEL_FACTOR[options.level]);
    // Comments: pull the weakest emphasised criteria + one strength.
    const mine = criteria.filter((c) => prof.emphasis.includes(c.key));
    const pool = (mine.length ? mine : criteria).slice().sort((a, b) => a.score - b.score);
    const comments: string[] = [];
    for (const c of pool.slice(0, 2)) {
      if (c.score < 70) comments.push(`${c.label}: ${c.note}`);
    }
    const best = criteria.slice().sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= 72) comments.push(`Strength — ${best.label.toLowerCase()}: ${best.note}`);
    if (!comments.length) comments.push(`Solid on ${prof.focus}. Tighten specifics to push into the top band.`);
    const verdict = pscore >= 85 ? "Accept" : pscore >= 72 ? "Accept with minor revisions" : pscore >= 60 ? "Major revisions needed" : "Reject / rework";
    return { id: prof.id, name: prof.name, school: prof.school, focus: prof.focus, score: pscore, verdict, comments };
  });

  // Gaps / mistakes / improvements / strengths
  const gaps: string[] = [];
  for (const m of missingSections) gaps.push(`Missing or unclear section: ${m}.`);
  if (rubric.wantsCitations && citations < requiredSources)
    gaps.push(`Only ${citations} citation signal(s) detected — aim for ~${requiredSources} sources at ${options.level}.`);
  if (options.minSources !== "auto" && citations < Number(options.minSources))
    gaps.push(`You asked for a minimum of ${options.minSources} sources; ${citations} detected.`);

  const mistakes: string[] = [];
  const gErrs = grammar.filter((g) => g.severity === "error").slice(0, 4);
  for (const g of gErrs) mistakes.push(g.message);
  if (readability.avgSentenceLength > 28) mistakes.push(`Average sentence length is ${readability.avgSentenceLength} words — several sentences are too long.`);
  if (rubric.firstPerson === "avoid" && /\bI\b|\bmy\b|\bwe\b/.test(text)) mistakes.push("First person is used — most academic writing at this level prefers a third-person register.");
  if (rubric.wantsCitations && detected.style && options.citationStyle && detected.style !== options.citationStyle)
    mistakes.push(`Citations look like ${detected.style.toUpperCase()} but ${options.citationStyle.toUpperCase()} was selected — make them consistent.`);
  if (aiLike.score > 65) mistakes.push("Phrasing reads AI-generic (low burstiness) — vary sentence rhythm and add your own voice.");

  const improvements: string[] = [];
  for (const c of criteria.filter((c) => c.score < 68).sort((a, b) => a.score - b.score)) improvements.push(`Improve ${c.label.toLowerCase()}: ${c.note}`);
  if (!improvements.length) improvements.push("Strong across the rubric — polish word choice and tighten the conclusion to reach the top band.");

  const strengths: string[] = criteria.filter((c) => c.score >= 78).sort((a, b) => b.score - a.score).map((c) => `${c.label}: ${c.note}`);
  if (!strengths.length && percent >= 60) strengths.push("A workable draft with a clear structure to build on.");

  // Highlights — weakest sentences (long / passive / AI-cliché / claim-without-citation)
  const highlights = buildWeaknessHighlights(text, sentences, rubric.wantsCitations);

  // Probable questions — 5..500 scaled to length
  const questions = buildQuestions(text, sentences, options, rubric.family, words);

  const citationStyleMatch = !detected.style || !options.citationStyle || detected.style === options.citationStyle;

  return {
    options,
    rubricSummary: rubric.summary,
    grade: { percent, letter, band },
    professors,
    criteria,
    presentSections,
    missingSections,
    strengths,
    gaps,
    mistakes,
    improvements,
    questions,
    rules: rubric.rules,
    highlights,
    metrics: {
      words,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      citations,
      avgSentence: readability.avgSentenceLength,
      readingEase: readability.fleschReadingEase,
    },
    citationStyleMatch,
  };
}

const AI_CLICHES = ["furthermore", "moreover", "in conclusion", "it is important to note", "delve", "multifaceted", "in today's world", "plays a crucial role", "it is essential", "navigate the complexities", "underscore", "in the realm of"];
const CLAIM_MARKERS = ["proves", "shows that", "demonstrates that", "clearly", "obviously", "significant", "the best", "the most", "always", "never", "everyone", "studies show"];

function buildWeaknessHighlights(text: string, sentences: string[], wantsCitations: boolean): HighlightSegment[] {
  const flagged = new Set<string>();
  for (const s of sentences) {
    const low = s.toLowerCase();
    const wordCount = s.split(/\s+/).filter(Boolean).length;
    const isLong = wordCount > 34;
    const isCliche = AI_CLICHES.some((c) => low.includes(c));
    const isPassive = /\b(was|were|is|are|been|being)\s+\w+(ed|en)\b/.test(low);
    const looksLikeClaim = CLAIM_MARKERS.some((c) => low.includes(c));
    const hasCite = /\((?:19|20)\d{2}\)|\[\d+\]|et al/.test(s);
    if (isLong || isCliche || (looksLikeClaim && wantsCitations && !hasCite) || (isPassive && wordCount > 22)) {
      flagged.add(s);
    }
  }
  if (!flagged.size) return [{ text, type: null }];
  // Build ordered segments (reuse simple substring locate; "ai" tone = weak spot).
  const ranges: Array<{ start: number; end: number }> = [];
  const lower = text.toLowerCase();
  for (const s of flagged) {
    const idx = lower.indexOf(s.toLowerCase());
    if (idx !== -1) ranges.push({ start: idx, end: idx + s.length });
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start < last.end) { if (r.end > last.end) last.end = r.end; continue; }
    merged.push({ ...r });
  }
  const segs: HighlightSegment[] = [];
  let cur = 0;
  for (const r of merged) {
    if (r.start > cur) segs.push({ text: text.slice(cur, r.start), type: null });
    segs.push({ text: text.slice(r.start, r.end), type: "ai" });
    cur = r.end;
  }
  if (cur < text.length) segs.push({ text: text.slice(cur), type: null });
  return segs;
}

const STOPWORDS = new Set(["the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "as", "by", "at", "from", "that", "this", "these", "those", "is", "are", "was", "were", "be", "been", "it", "its", "their", "there", "which", "who", "what", "when", "where", "how", "why", "into", "than", "then", "also", "such", "can", "will", "may", "has", "have", "had", "not", "you", "your", "our", "we", "they", "he", "she", "his", "her", "them", "about", "would", "could", "should", "more", "most", "some", "any", "all", "one", "two", "very", "much", "many"]);

function keyTerms(text: string, max: number): string[] {
  const freq = new Map<string, number>();
  // Multi-word Capitalised phrases first (proper concepts).
  const caps = text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})\b/g) || [];
  for (const c of caps) {
    if (c.split(/\s+/).every((w) => STOPWORDS.has(w.toLowerCase()))) continue;
    freq.set(c, (freq.get(c) || 0) + 3);
  }
  for (const raw of text.toLowerCase().match(/[a-z][a-z-]{4,}/g) || []) {
    if (STOPWORDS.has(raw)) continue;
    freq.set(raw, (freq.get(raw) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map((e) => e[0]);
}

function buildQuestions(
  text: string,
  sentences: string[],
  options: PeerReviewOptions,
  family: Family,
  words: number,
): string[] {
  // Count scales with length: ~1 question per 40 words, clamped to [5, 500].
  const target = Math.max(5, Math.min(500, Math.round(words / 40) || 5));
  const terms = keyTerms(text, Math.min(120, target));
  const out: string[] = [];
  const push = (q: string) => { if (q && !out.includes(q)) out.push(q); };

  // Defence/exam-style templates, tuned a little per family.
  const generic = (t: string) => [
    `What is the central argument or purpose regarding "${t}", and how is it supported?`,
    `What evidence would most strengthen your claims about "${t}"?`,
    `How does "${t}" relate to the other main ideas in your work?`,
    `What is a credible counter-argument to your treatment of "${t}", and how would you answer it?`,
    `Why did you choose to focus on "${t}" rather than an alternative?`,
    `What are the limitations of your discussion of "${t}"?`,
    `How would you define "${t}" precisely for an examiner?`,
  ];
  const research = (t: string) => [
    `What method or evidence underpins your findings on "${t}"?`,
    `How reliable and valid is your treatment of "${t}"?`,
    `What would you do differently if you repeated the work on "${t}"?`,
  ];
  const persuasive = (t: string) => [
    `Why should the reader accept your position on "${t}"?`,
    `What assumption behind your view of "${t}" is most open to challenge?`,
  ];

  // Structural questions first (always useful).
  push(`What is the single most important takeaway of this ${options.paperType.toLowerCase()}?`);
  push(`If you had 100 more words, what would you add and why?`);
  push(`Which claim in the piece is currently the least supported?`);
  push(`How does your conclusion follow from your evidence?`);
  push(`Who is the intended audience, and is the register right for them?`);

  outer:
  for (const t of terms) {
    for (const q of generic(t)) { push(q); if (out.length >= target) break outer; }
    if (family === "research" || family === "thesis" || family === "lab" || family === "litreview")
      for (const q of research(t)) { push(q); if (out.length >= target) break outer; }
    if (family === "argument" || family === "policy" || family === "admissions")
      for (const q of persuasive(t)) { push(q); if (out.length >= target) break outer; }
  }
  // Sentence-derived probes to fill any remainder.
  if (out.length < target) {
    for (const s of sentences) {
      const short = s.length > 120 ? s.slice(0, 117) + "…" : s;
      push(`On "${short}" — what is the basis for this, and how would you defend it?`);
      if (out.length >= target) break;
    }
  }
  return out.slice(0, target);
}
