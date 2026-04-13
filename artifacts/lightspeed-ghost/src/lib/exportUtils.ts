import katex from "katex";
import MarkdownIt from "markdown-it";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Footer,
  PageNumber,
  NumberFormat,
} from "docx";

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

export function mathToHtml(text: string): string {
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    result += escHtml(text.slice(lastIndex, match.index));

    if (match[1] !== undefined) {
      try {
        result += `<div class="math-block">${katex.renderToString(match[1].trim(), { displayMode: true, throwOnError: false, trust: false })}</div>`;
      } catch {
        result += `<div class="math-block"><code>$$${escHtml(match[1])}$$</code></div>`;
      }
    } else if (match[2] !== undefined) {
      try {
        result += katex.renderToString(match[2].trim(), { displayMode: false, throwOnError: false, trust: false });
      } catch {
        result += `<code>$${escHtml(match[2])}$</code>`;
      }
    }
    lastIndex = match.index + match[0].length;
  }

  result += escHtml(text.slice(lastIndex));
  return result;
}

function renderMathTokens(html: string): string {
  return html.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (_full, block, inline) => {
    if (block !== undefined) {
      try { return `<div class="math-block">${katex.renderToString(block.trim(), { displayMode: true, throwOnError: false, trust: false })}</div>`; } catch { return `<code>$$${escHtml(block)}$$</code>`; }
    }
    try { return katex.renderToString(inline.trim(), { displayMode: false, throwOnError: false, trust: false }); } catch { return `<code>$${escHtml(inline)}$</code>`; }
  });
}

export function richToHtml(text: string): string {
  const html = md.render(text);
  return renderMathTokens(html);
}

// ── HTML helpers ───────────────────────────────────────────────────────────────

export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function mdToBodyHtml(mdText: string): string {
  return richToHtml(mdText);
}

// ── CSS ────────────────────────────────────────────────────────────────────────

/** KaTeX CSS served from CDN — required for math to display correctly */
const KATEX_CDN_LINK = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous">`;

/**
 * Modern clean stylesheet that matches the LightSpeed Ghost website aesthetic.
 * Replaces the old Times New Roman academic style.
 */
export const EXPORT_CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.75;
    max-width: 740px;
    margin: 48px auto;
    color: #1a1a2e;
    padding: 0 40px;
    background: #fff;
  }
  h1 { font-size: 18pt; font-weight: 700; margin: 0 0 6px 0; color: #111; letter-spacing: -0.02em; }
  h2 { font-size: 13pt; font-weight: 700; margin: 28px 0 10px 0; color: #111; border-bottom: 1.5px solid #e5e7eb; padding-bottom: 5px; }
  h3 { font-size: 11.5pt; font-weight: 600; margin: 20px 0 6px 0; color: #374151; }
  p  { margin: 0 0 12px 0; color: #374151; }
  ul, ol { margin: 0 0 12px 0; padding-left: 22px; }
  li { margin-bottom: 5px; color: #374151; }
  code {
    font-family: "JetBrains Mono", "Fira Code", "Courier New", monospace;
    font-size: 10pt;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 1px 5px;
    color: #6366f1;
  }
  pre {
    background: #f8f9fb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 14px 18px;
    overflow-x: auto;
    margin: 12px 0;
  }
  pre code { background: none; border: none; padding: 0; color: inherit; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 10.5pt; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
  th { background: #f9fafb; font-weight: 600; color: #111; }

  /* Math */
  .math-block { margin: 16px 0; overflow-x: auto; text-align: center; }
  .katex-display { margin: 0.5em 0; }
  .katex { font-size: 1.05em; }

  /* Document header */
  .doc-header { margin-bottom: 28px; border-bottom: 2px solid #6366f1; padding-bottom: 16px; }
  .doc-meta { font-size: 9.5pt; color: #9ca3af; margin-top: 4px; }
  .lsg-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 9pt; font-weight: 600; color: #6366f1;
    background: #eef2ff; border: 1px solid #c7d2fe;
    border-radius: 20px; padding: 2px 10px; margin-bottom: 8px;
  }

  /* Answer / result block */
  .answer-block {
    background: #f0fdf4; border: 1.5px solid #bbf7d0;
    border-radius: 10px; padding: 16px 20px; margin: 16px 0;
  }
  .answer-label { font-size: 9pt; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }

  /* Steps */
  .step {
    border-left: 3px solid #6366f1; padding: 10px 16px; margin: 10px 0;
    background: #f8f9ff; border-radius: 0 8px 8px 0;
  }
  .step-label { font-size: 9pt; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .step-expr { font-family: "JetBrains Mono", monospace; font-size: 10pt; color: #4f46e5; margin: 6px 0; }

  /* Corrections */
  .corrections { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 10px; padding: 14px 18px; margin: 14px 0; }
  .corrections-label { font-size: 9pt; font-weight: 700; color: #d97706; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }

  /* Confidence badge */
  .confidence { display: inline-block; background: #eef2ff; color: #4f46e5; font-weight: 700; font-size: 9.5pt; border-radius: 6px; padding: 3px 10px; border: 1px solid #c7d2fe; }

  /* Verification badge */
  .verified { display: inline-block; background: #f0fdf4; color: #15803d; font-weight: 700; font-size: 9.5pt; border-radius: 6px; padding: 3px 10px; border: 1px solid #bbf7d0; margin-left: 8px; }

  /* Section divider */
  .section-rule { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }

  /* Highlight / callout */
  .highlight { background: #fefce8; border-left: 3px solid #eab308; padding: 10px 14px; margin: 12px 0; border-radius: 0 6px 6px 0; }

  /* Footer */
  .footer {
    margin-top: 52px; border-top: 1px solid #e5e7eb; padding-top: 14px;
    font-size: 8.5pt; color: #9ca3af; display: flex; justify-content: space-between;
  }

  @media print {
    body { margin: 0.4in 0.5in; }
    .step, .answer-block, .corrections { break-inside: avoid; }
  }
`;

// ── Document wrapper ───────────────────────────────────────────────────────────

export interface DocMeta {
  title: string;
  subtitle?: string;
  type?: string;
  date?: string;
}

export function wrapDocHtml(title: string, bodyHtml: string, subtitle?: string): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(title)}</title>
  ${KATEX_CDN_LINK}
  <style>${EXPORT_CSS}</style>
</head>
<body>
  <div class="doc-header">
    <div class="lsg-badge">⚡ LightSpeed Ghost</div>
    <h1>${escHtml(title)}</h1>
    ${subtitle ? `<div class="doc-meta">${escHtml(subtitle)}</div>` : ""}
    <div class="doc-meta">${escHtml(date)} · lightspeedghost.com</div>
  </div>
  ${bodyHtml}
  <div class="footer">
    <span>LightSpeed Ghost · lightspeedghost.com</span>
    <span>Generated ${escHtml(date)}</span>
  </div>
</body>
</html>`;
}

// ── Per-tool HTML builders ─────────────────────────────────────────────────────

export interface StemExportData {
  problem: string;
  subject: string;
  answer: string;
  steps: Array<{ stepNumber: number; description: string; expression?: string; explanation: string }>;
  corrections?: string[];
  confidence?: number;
  passedVerification?: boolean;
  latex?: string;
}

export function buildStemExportHtml(data: StemExportData): string {
  const subjectLabel = data.subject.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const confPct = data.confidence !== undefined
    ? Math.round(data.confidence <= 1 ? data.confidence * 100 : data.confidence)
    : null;

  const parts: string[] = [];

  // Problem
  parts.push(`<h2>Problem</h2><p>${mathToHtml(data.problem)}</p>`);

  // Subject + confidence badges
  const badges = [`<span class="confidence">${escHtml(subjectLabel)}</span>`];
  if (confPct !== null) badges.push(`<span class="confidence">${confPct}% confidence</span>`);
  if (data.passedVerification) badges.push(`<span class="verified">✓ Verified</span>`);
  parts.push(`<p>${badges.join(" ")}</p>`);

  // Answer
  parts.push(`
<h2>Answer</h2>
<div class="answer-block">
  <div class="answer-label">✓ Solution</div>
  ${richToHtml(data.answer)}
  ${data.latex && data.latex !== "\\text{See solution above}" ? `<div class="math-block">${katex.renderToString(data.latex.replace(/^\$\$|\$\$$/g, "").trim(), { displayMode: true, throwOnError: false, trust: false })}</div>` : ""}
</div>`);

  // Corrections
  if (data.corrections && data.corrections.length > 0) {
    parts.push(`
<div class="corrections">
  <div class="corrections-label">⚠ Critic Agent Corrections (${data.corrections.length})</div>
  <ul>${data.corrections.map((c) => `<li>${mathToHtml(c)}</li>`).join("")}</ul>
</div>`);
  }

  // Steps
  if (data.steps.length > 0) {
    parts.push(`<h2>Step-by-Step Solution</h2>`);
    for (const step of data.steps) {
      const typeLabel = step.description === "Reasoning" ? "Thought"
        : step.description === "Action" ? "Action"
        : step.description === "Observation" ? "Observation"
        : step.description === "Final Answer" ? "Final Answer"
        : step.description;
      parts.push(`
<div class="step">
  <div class="step-label">Step ${step.stepNumber} — ${escHtml(typeLabel)}</div>
  ${step.expression ? `<div class="step-expr">${mathToHtml(step.expression)}</div>` : ""}
  <div>${richToHtml(step.explanation)}</div>
</div>`);
    }
  }

  const title = `STEM Solution — ${subjectLabel}`;
  const subtitle = `Problem: ${data.problem.slice(0, 100)}${data.problem.length > 100 ? "…" : ""}`;
  return wrapDocHtml(title, parts.join("\n"), subtitle);
}

// ── Download helpers ───────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAsWord(html: string, filename: string): void {
  triggerDownload(new Blob([html], { type: "application/msword" }), `${filename}.doc`);
}

function markdownToDocxParagraphs(text: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = text.split("\n");
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      inList = false;
      continue;
    }

    if (/^### /.test(trimmed)) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: parseInlineRuns(trimmed.replace(/^### /, "")),
        spacing: { before: 240, after: 80 },
      }));
    } else if (/^## /.test(trimmed)) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: parseInlineRuns(trimmed.replace(/^## /, "")),
        spacing: { before: 320, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" } },
      }));
    } else if (/^# /.test(trimmed)) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: parseInlineRuns(trimmed.replace(/^# /, "")),
        spacing: { before: 360, after: 160 },
      }));
    } else if (/^[-•*] /.test(trimmed)) {
      inList = true;
      paragraphs.push(new Paragraph({
        bullet: { level: 0 },
        children: parseInlineRuns(trimmed.replace(/^[-•*] /, "")),
        spacing: { before: 40, after: 40 },
      }));
    } else if (/^\d+\. /.test(trimmed)) {
      inList = true;
      paragraphs.push(new Paragraph({
        numbering: { reference: "decimal-numbering", level: 0 },
        children: parseInlineRuns(trimmed.replace(/^\d+\. /, "")),
        spacing: { before: 40, after: 40 },
      }));
    } else {
      paragraphs.push(new Paragraph({
        children: parseInlineRuns(trimmed),
        spacing: { before: inList ? 40 : 120, after: inList ? 40 : 120 },
      }));
    }
  }

  return paragraphs;
}

function parseInlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const pattern = /\*\*\*(.*?)\*\*\*|\*\*(.*?)\*\*|\*(.*?)\*|`([^`]+)`|([^*`]+)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m[1] !== undefined) {
      runs.push(new TextRun({ text: m[1], bold: true, italics: true, font: "Inter" }));
    } else if (m[2] !== undefined) {
      runs.push(new TextRun({ text: m[2], bold: true, font: "Inter" }));
    } else if (m[3] !== undefined) {
      runs.push(new TextRun({ text: m[3], italics: true, font: "Inter" }));
    } else if (m[4] !== undefined) {
      runs.push(new TextRun({ text: m[4], font: "Courier New", size: 20 }));
    } else if (m[5] !== undefined) {
      runs.push(new TextRun({ text: m[5], font: "Inter" }));
    }
  }
  return runs.length > 0 ? runs : [new TextRun({ text, font: "Inter" })];
}

export async function exportAsDocx(markdownText: string, filename: string, title?: string): Promise<void> {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const headerParagraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "LightSpeed Ghost", font: "Inter", size: 16, color: "6366F1", bold: true })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: title || filename, font: "Inter", bold: true })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `${date} · lightspeedghost.com`, font: "Inter", size: 18, color: "9CA3AF" })],
      spacing: { after: 320 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "6366F1" } },
    }),
  ];

  const bodyParagraphs = markdownToDocxParagraphs(markdownText);

  const doc = new Document({
    numbering: {
      config: [{
        reference: "decimal-numbering",
        levels: [{ level: 0, format: NumberFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT }],
      }],
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children: [...headerParagraphs, ...bodyParagraphs],
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "LightSpeed Ghost · lightspeedghost.com · Page ", font: "Inter", size: 16, color: "9CA3AF" }),
                new TextRun({ children: [PageNumber.CURRENT], font: "Inter", size: 16, color: "9CA3AF" }),
              ],
            }),
          ],
        }),
      },
    }],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${filename}.docx`);
}

/** PDF via browser print dialog — opens a styled window then triggers print */
export function exportAsPDF(html: string): void {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give KaTeX CDN time to load before printing
  setTimeout(() => win.print(), 900);
}

/** Plain text file */
export function exportAsTxt(text: string, filename: string): void {
  triggerDownload(new Blob([text], { type: "text/plain;charset=utf-8" }), `${filename}.txt`);
}

/** Markdown file */
export function exportAsMd(text: string, filename: string): void {
  triggerDownload(new Blob([text], { type: "text/markdown;charset=utf-8" }), `${filename}.md`);
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

// ── LSG filename helper ────────────────────────────────────────────────────────

const LSG_TYPE_CODES: Record<string, string> = {
  paper:      "WP",
  outline:    "OT",
  revision:   "RV",
  humanizer:  "HN",
  plagiarism: "AP",
  stem:       "SS",
  study:      "ASA",
};

export function makeLsgFilename(
  type: "paper" | "outline" | "revision" | "humanizer" | "plagiarism" | "stem" | "study",
  label?: string
): string {
  const code = LSG_TYPE_CODES[type] ?? type.toUpperCase();
  const date = new Date();
  const seq = String(date.getMonth() + 1).padStart(2, "0") + String(date.getDate()).padStart(2, "0");
  const slug = label
    ? label.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30)
    : null;
  return slug ? `LSG-${code}${seq}-${slug}` : `LSG-${code}${seq}`;
}

// Keep legacy export
export const ACADEMIC_CSS = EXPORT_CSS;
