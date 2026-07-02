/**
 * Shared dataset parsing + descriptive statistics utility.
 * Used by Write Paper, Study Assistant, and STEM Solver backends.
 */

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function skewness(values: number[], mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  const n = values.length;
  const m3 = values.reduce((a, v) => a + ((v - mean) / stdDev) ** 3, 0) / n;
  return m3;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i] - mx, yi = y[i] - my;
    num += xi * yi;
    dx += xi * xi;
    dy += yi * yi;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

interface ColAnalysis {
  header: string;
  isNumeric: boolean;
  numericValues?: number[];
  rawValues: string[];
  stats?: string;
}

export function parseAndAnalyzeDataset(csvText: string): string {
  const lines = csvText.trim().split("\n").filter(l => l.trim().length > 0);
  if (lines.length < 2) return "";

  const firstLine = lines[0];
  const sep = firstLine.split("\t").length > firstLine.split(",").length ? "\t" : ",";
  const parseRow = (line: string) => line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""));

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  const totalRows = rows.length;

  const columns: ColAnalysis[] = [];
  const colStats: string[] = [];
  const numericCols: { header: string; values: number[] }[] = [];

  headers.forEach((header, colIdx) => {
    const rawValues = rows.map(r => r[colIdx] ?? "").filter(v => v.length > 0);
    const numericValues = rawValues.map(v => parseFloat(v.replace(/,/g, ""))).filter(v => !isNaN(v));

    if (numericValues.length >= rawValues.length * 0.7 && numericValues.length >= 3) {
      const n = numericValues.length;
      const mean = numericValues.reduce((a, b) => a + b, 0) / n;
      const sorted = [...numericValues].sort((a, b) => a - b);
      const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
      const variance = numericValues.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
      const stdDev = Math.sqrt(variance);
      const q1 = percentile(sorted, 25);
      const q3 = percentile(sorted, 75);
      const iqr = q3 - q1;
      const skew = skewness(numericValues, mean, stdDev);

      const statLine = `**${header}** (numeric, n=${n}): mean=${mean.toFixed(3)}, median=${median.toFixed(3)}, SD=${stdDev.toFixed(3)}, min=${sorted[0]}, Q1=${q1.toFixed(2)}, Q3=${q3.toFixed(2)}, IQR=${iqr.toFixed(2)}, max=${sorted[n - 1]}, skewness=${skew.toFixed(3)}`;
      colStats.push(statLine);
      numericCols.push({ header, values: numericValues });
      columns.push({ header, isNumeric: true, numericValues, rawValues, stats: statLine });
    } else {
      const counts: Record<string, number> = {};
      rawValues.forEach(v => { counts[v] = (counts[v] ?? 0) + 1; });
      const topCats = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const uniqueCount = Object.keys(counts).length;
      const statLine = `**${header}** (categorical, n=${rawValues.length}, ${uniqueCount} unique): ${topCats.map(([v, c]) => `${v}=${c}`).join(", ")}${uniqueCount > 8 ? ` … and ${uniqueCount - 8} more` : ""}`;
      colStats.push(statLine);
      columns.push({ header, isNumeric: false, rawValues, stats: statLine });
    }
  });

  const correlations: string[] = [];
  if (numericCols.length >= 2) {
    const pairs: { a: string; b: string; r: number }[] = [];
    for (let i = 0; i < numericCols.length; i++) {
      for (let j = i + 1; j < numericCols.length; j++) {
        const r = pearsonCorrelation(numericCols[i].values, numericCols[j].values);
        pairs.push({ a: numericCols[i].header, b: numericCols[j].header, r });
      }
    }
    pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const notable = pairs.filter(p => Math.abs(p.r) >= 0.3).slice(0, 6);
    if (notable.length > 0) {
      correlations.push("Correlations (Pearson r, notable |r| ≥ 0.3):");
      for (const p of notable) {
        const strength = Math.abs(p.r) >= 0.7 ? "strong" : Math.abs(p.r) >= 0.5 ? "moderate" : "weak";
        const dir = p.r > 0 ? "positive" : "negative";
        correlations.push(`  ${p.a} × ${p.b}: r=${p.r.toFixed(3)} (${strength} ${dir})`);
      }
    }
  }

  const vizSuggestions: string[] = [];
  if (numericCols.length >= 2) {
    vizSuggestions.push(`Scatter plot: ${numericCols[0].header} vs ${numericCols[1].header}`);
  }
  if (numericCols.length >= 1) {
    vizSuggestions.push(`Bar chart / histogram: distribution of ${numericCols[0].header}`);
  }
  const catCol = columns.find(c => !c.isNumeric);
  if (catCol && numericCols.length >= 1) {
    vizSuggestions.push(`Grouped bar chart: ${numericCols[0].header} by ${catCol.header}`);
  }
  if (numericCols.length >= 3) {
    vizSuggestions.push(`Summary table: descriptive statistics for all numeric variables`);
  }

  const financialKeywords = /revenue|profit|loss|assets?|liabilities|equity|ebitda|eps|roe|roa|margin|cash\s*flow|income|expense|dividend|debt|capital|interest|depreciation|amortization|inventory|receivable|payable|balance\s*sheet|net\s*worth|gross|operating|retained|earnings|turnover/i;
  const allHeaders = headers.join(" ");
  const isFinancialData = financialKeywords.test(allHeaders);

  let financialAnalysis = "";
  if (isFinancialData) {
    const financialMetrics: string[] = [];

    const findCol = (pattern: RegExp) => numericCols.find(c => pattern.test(c.header));
    const revenue = findCol(/revenue|sales|turnover|income/i);
    const costOrExp = findCol(/cost|expense|cogs/i);
    const netIncome = findCol(/net\s*(income|profit|earnings)/i);
    const totalAssets = findCol(/total\s*assets/i);
    const totalEquity = findCol(/(total\s*)?equity|net\s*worth|shareholder/i);
    const totalLiab = findCol(/(total\s*)?liabilities|debt/i);

    if (revenue && costOrExp) {
      const revVals = revenue.values;
      const costVals = costOrExp.values;
      const margins = revVals.map((r, i) => i < costVals.length && r !== 0 ? ((r - costVals[i]) / r * 100) : NaN).filter(v => !isNaN(v));
      if (margins.length > 0) {
        const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
        financialMetrics.push(`Gross Margin (avg): ${avgMargin.toFixed(2)}%`);
      }
    }
    if (revenue && netIncome) {
      const revVals = revenue.values;
      const niVals = netIncome.values;
      const npmMargins = revVals.map((r, i) => i < niVals.length && r !== 0 ? (niVals[i] / r * 100) : NaN).filter(v => !isNaN(v));
      if (npmMargins.length > 0) {
        const avgNPM = npmMargins.reduce((a, b) => a + b, 0) / npmMargins.length;
        financialMetrics.push(`Net Profit Margin (avg): ${avgNPM.toFixed(2)}%`);
      }
    }
    if (netIncome && totalAssets) {
      const niVals = netIncome.values;
      const taVals = totalAssets.values;
      const roas = taVals.map((ta, i) => i < niVals.length && ta !== 0 ? (niVals[i] / ta * 100) : NaN).filter(v => !isNaN(v));
      if (roas.length > 0) {
        financialMetrics.push(`Return on Assets (avg): ${(roas.reduce((a, b) => a + b, 0) / roas.length).toFixed(2)}%`);
      }
    }
    if (netIncome && totalEquity) {
      const niVals = netIncome.values;
      const eqVals = totalEquity.values;
      const roes = eqVals.map((eq, i) => i < niVals.length && eq !== 0 ? (niVals[i] / eq * 100) : NaN).filter(v => !isNaN(v));
      if (roes.length > 0) {
        financialMetrics.push(`Return on Equity (avg): ${(roes.reduce((a, b) => a + b, 0) / roes.length).toFixed(2)}%`);
      }
    }
    if (totalLiab && totalEquity) {
      const lVals = totalLiab.values;
      const eVals = totalEquity.values;
      const deRatios = eVals.map((eq, i) => i < lVals.length && eq !== 0 ? (lVals[i] / eq) : NaN).filter(v => !isNaN(v));
      if (deRatios.length > 0) {
        financialMetrics.push(`Debt-to-Equity Ratio (avg): ${(deRatios.reduce((a, b) => a + b, 0) / deRatios.length).toFixed(2)}`);
      }
    }
    if (totalLiab && totalAssets) {
      const lVals = totalLiab.values;
      const aVals = totalAssets.values;
      const daRatios = aVals.map((a, i) => i < lVals.length && a !== 0 ? (lVals[i] / a) : NaN).filter(v => !isNaN(v));
      if (daRatios.length > 0) {
        financialMetrics.push(`Debt-to-Assets Ratio (avg): ${(daRatios.reduce((a, b) => a + b, 0) / daRatios.length).toFixed(2)}`);
      }
    }

    if (revenue && revenue.values.length >= 2) {
      const vals = revenue.values;
      const growthRates: number[] = [];
      for (let i = 1; i < vals.length; i++) {
        if (vals[i - 1] !== 0) growthRates.push(((vals[i] - vals[i - 1]) / Math.abs(vals[i - 1])) * 100);
      }
      if (growthRates.length > 0) {
        financialMetrics.push(`Revenue Growth (period-over-period): ${growthRates.map(g => `${g.toFixed(1)}%`).join(", ")}`);
      }
    }

    if (financialMetrics.length > 0) {
      financialAnalysis = `\nFinancial Ratios & Metrics (computed from your data):\n${financialMetrics.join("\n")}\n`;
    }

    vizSuggestions.push("Waterfall chart: revenue to net income breakdown");
    vizSuggestions.push("Multi-period bar chart: key financial metrics over time");
    if (totalLiab && totalEquity) vizSuggestions.push("Stacked bar chart: capital structure (debt vs equity)");
  }

  const previewRows = rows.slice(0, 5);
  const tableHeader = `| ${headers.join(" | ")} |`;
  const tableSep = `| ${headers.map(() => "---").join(" | ")} |`;
  const tableBody = previewRows.map(r => `| ${headers.map((_, i) => r[i] ?? "").join(" | ")} |`).join("\n");

  return `STUDENT-PROVIDED DATASET (${totalRows} rows × ${headers.length} columns)
Variables: ${headers.join(", ")}

Data Preview (first ${Math.min(5, totalRows)} rows):
${tableHeader}
${tableSep}
${tableBody}

Descriptive Statistics:
${colStats.join("\n")}
${correlations.length > 0 ? "\n" + correlations.join("\n") : ""}${financialAnalysis}

Suggested Visualisations (describe these in the paper using the actual data values):
${vizSuggestions.map((v, i) => `${i + 1}. ${v}`).join("\n")}

MANDATORY DATA USAGE RULES:
1. Present and discuss the ACTUAL statistics above — never invent alternative numbers
2. Include at least one properly formatted markdown table showing key statistics
3. Reference specific values (means, SD, ranges, correlations) with precision
4. Interpret what the specific results mean in context of the question or subject
5. Report trends, patterns, or notable distributions observed in the data
6. Describe at least one visualisation (chart/graph) in text — explain what it shows using the real data values
7. If correlations are provided, discuss their strength, direction, and practical significance
8. Use quartiles and IQR to discuss data spread and identify potential outliers${isFinancialData ? `
9. Present ALL computed financial ratios and interpret them against industry benchmarks
10. Calculate and discuss year-over-year or period-over-period growth rates
11. Perform horizontal (trend) and vertical (common-size) analysis where applicable
12. Discuss financial health, solvency, liquidity, and profitability based on the ratios` : ""}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Chart generation — structured specs the frontend renders with recharts.
// Built from the SAME computed values as the text analysis, so figures and
// prose can never disagree. Fault-isolated: any parse problem returns [].
// ═══════════════════════════════════════════════════════════════════════════

export interface ChartSpec {
  id: string;
  type: "bar" | "line" | "scatter" | "histogram";
  title: string;
  xLabel: string;
  yLabel: string;
  xKey: string;
  series: Array<{ key: string; label: string }>;
  data: Array<Record<string, string | number>>;
}

const TIME_COL = /^(year|date|month|quarter|period|week|day|time|fy|term|semester)s?\b/i;

export function buildDatasetCharts(csvText: string): ChartSpec[] {
  try {
    const lines = csvText.trim().split("\n").filter(l => l.trim().length > 0);
    if (lines.length < 3) return [];
    const firstLine = lines[0];
    const sep = firstLine.split("\t").length > firstLine.split(",").length ? "\t" : ",";
    const parseRow = (line: string) => line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""));
    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(parseRow);

    const numericCols: { header: string; idx: number; values: number[] }[] = [];
    const catCols: { header: string; idx: number }[] = [];
    headers.forEach((header, idx) => {
      const raw = rows.map(r => r[idx] ?? "").filter(v => v.length > 0);
      const nums = raw.map(v => parseFloat(v.replace(/,/g, ""))).filter(v => !isNaN(v));
      if (nums.length >= raw.length * 0.7 && nums.length >= 3) numericCols.push({ header, idx, values: nums });
      else catCols.push({ header, idx });
    });
    if (numericCols.length === 0) return [];

    const charts: ChartSpec[] = [];
    const safe = (s: string) => s.replace(/[^A-Za-z0-9 _.%()/-]/g, "").slice(0, 60) || "value";

    // 1) Time series line — a time-like column (categorical or numeric year) vs numerics
    const timeCat = catCols.find(c => TIME_COL.test(c.header));
    const timeNum = numericCols.find(c => TIME_COL.test(c.header));
    const timeCol = timeCat ?? timeNum;
    if (timeCol) {
      const ySeries = numericCols.filter(c => c.header !== timeCol.header).slice(0, 3);
      if (ySeries.length > 0) {
        const data = rows.slice(0, 60).map(r => {
          const rec: Record<string, string | number> = { x: r[timeCol.idx] ?? "" };
          for (const s of ySeries) {
            const v = parseFloat((r[s.idx] ?? "").replace(/,/g, ""));
            if (!isNaN(v)) rec[safe(s.header)] = v;
          }
          return rec;
        }).filter(rec => rec.x !== "" && Object.keys(rec).length > 1);
        if (data.length >= 3) {
          charts.push({
            id: "trend", type: "line",
            title: `${ySeries.map(s => s.header).join(", ")} over ${timeCol.header}`,
            xLabel: timeCol.header, yLabel: ySeries.length === 1 ? ySeries[0].header : "Value",
            xKey: "x",
            series: ySeries.map(s => ({ key: safe(s.header), label: s.header })),
            data,
          });
        }
      }
    }

    // 2) Histogram of the primary numeric column (10 bins)
    const primary = numericCols.find(c => !TIME_COL.test(c.header)) ?? numericCols[0];
    if (primary.values.length >= 5) {
      const min = Math.min(...primary.values), max = Math.max(...primary.values);
      if (max > min) {
        const BINS = 10;
        const width = (max - min) / BINS;
        const counts = new Array(BINS).fill(0);
        for (const v of primary.values) counts[Math.min(BINS - 1, Math.floor((v - min) / width))]++;
        charts.push({
          id: "distribution", type: "histogram",
          title: `Distribution of ${primary.header}`,
          xLabel: primary.header, yLabel: "Frequency", xKey: "bin",
          series: [{ key: "count", label: "Frequency" }],
          data: counts.map((count, i) => ({
            bin: `${(min + i * width).toFixed(1)}–${(min + (i + 1) * width).toFixed(1)}`,
            count,
          })),
        });
      }
    }

    // 3) Scatter of the strongest-correlated numeric pair (falls back to first two)
    if (numericCols.length >= 2) {
      let a = numericCols[0], b = numericCols[1], bestR = -1;
      for (let i = 0; i < numericCols.length; i++) {
        for (let j = i + 1; j < numericCols.length; j++) {
          const r = Math.abs(pearsonCorrelation(numericCols[i].values, numericCols[j].values));
          if (r > bestR) { bestR = r; a = numericCols[i]; b = numericCols[j]; }
        }
      }
      const n = Math.min(a.values.length, b.values.length, 200);
      charts.push({
        id: "relationship", type: "scatter",
        title: `${a.header} vs ${b.header}`,
        xLabel: a.header, yLabel: b.header, xKey: "x",
        series: [{ key: "y", label: b.header }],
        data: Array.from({ length: n }, (_, i) => ({ x: a.values[i], y: b.values[i] })),
      });
    }

    // 4) Category means bar — mean of primary numeric grouped by first categorical (≤8 groups)
    const groupCol = catCols.find(c => !TIME_COL.test(c.header));
    if (groupCol) {
      const groups: Record<string, number[]> = {};
      rows.forEach(r => {
        const g = r[groupCol.idx] ?? "";
        const v = parseFloat((r[primary.idx] ?? "").replace(/,/g, ""));
        if (g && !isNaN(v)) (groups[g] ??= []).push(v);
      });
      const entries = Object.entries(groups)
        .map(([g, vals]) => ({ g, mean: vals.reduce((x, y) => x + y, 0) / vals.length, n: vals.length }))
        .sort((x, y) => y.mean - x.mean)
        .slice(0, 8);
      if (entries.length >= 2) {
        charts.push({
          id: "group-means", type: "bar",
          title: `Mean ${primary.header} by ${groupCol.header}`,
          xLabel: groupCol.header, yLabel: `Mean ${primary.header}`, xKey: "group",
          series: [{ key: "mean", label: `Mean ${primary.header}` }],
          data: entries.map(e => ({ group: e.g.slice(0, 24), mean: Number(e.mean.toFixed(3)) })),
        });
      }
    }

    return charts.slice(0, 4);
  } catch {
    return [];
  }
}

/** Figure list + placement instructions for the writer prompt. The paper must
 *  BOTH reference each figure by number AND place a [[FIGURE:n]] marker where
 *  it belongs — the app renders the real chart at that exact position, so the
 *  figures are part of the delivered paper (view and exports), not a side tab. */
export function describeChartsForPrompt(charts: ChartSpec[]): string {
  if (charts.length === 0) return "";
  return `\nRENDERED FIGURES (generated from the student's actual data — these are real charts embedded in the paper):
${charts.map((c, i) => `Figure ${i + 1}: ${c.title} (${c.type})`).join("\n")}

FIGURE PLACEMENT RULES (mandatory):
1. Place the literal marker [[FIGURE:1]] on its own line at the point in the Results/Findings/Analysis section where Figure 1 belongs — likewise [[FIGURE:2]], etc. Use each marker exactly once.
2. Reference each figure in the surrounding prose by number ("as shown in Figure 1") and interpret what it shows using the real computed values above.
3. Never invent figures beyond this list and never describe a chart that is not listed.\n`;
}
