import type { ChartSpecUI } from "@/components/PaperCharts";

// ─────────────────────────────────────────────────────────────────────────────
// Text representations of paper figures for exports (DOCX / PDF / copy).
// Deliberately recharts-free so importing this never pulls the chart bundle
// into the critical path — PaperCharts stays lazy.
//
// The backend writer places [[FIGURE:n]] markers in the paper body; on screen
// the marker renders the live chart, and in exports it becomes a numbered
// figure caption + a data table built from the same computed values, so the
// exported document is complete and self-contained.
// ─────────────────────────────────────────────────────────────────────────────

export const FIGURE_MARKER = /\[\[FIGURE:(\d+)\]\]/g;

/** Markdown table of a chart's data (rows capped to keep documents readable). */
export function chartToMarkdownTable(spec: ChartSpecUI, figureNumber: number, maxRows = 12): string {
  const xHeader = spec.xLabel || spec.xKey;
  const seriesHeaders = spec.series.map((s) => s.label || s.key);
  const header = `| ${[xHeader, ...seriesHeaders].join(" | ")} |`;
  const sep = `| ${[xHeader, ...seriesHeaders].map(() => "---").join(" | ")} |`;
  const rows = spec.data.slice(0, maxRows).map((row) => {
    const cells = [row[spec.xKey], ...spec.series.map((s) => row[s.key])]
      .map((v) => (typeof v === "number" ? v.toLocaleString() : String(v ?? "")));
    return `| ${cells.join(" | ")} |`;
  });
  const truncated = spec.data.length > maxRows ? `\n*(showing first ${maxRows} of ${spec.data.length} data points)*` : "";
  return `**Figure ${figureNumber}. ${spec.title}**\n\n${header}\n${sep}\n${rows.join("\n")}${truncated}`;
}

/** Replace [[FIGURE:n]] markers with caption + data table for text exports.
 *  Any marker without a matching chart is stripped rather than leaked. */
export function inlineChartsIntoMarkdown(content: string, charts: ChartSpecUI[] | undefined): string {
  if (!charts || charts.length === 0) return content.replace(FIGURE_MARKER, "");
  return content.replace(FIGURE_MARKER, (_m, nStr: string) => {
    const idx = parseInt(nStr, 10) - 1;
    const spec = charts[idx];
    return spec ? `\n${chartToMarkdownTable(spec, idx + 1)}\n` : "";
  });
}
