/**
 * Shared dataset parsing + descriptive statistics utility.
 * Used by Write Paper, Study Assistant, and STEM Solver backends.
 */

export function parseAndAnalyzeDataset(csvText: string): string {
  const lines = csvText.trim().split("\n").filter(l => l.trim().length > 0);
  if (lines.length < 2) return "";

  const firstLine = lines[0];
  const sep = firstLine.split("\t").length > firstLine.split(",").length ? "\t" : ",";
  const parseRow = (line: string) => line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""));

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  const totalRows = rows.length;

  const colStats: string[] = [];
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
      colStats.push(
        `**${header}** (n=${n}): mean=${mean.toFixed(3)}, median=${median.toFixed(3)}, SD=${stdDev.toFixed(3)}, min=${sorted[0]}, max=${sorted[n - 1]}`
      );
    } else {
      const counts: Record<string, number> = {};
      rawValues.forEach(v => { counts[v] = (counts[v] ?? 0) + 1; });
      const topCats = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
      colStats.push(`**${header}** (categorical, n=${rawValues.length}): ${topCats.map(([v, c]) => `${v}=${c}`).join(", ")}`);
    }
  });

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

MANDATORY DATA USAGE RULES:
1. Present and discuss the ACTUAL statistics above — never invent alternative numbers
2. Include at least one properly formatted markdown table showing key statistics
3. Reference specific values (means, SD, ranges) with precision
4. Interpret what the specific results mean in context of the question or subject
5. Report trends, patterns, or notable distributions observed in the data`;
}
