// ── Financial Statements Analysis Engine ─────────────────────────────────────
// Handles parsing, ratio computation, and AI instruction generation for
// accounting / finance / economics / banking subjects.

export const FINANCE_SUBJECT_PATTERN =
  /finance|accounting|economics|banking|investment|insurance|actuarial|business\s*(studies)?|credit\s*anal|financial/i;

export function isFinanceSubject(subject: string): boolean {
  return FINANCE_SUBJECT_PATTERN.test(subject ?? "");
}

export const STATEMENT_TYPES = [
  { value: "income_statement", label: "Income Statement (P&L)" },
  { value: "balance_sheet",    label: "Balance Sheet" },
  { value: "cash_flow",        label: "Cash Flow Statement" },
  { value: "all",              label: "Full Financial Statements" },
];

// ── Number extraction helpers ─────────────────────────────────────────────────

function extractValue(text: string, patterns: RegExp[]): number | null {
  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) {
      const raw = (match[1] ?? match[2] ?? "")
        .replace(/,/g, "")
        .replace(/\s+/g, "")
        .replace(/[$£€¥]/g, "")
        .trim();
      const negative = /\(.*\)/.test(raw) || /^-/.test(raw);
      const cleaned = raw.replace(/[()]/g, "").replace(/^-/, "");
      let num: number;
      if (/[Tt]$/.test(cleaned))      num = parseFloat(cleaned) * 1_000_000_000_000;
      else if (/[Bb]$/.test(cleaned)) num = parseFloat(cleaned) * 1_000_000_000;
      else if (/[Mm]$/.test(cleaned)) num = parseFloat(cleaned) * 1_000_000;
      else if (/[Kk]$/.test(cleaned)) num = parseFloat(cleaned) * 1_000;
      else                            num = parseFloat(cleaned);
      if (!isNaN(num) && isFinite(num)) return negative ? -Math.abs(num) : num;
    }
  }
  return null;
}

function fmt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "(" : "";
  const end  = n < 0 ? ")" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B${end}`;
  if (abs >= 1_000_000)     return `${sign}$${(abs / 1_000_000).toFixed(2)}M${end}`;
  if (abs >= 1_000)         return `${sign}$${(abs / 1_000).toFixed(1)}K${end}`;
  return `${sign}$${abs.toFixed(0)}${end}`;
}

function pct(n: number): string { return `${n.toFixed(2)}%`; }
function ratio(n: number): string { return `${n.toFixed(2)}x`; }

// ── Financial line-item patterns ──────────────────────────────────────────────

const P = {
  revenue:       [/(?:total\s+)?(?:net\s+)?(?:revenue|sales|turnover|net\s+revenue)\s*[:\|]?\s*[$£€¥]?\s*([\d,]+\.?\d*[MBKmkbBTt]?)/i],
  cogs:          [/(?:cost\s+of\s+(?:goods?\s+sold|revenue|sales)|cogs)\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  grossProfit:   [/gross\s+(?:profit|margin)\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  operatingExp:  [/(?:total\s+)?(?:operating|selling\s*[,&]\s*admin|sg&a|sga)\s*expenses?\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  ebitda:        [/ebitda\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  ebit:          [/(?:ebit|operating\s+(?:income|profit)|income\s+from\s+operations)\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  depAmort:      [/(?:depreciation(?:\s*&|and|\/)\s*amortization?|d&a|da)\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  interestExp:   [/interest\s+(?:expense|charges?)\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  taxExp:        [/(?:income\s+)?tax(?:es)?\s+(?:expense|provision)\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  netIncome:     [/net\s+(?:income|profit|earnings|loss)\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  eps:           [/(?:basic\s+)?(?:earnings|eps)\s+per\s+share\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,.]+)\)?/i],
  shares:        [/(?:weighted[\s-]+average\s+)?(?:diluted\s+)?(?:shares|shares\s+outstanding)\s*[:\|]?\s*([\d,]+\.?\d*[MBKmkbBTt]?)/i],
  // Balance Sheet
  currentAssets:   [/(?:total\s+)?current\s+assets?\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  cash:            [/cash(?:\s*(?:and|&)\s*(?:cash\s+equiv(?:alents?)?|short[- ]term\s+investments?))?\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  inventory:       [/inventories?\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  receivables:     [/(?:accounts?\s+|trade\s+)?receivables?\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  totalAssets:     [/total\s+assets?\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  currentLiab:     [/(?:total\s+)?current\s+liabilit(?:ies|y)\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  payables:        [/(?:accounts?\s+|trade\s+)?payables?\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  shortTermDebt:   [/(?:short[\s-]term\s+(?:debt|borrowings?|notes\s+payable))\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  longTermDebt:    [/(?:long[\s-]term\s+(?:debt|borrowings?|notes\s+payable))\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  totalLiab:       [/total\s+liabilit(?:ies|y)\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  totalEquity:     [/(?:(?:total\s+)?(?:shareholders?(?:'s)?|stockholders?(?:'s)?|owners?)\s+equity|total\s+equity|net\s+(?:assets?|worth))\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  retainedEarnings:[/retained\s+earnings?\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  // Cash Flow
  operatingCF:     [/(?:net\s+)?cash\s+(?:(?:provided\s+by|from|used\s+in)\s+)?operating\s+activities?\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  investingCF:     [/(?:net\s+)?cash\s+(?:(?:provided\s+by|from|used\s+in)\s+)?investing\s+activities?\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  financingCF:     [/(?:net\s+)?cash\s+(?:(?:provided\s+by|from|used\s+in)\s+)?financing\s+activities?\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
  capex:           [/(?:capital\s+expenditures?|capex|purchase\s+of\s+(?:property|ppe|equipment|plant))\s*[:\|]?\s*\(?([$£€¥]?\s*[\d,]+\.?\d*[MBKmkbBTt]?)\)?/i],
};

// ── Multi-year trend analysis ─────────────────────────────────────────────────

interface YearSnapshot {
  year: string;
  revenue: number | null; cogs: number | null; grossProfit: number | null;
  ebit: number | null; netIncome: number | null;
  totalAssets: number | null; totalEquity: number | null;
  currentAssets: number | null; currentLiab: number | null;
  operatingCF: number | null; capex: number | null;
}

function extractByYear(text: string): Map<string, string> {
  // Strategy 1: explicit section headers (FY2023, Year 2023, 2023:, etc.)
  const secPat = /(?:^|\n)\s*(?:(?:fy|fiscal\s+year?\s*|year\s*):?\s*)?(20\d{2})\s*(?::[ \t]*)?\s*(?=\n|$)/gi;
  const secMs = [...text.matchAll(secPat)];
  if (secMs.length >= 2) {
    const map = new Map<string, string>();
    for (let i = 0; i < secMs.length; i++) {
      const yr = secMs[i][1];
      const start = secMs[i].index! + secMs[i][0].length;
      const end = i + 1 < secMs.length ? secMs[i + 1].index! : text.length;
      map.set(yr, text.slice(start, end));
    }
    return map;
  }
  // Strategy 2: column header row with 2+ years, values in subsequent rows
  const lines = text.split('\n');
  let headerIdx = -1;
  let yearCols: Array<{ year: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const ms = [...lines[i].matchAll(/\b((?:fy\s*)?20\d{2})\b/gi)];
    if (ms.length >= 2) {
      headerIdx = i;
      yearCols = ms.map(m => ({ year: m[1].replace(/\s/g, '').replace(/^[Ff][Yy]/, '') }));
      break;
    }
  }
  if (headerIdx < 0) return new Map();
  const perYear = new Map<string, string>();
  for (const { year } of yearCols) perYear.set(year, '');
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const labelM = line.match(/^([A-Za-z][^:0-9$£€(]{2,}?)(?:\s{2,}|\t|:\s*)/);
    if (!labelM) continue;
    const label = labelM[1].trim();
    const numMs = [...line.matchAll(/\(?\s*\$?\s*([\d,]+\.?\d*[KMBTkmbt]?)\s*\)?/g)]
      .filter(m => { const n = parseFloat(m[1].replace(/,/g, '')); return !isNaN(n) && n > 0; });
    for (let j = 0; j < yearCols.length && j < numMs.length; j++) {
      const ex = perYear.get(yearCols[j].year) ?? '';
      perYear.set(yearCols[j].year, ex + `${label}: ${numMs[j][0]}\n`);
    }
  }
  if ([...perYear.values()].every(v => !v.trim())) return new Map();
  return perYear;
}

function snapshotFromText(text: string, year: string): YearSnapshot {
  const ev = (pats: RegExp[]) => extractValue(text, pats);
  const revenue = ev(P.revenue);
  const cogs    = ev(P.cogs);
  return {
    year, revenue, cogs,
    grossProfit:  ev(P.grossProfit) ?? (revenue != null && cogs != null ? revenue - cogs : null),
    ebit:         ev(P.ebit),
    netIncome:    ev(P.netIncome),
    totalAssets:  ev(P.totalAssets),
    totalEquity:  ev(P.totalEquity),
    currentAssets:ev(P.currentAssets),
    currentLiab:  ev(P.currentLiab),
    operatingCF:  ev(P.operatingCF),
    capex:        ev(P.capex),
  };
}

function yoyChange(curr: number | null, prev: number | null): string | null {
  if (curr == null || prev == null || prev === 0) return null;
  const g = ((curr - prev) / Math.abs(prev)) * 100;
  return `${g >= 0 ? "+" : ""}${g.toFixed(1)}%`;
}

function cagrStr(oldest: number | null, newest: number | null, nYrs: number): string | null {
  if (!oldest || !newest || oldest <= 0 || nYrs <= 0) return null;
  const c = (Math.pow(newest / oldest, 1 / nYrs) - 1) * 100;
  return `${c >= 0 ? "+" : ""}${c.toFixed(1)}% CAGR`;
}

function trendArrow(g: string | null): string {
  if (!g) return "─";
  const v = parseFloat(g);
  if (v >= 10) return "↑↑"; if (v > 0) return "↑";
  if (v <= -10) return "↓↓"; if (v < 0) return "↓";
  return "─";
}

export function buildTrendAnalysisContext(rawText: string): string {
  const segments = extractByYear(rawText);
  if (segments.size < 2) return "";
  const sortedYears = [...segments.keys()].sort();
  const snaps = sortedYears.map(y => snapshotFromText(segments.get(y)!, y));
  if (snaps.length < 2) return "";
  const newest = snaps[snaps.length - 1];
  const oldest = snaps[0];
  const nYrs   = parseInt(newest.year) - parseInt(oldest.year);

  const rows: string[] = [];
  function addRow(label: string, get: (s: YearSnapshot) => number | null, fmtFn: (n: number) => string) {
    const vals = snaps.map(get);
    if (vals.every(v => v == null)) return;
    const cells = vals.map(v => v != null ? fmtFn(v) : "N/A");
    const yoys  = snaps.slice(1).map((s, i) => {
      const g = yoyChange(get(s), get(snaps[i]));
      return g ? `${trendArrow(g)} ${g}` : "─";
    });
    rows.push(`${label.padEnd(20)}| ${cells.join(" | ")} | YoY: ${yoys.join(" → ")}`);
  }

  rows.push(`${"METRIC".padEnd(20)}| ${sortedYears.join("        | ")}`);
  rows.push("-".repeat(72));
  addRow("Revenue",       s => s.revenue,      fmt);
  addRow("Gross Profit",  s => s.grossProfit,   fmt);
  addRow("EBIT",          s => s.ebit,          fmt);
  addRow("Net Income",    s => s.netIncome,     fmt);
  addRow("Total Assets",  s => s.totalAssets,   fmt);
  addRow("Total Equity",  s => s.totalEquity,   fmt);
  addRow("Operating CF",  s => s.operatingCF,   fmt);

  const marginLines = snaps.map(s => {
    const m: string[] = [];
    if (s.revenue && s.grossProfit) m.push(`Gross ${pct(s.grossProfit / s.revenue * 100)}`);
    if (s.revenue && s.ebit)        m.push(`EBIT ${pct(s.ebit / s.revenue * 100)}`);
    if (s.revenue && s.netIncome)   m.push(`Net ${pct(s.netIncome / s.revenue * 100)}`);
    return m.length ? `  ${s.year}: ${m.join("  |  ")}` : "";
  }).filter(Boolean);

  const cagrLines: string[] = [];
  const revC = cagrStr(oldest.revenue, newest.revenue, nYrs);
  if (revC) cagrLines.push(`Revenue ${revC} (${oldest.year}→${newest.year})`);
  const niC  = cagrStr(oldest.netIncome, newest.netIncome, nYrs);
  if (niC)  cagrLines.push(`Net Income ${niC}`);

  const flags: string[] = [];
  for (let i = 1; i < snaps.length; i++) {
    const c = snaps[i], p = snaps[i - 1];
    if (c.revenue != null && p.revenue != null && c.revenue < p.revenue * 0.95)
      flags.push(`Revenue declined ${yoyChange(c.revenue, p.revenue)} in ${c.year}`);
    if (c.netIncome != null && c.netIncome < 0 && (p.netIncome == null || p.netIncome >= 0))
      flags.push(`Net income turned negative in ${c.year} — profitability reversal`);
    if (c.revenue && c.grossProfit && p.revenue && p.grossProfit) {
      const gm = (s: YearSnapshot) => s.grossProfit! / s.revenue!;
      if (gm(c) < gm(p) - 0.05)
        flags.push(`Gross margin compressed ${pct((gm(p) - gm(c)) * 100)} from ${p.year} to ${c.year}`);
    }
    if (c.operatingCF != null && c.operatingCF < 0 && (p.operatingCF == null || p.operatingCF >= 0))
      flags.push(`Operating cash flow turned negative in ${c.year}`);
  }

  let block = `\nMULTI-YEAR TREND ANALYSIS — ${snaps.length} PERIODS (${oldest.year}–${newest.year})\n${"=".repeat(64)}\n`;
  block += rows.join("\n") + "\n\n";
  if (marginLines.length) block += `MARGIN TRENDS:\n${marginLines.join("\n")}\n\n`;
  if (cagrLines.length)   block += `COMPOUND GROWTH RATES:\n${cagrLines.map(l => `  • ${l}`).join("\n")}\n\n`;
  if (flags.length)       block += `⚠ DETERIORATING METRICS / RED FLAGS:\n${flags.map(f => `  • ${f}`).join("\n")}\n\n`;
  block += `TREND ANALYSIS MANDATORY REQUIREMENTS:
1. Open with a 2–3 sentence TREND NARRATIVE describing the overall trajectory across the ${snaps.length} periods
2. For every YoY change, provide a one-sentence interpretation — not just the number
3. Compute and cite CAGR for Revenue and Net Income across the full ${nYrs > 0 ? nYrs + "-year " : ""}period
4. Identify the SINGLE MOST SIGNIFICANT trend (positive or negative) and explain its strategic implications
5. If any metric deteriorated, diagnose whether it is cyclical or structural with evidence from the data
6. Conclude with a forward-looking assessment: based on the trends, what should the next fiscal period look like?`;

  return block;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildFinancialStatementsContext(rawText: string, statementType: string): string {
  if (!rawText?.trim()) return "";

  const t = rawText;
  const typeLabel = STATEMENT_TYPES.find(s => s.value === statementType)?.label ?? "Financial Statements";

  // ── Extract values ────────────────────────────────────────────────────────
  const revenue        = extractValue(t, P.revenue);
  const cogs           = extractValue(t, P.cogs);
  const grossProfit    = extractValue(t, P.grossProfit) ?? (revenue != null && cogs != null ? revenue - cogs : null);
  const ebit           = extractValue(t, P.ebit);
  const ebitda         = extractValue(t, P.ebitda);
  const da             = extractValue(t, P.depAmort);
  const interestExp    = extractValue(t, P.interestExp);
  const taxExp         = extractValue(t, P.taxExp);
  const netIncome      = extractValue(t, P.netIncome);
  const eps            = extractValue(t, P.eps);
  const shares         = extractValue(t, P.shares);
  const currentAssets  = extractValue(t, P.currentAssets);
  const cash           = extractValue(t, P.cash);
  const inventory      = extractValue(t, P.inventory);
  const receivables    = extractValue(t, P.receivables);
  const totalAssets    = extractValue(t, P.totalAssets);
  const currentLiab    = extractValue(t, P.currentLiab);
  const payables       = extractValue(t, P.payables);
  const longTermDebt   = extractValue(t, P.longTermDebt);
  const shortTermDebt  = extractValue(t, P.shortTermDebt);
  const totalLiab      = extractValue(t, P.totalLiab);
  const totalEquity    = extractValue(t, P.totalEquity);
  const operatingCF    = extractValue(t, P.operatingCF);
  const investingCF    = extractValue(t, P.investingCF);
  const financingCF    = extractValue(t, P.financingCF);
  const capex          = extractValue(t, P.capex);

  // ── Compute ratios ────────────────────────────────────────────────────────
  const computed: string[] = [];

  // Profitability
  if (revenue && grossProfit)
    computed.push(`Gross Margin: ${pct((grossProfit / revenue) * 100)}`);
  if (revenue && ebit)
    computed.push(`Operating (EBIT) Margin: ${pct((ebit / revenue) * 100)}`);
  if (revenue && ebitda)
    computed.push(`EBITDA Margin: ${pct((ebitda / revenue) * 100)}`);
  if (revenue && netIncome)
    computed.push(`Net Profit Margin: ${pct((netIncome / revenue) * 100)}`);
  if (totalAssets && netIncome)
    computed.push(`Return on Assets (ROA): ${pct((netIncome / totalAssets) * 100)}`);
  if (totalEquity && netIncome)
    computed.push(`Return on Equity (ROE): ${pct((netIncome / totalEquity) * 100)}`);
  if (totalAssets && currentLiab && ebit)
    computed.push(`Return on Capital Employed (ROCE): ${pct((ebit / (totalAssets - currentLiab)) * 100)}`);
  if (revenue && ebit && netIncome && totalAssets && totalEquity) {
    // DuPont decomposition: ROE = Net Margin × Asset Turnover × Equity Multiplier
    const netMargin   = netIncome / revenue;
    const assetTO     = revenue / totalAssets;
    const equityMult  = totalAssets / totalEquity;
    computed.push(`DuPont ROE = ${pct(netMargin * 100)} × ${ratio(assetTO)} × ${ratio(equityMult)} = ${pct(netMargin * assetTO * equityMult * 100)}`);
  }

  // Liquidity
  if (currentAssets && currentLiab)
    computed.push(`Current Ratio: ${ratio(currentAssets / currentLiab)} (healthy ≥ 1.5–2.0x)`);
  if (currentAssets && inventory && currentLiab)
    computed.push(`Quick (Acid-Test) Ratio: ${ratio((currentAssets - inventory) / currentLiab)} (healthy ≥ 1.0x)`);
  if (cash && currentLiab)
    computed.push(`Cash Ratio: ${ratio(cash / currentLiab)} (conservative ≥ 0.2–0.5x)`);

  // Solvency / Leverage
  const totalDebt = (longTermDebt ?? 0) + (shortTermDebt ?? 0);
  if (totalEquity && totalDebt > 0)
    computed.push(`Debt-to-Equity (D/E): ${ratio(totalDebt / totalEquity)} (typical range 0.5–2.0x by industry)`);
  if (totalLiab && totalAssets)
    computed.push(`Debt-to-Assets: ${ratio(totalLiab / totalAssets)} (higher = more leveraged)`);
  if (ebit && interestExp && interestExp > 0)
    computed.push(`Interest Coverage (TIE): ${ratio(ebit / interestExp)}x (≥ 3.0x considered safe)`);

  // Efficiency
  if (revenue && totalAssets)
    computed.push(`Asset Turnover: ${ratio(revenue / totalAssets)} (times per year)`);
  if (cogs && inventory && inventory > 0) {
    const it = cogs / inventory;
    computed.push(`Inventory Turnover: ${ratio(it)} (Days Inventory Outstanding: ${(365 / it).toFixed(0)} days)`);
  }
  if (revenue && receivables && receivables > 0) {
    const rt = revenue / receivables;
    computed.push(`Receivables Turnover: ${ratio(rt)} (Days Sales Outstanding: ${(365 / rt).toFixed(0)} days)`);
  }
  if (cogs && payables && payables > 0) {
    const pt = cogs / payables;
    computed.push(`Payables Turnover: ${ratio(pt)} (Days Payable Outstanding: ${(365 / pt).toFixed(0)} days)`);
  }

  // Cash Flow ratios
  if (operatingCF && capex != null) {
    const fcf = operatingCF - Math.abs(capex);
    computed.push(`Free Cash Flow (FCF): ${fmt(fcf)}`);
    if (revenue) computed.push(`FCF Margin: ${pct((fcf / revenue) * 100)}`);
  }
  if (operatingCF && totalDebt > 0)
    computed.push(`Cash Flow to Debt: ${ratio(operatingCF / totalDebt)}`);
  if (operatingCF && netIncome && Math.abs(netIncome) > 0)
    computed.push(`Cash Flow Quality (CFO/NI): ${ratio(operatingCF / netIncome)} (>1 = earnings backed by cash)`);

  // Per share
  if (netIncome && shares && shares > 0 && !eps)
    computed.push(`Calculated EPS: ${fmt(netIncome / shares)}`);
  if (eps) computed.push(`EPS (from statements): $${eps.toFixed(2)}`);

  // ── Build the context block ───────────────────────────────────────────────
  const ratioBlock = computed.length > 0
    ? `\nAuto-Computed Financial Ratios (from extracted line items):\n${computed.map(r => `  • ${r}`).join("\n")}`
    : "";

  const stInstructions: Record<string, string> = {
    income_statement: `
INCOME STATEMENT ANALYSIS — MANDATORY SECTIONS:
1. Revenue Analysis: Break down revenue components, calculate year-over-year / period-over-period growth rates, discuss revenue quality and sustainability
2. Profitability Cascade: Present a profitability "waterfall" from Gross Profit → EBITDA → EBIT → EBT → Net Income with each margin explicitly computed and named
3. EBITDA Bridge: Start from Net Income and add back tax, interest, D&A to derive/verify EBITDA
4. Cost Structure: Analyse COGS as % of revenue (cost ratio), operating expense leverage, fixed vs variable cost implications
5. Earnings Quality: Assess whether earnings are backed by cash flow (compare to operating cash flow if available)
6. Trend Analysis (if multi-period data): Compute CAGR for revenue and net income; identify margin expansion or compression
7. Benchmarking: Compare all margins to industry benchmarks — state the benchmark source and whether this company outperforms/underperforms
8. Red Flags: Identify any warning signs (declining margins, revenue without profit growth, large D&A relative to EBITDA)`,

    balance_sheet: `
BALANCE SHEET ANALYSIS — MANDATORY SECTIONS:
1. Working Capital Analysis: Current Assets − Current Liabilities = Net Working Capital; discuss adequacy and trends
2. Liquidity Position: Compute and interpret Current Ratio, Quick Ratio, Cash Ratio; discuss short-term solvency
3. Capital Structure: Present the debt-equity split as a percentage; discuss optimal leverage for this type of business
4. Asset Composition: Break down assets into current vs non-current; compute what percentage of assets are liquid
5. Debt Maturity Profile: Separate short-term vs long-term debt; discuss refinancing risk
6. Equity Analysis: Present retained earnings vs paid-up capital; compute book value per share if share data available
7. Solvency Ratios: D/E ratio, D/A ratio, equity multiplier; compare to industry benchmarks
8. Asset Quality: Identify any intangibles, goodwill, or deferred items; discuss their nature
9. Vertical (Common-Size) Analysis: Express every line item as % of Total Assets`,

    cash_flow: `
CASH FLOW STATEMENT ANALYSIS — MANDATORY SECTIONS:
1. Operating Cash Flow Quality: Compare CFO to Net Income (cash conversion ratio); high-quality earnings have CFO ≥ Net Income
2. Free Cash Flow: Compute FCF = Operating CF − CapEx; interpret FCF generation capacity
3. CapEx Intensity: CapEx / Revenue ratio; distinguish maintenance CapEx from growth CapEx where possible
4. Investing Activities: Analyse acquisitions, disposals, investment securities; infer growth strategy
5. Financing Activities: Identify debt issuance/repayment, equity issuance, dividends, buybacks; infer capital allocation priorities
6. Cash Position: Net change in cash; comment on beginning and ending cash balances if available
7. Free Cash Flow Yield: FCF / Revenue; compare to net margin to assess earnings vs cash conversion
8. Sustainability: Can the company fund operations and investments from internal cash flow alone?
9. Red Flags: Negative operating CF with positive net income (earnings manipulation risk); large investing outflows without corresponding revenue growth`,

    all: `
FULL FINANCIAL STATEMENTS — INTEGRATED ANALYSIS — MANDATORY SECTIONS:
1. INCOME STATEMENT: Complete profitability analysis (all margins, EBITDA, EPS, trend analysis)
2. BALANCE SHEET: Working capital, capital structure, liquidity ratios, solvency ratios, common-size balance sheet
3. CASH FLOW: Operating/investing/financing breakdown, FCF, cash conversion quality
4. INTEGRATION ANALYSIS:
   a. Cash Earnings Quality: CFO vs Net Income — does cash flow confirm reported earnings?
   b. Return Triangle: Revenue growth × Margin expansion × Asset turnover = ROE growth
   c. DuPont Analysis: Decompose ROE = Net Margin × Asset Turnover × Equity Multiplier (financial leverage)
   d. Working Capital Cycle: DSO + DIO − DPO = Cash Conversion Cycle; interpret implications
5. RATIO DASHBOARD: Present ALL ratios in a formatted markdown table organised by category (Profitability / Liquidity / Solvency / Efficiency / Cash Flow)
6. HORIZONTAL ANALYSIS: Period-over-period % change for all major line items
7. VERTICAL (COMMON-SIZE) ANALYSIS: Income statement as % of Revenue; Balance Sheet as % of Total Assets
8. BENCHMARKING: Compare key ratios to industry averages; state the industry and benchmark source
9. STRENGTHS & WEAKNESSES: Evidence-based financial assessment (cite specific ratios and line items)
10. GOING CONCERN ASSESSMENT: Based on the data, assess financial health and any solvency/liquidity concerns`,
  };

  const instructions = stInstructions[statementType] ?? stInstructions.all;

  const trendBlock = buildTrendAnalysisContext(rawText);

  return `STUDENT-PROVIDED FINANCIAL STATEMENTS — ${typeLabel}
${"-".repeat(60)}
${rawText.slice(0, 6000)}${rawText.length > 6000 ? "\n[… truncated for context window — full data above]" : ""}
${ratioBlock}
${trendBlock}
${instructions}

MANDATORY FINANCIAL ANALYSIS RULES:
1. Present ALL computed financial ratios above in a formatted markdown table in the analysis section
2. Use the ACTUAL numbers from the statements — never invent figures
3. State the currency and reporting period clearly
4. After every ratio, provide a one-sentence interpretation (e.g., "A current ratio of 1.8x indicates the company can comfortably cover its short-term obligations")
5. Perform horizontal analysis: compute % change between periods for all major line items
6. Perform vertical (common-size) analysis: express each line item as % of the base figure
7. Compare ratios to industry benchmarks — be explicit about the benchmark and industry classification
8. Flag any red flags or areas of concern with clear evidence from the data
9. Conclude with an overall financial health assessment tied to specific numbers`;
}
