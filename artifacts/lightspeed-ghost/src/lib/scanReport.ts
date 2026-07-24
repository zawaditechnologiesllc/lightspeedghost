// ── Scan report: inline highlighting + downloadable evidence copy ─────────────
// Lightweight, dependency-free (safe to import on the landing critical path — it
// pulls in no docx/pdf libraries). Two jobs:
//   1. buildHighlightSegments() — locate AI + plagiarism snippets inside the
//      user's original text and return ordered segments so the UI can render a
//      Turnitin-style colour-coded document ("exactly where" the flags are).
//   2. buildScanReportHtml() + downloadScanReport() — turn the same data into a
//      self-contained, printable HTML file the user can download and keep as
//      evidence (delivers on the "Downloadable report" promise).

export type HighlightType = "ai" | "plag";
export interface HighlightSegment {
  text: string;
  type: HighlightType | null;
}

interface Range {
  start: number;
  end: number;
  type: HighlightType;
}

// Find every case-insensitive occurrence of each snippet in `text` and return
// ordered, non-overlapping segments. Plagiarism takes visual priority over AI.
export function buildHighlightSegments(
  text: string,
  aiSnippets: string[],
  plagSnippets: string[],
): HighlightSegment[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const ranges: Range[] = [];

  const collect = (snippets: string[], type: HighlightType) => {
    for (const raw of snippets) {
      const snippet = (raw ?? "").trim();
      // Ignore tiny fragments — they produce noisy, unreliable highlights.
      if (snippet.length < 12) continue;
      const needle = snippet.toLowerCase();
      let from = 0;
      while (from <= lower.length) {
        const idx = lower.indexOf(needle, from);
        if (idx === -1) break;
        ranges.push({ start: idx, end: idx + snippet.length, type });
        from = idx + snippet.length;
      }
    }
  };

  // Collect plagiarism first so it wins ties during overlap resolution.
  collect(plagSnippets, "plag");
  collect(aiSnippets, "ai");

  if (ranges.length === 0) return [{ text, type: null }];

  // Sort by start; on a tie, plagiarism before AI, then longer first.
  ranges.sort(
    (a, b) =>
      a.start - b.start ||
      (a.type === b.type ? 0 : a.type === "plag" ? -1 : 1) ||
      b.end - a.end,
  );

  // Greedily drop overlaps (the first in sort order wins its span).
  const merged: Range[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start < last.end) {
      if (r.type === last.type && r.end > last.end) last.end = r.end;
      continue;
    }
    merged.push({ ...r });
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) segments.push({ text: text.slice(cursor, r.start), type: null });
    segments.push({ text: text.slice(r.start, r.end), type: r.type });
    cursor = r.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), type: null });
  return segments;
}

export function countHighlights(segments: HighlightSegment[]): { ai: number; plag: number } {
  let ai = 0;
  let plag = 0;
  for (const s of segments) {
    if (s.type === "ai") ai++;
    else if (s.type === "plag") plag++;
  }
  return { ai, plag };
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ScanReportSource {
  url: string;
  similarity: number;
  matchedText?: string;
  title?: string;
}

export interface ScanReportData {
  text: string;
  segments: HighlightSegment[];
  wordCount: number;
  /** Instant, in-browser AI-likelihood score (0–100). */
  aiLikelihood?: number;
  aiVerdict?: string;
  /** Full-scan measured scores (present only after the server scan). */
  scanAiScore?: number;
  similarity?: number;
  risk?: string;
  detectionModel?: string;
  sources?: ScanReportSource[];
  flaggedSentences?: Array<{ text: string; score: number }>;
}

function renderSegmentsHtml(segments: HighlightSegment[]): string {
  return segments
    .map((s) => {
      const t = esc(s.text).replace(/\n/g, "<br/>");
      if (s.type === "ai") return `<mark class="ai">${t}</mark>`;
      if (s.type === "plag") return `<mark class="plag">${t}</mark>`;
      return t;
    })
    .join("");
}

// Build a self-contained, printable HTML report (open in any browser → Print → PDF).
export function buildScanReportHtml(data: ScanReportData): string {
  const now = new Date();
  const stamp = now.toLocaleString();
  const counts = countHighlights(data.segments);

  const scoreCard = (label: string, value: string, tone: "green" | "amber" | "red" | "muted") =>
    `<div class="card ${tone}"><div class="v">${esc(value)}</div><div class="l">${esc(label)}</div></div>`;

  const toneFor = (score?: number): "green" | "amber" | "red" | "muted" => {
    if (score == null) return "muted";
    if (score < 35) return "green";
    if (score < 65) return "amber";
    return "red";
  };

  const cards: string[] = [];
  if (data.scanAiScore != null) cards.push(scoreCard("AI content", `${Math.round(data.scanAiScore)}%`, toneFor(data.scanAiScore)));
  else if (data.aiLikelihood != null) cards.push(scoreCard("AI-likelihood", `${Math.round(data.aiLikelihood)}%`, toneFor(data.aiLikelihood)));
  if (data.similarity != null) cards.push(scoreCard("Similarity", `${Math.round(data.similarity)}%`, toneFor(data.similarity)));
  if (data.risk) cards.push(scoreCard("Overall risk", data.risk, data.risk === "low" ? "green" : data.risk === "high" ? "red" : "amber"));
  cards.push(scoreCard("Words", String(data.wordCount), "muted"));

  const sourcesHtml =
    data.sources && data.sources.length
      ? `<h2>Matching sources</h2><ol class="sources">${data.sources
          .map(
            (s) =>
              `<li><a href="${esc(s.url)}">${esc(s.title || s.url)}</a> <span class="sim">${Math.round(s.similarity)}%</span>${
                s.matchedText ? `<div class="snip">“${esc(s.matchedText.slice(0, 240))}”</div>` : ""
              }</li>`,
          )
          .join("")}</ol>`
      : "";

  const flaggedHtml =
    data.flaggedSentences && data.flaggedSentences.length
      ? `<h2>Most AI-sounding sentences</h2><ul class="flagged">${data.flaggedSentences
          .map((f) => `<li><span class="pct">${Math.round(f.score)}%</span> ${esc(f.text)}</li>`)
          .join("")}</ul>`
      : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Light Speed Ghost — AI &amp; Plagiarism Report</title>
<style>
  :root { --green:#10b981; --ink:#131b2e; --muted:#76777d; }
  * { box-sizing:border-box; }
  body { font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:var(--ink); margin:0; background:#f4faf6; }
  .wrap { max-width:820px; margin:0 auto; padding:32px 24px 56px; }
  header { display:flex; align-items:center; gap:10px; border-bottom:2px solid #d1fae5; padding-bottom:14px; margin-bottom:20px; }
  .logo { width:26px; height:26px; border-radius:7px; background:linear-gradient(135deg,#10b981,#0d9488); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:15px; }
  header .name { font-weight:800; font-size:16px; }
  header .meta { margin-left:auto; text-align:right; font-size:11px; color:var(--muted); }
  .cards { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px; }
  .card { flex:1; min-width:110px; border:1px solid #e0e3e5; border-radius:12px; padding:12px 14px; text-align:center; background:#fff; }
  .card .v { font-size:22px; font-weight:800; }
  .card .l { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin-top:2px; }
  .card.green .v{color:#059669;} .card.green{background:#ecfdf5;border-color:#a7f3d0;}
  .card.amber .v{color:#b45309;} .card.amber{background:#fffbeb;border-color:#fde68a;}
  .card.red .v{color:#b91c1c;} .card.red{background:#fef2f2;border-color:#fecaca;}
  .card.muted .v{color:var(--ink);}
  .legend { font-size:12px; color:var(--muted); margin:6px 0 14px; }
  .legend mark { padding:1px 6px; border-radius:4px; }
  h2 { font-size:14px; margin:24px 0 8px; }
  .doc { border:1px solid #e0e3e5; border-radius:12px; padding:18px 20px; background:#fff; line-height:1.8; font-size:14px; white-space:pre-wrap; word-wrap:break-word; }
  mark.ai   { background:#fef08a; color:#713f12; border-radius:3px; padding:0 2px; }
  mark.plag { background:#fecaca; color:#7f1d1d; border-radius:3px; padding:0 2px; }
  .sources { padding-left:18px; font-size:13px; }
  .sources li { margin-bottom:8px; }
  .sources a { color:#0d9488; }
  .sim { color:var(--muted); font-weight:700; font-size:11px; }
  .snip { color:var(--muted); font-style:italic; font-size:12px; margin-top:2px; }
  .flagged { padding-left:18px; font-size:13px; }
  .flagged .pct { font-weight:800; color:#b45309; }
  footer { margin-top:28px; padding-top:14px; border-top:1px solid #e0e3e5; font-size:11px; color:var(--muted); line-height:1.6; }
  @media print { body { background:#fff; } .doc,.card { break-inside:avoid; } }
</style></head>
<body><div class="wrap">
  <header>
    <span class="logo">⚡</span>
    <span class="name">Light Speed Ghost — AI &amp; Plagiarism Report</span>
    <span class="meta">Generated ${esc(stamp)}<br/>Report is a writing aid, not a verdict — always review before submitting.</span>
  </header>
  <div class="cards">${cards.join("")}</div>
  <div class="legend">
    <mark class="ai">Highlighted</mark> = AI-flagged (${counts.ai}) &nbsp;·&nbsp;
    <mark class="plag">Highlighted</mark> = matched to a source (${counts.plag})
  </div>
  <h2>Your document</h2>
  <div class="doc">${renderSegmentsHtml(data.segments)}</div>
  ${sourcesHtml}
  ${flaggedHtml}
  <footer>
    ${data.detectionModel ? `Detection engine: ${esc(data.detectionModel)}.<br/>` : ""}
    Similarity is measured against live academic sources; AI-likelihood uses statistical detection (burstiness + perplexity). Detectors are not infallible — use this report to review and improve your own work, not as proof of authorship.
    <br/>© ${now.getFullYear()} Light Speed Ghost · lightspeedghost.com
  </footer>
</div></body></html>`;
}

export function downloadScanReport(html: string, filename = "lightspeedghost-report.html"): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
