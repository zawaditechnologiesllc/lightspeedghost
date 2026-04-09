export const ACADEMIC_CSS = `
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.8;
         max-width: 750px; margin: 60px auto; color: #111; padding: 0 40px; }
  h1 { font-size: 16pt; text-align: center; margin-bottom: 6px; }
  h2 { font-size: 13pt; margin-top: 28px; margin-bottom: 8px; }
  h3 { font-size: 12pt; margin-top: 18px; margin-bottom: 6px; }
  p  { margin-bottom: 12px; text-align: justify; }
  ul, ol { margin: 0 0 12px 0; padding-left: 24px; }
  li { margin-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; font-size: 11pt; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #f0f0f0; font-weight: bold; }
  .score-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
  .score-card { border: 1px solid #ddd; border-radius: 8px; padding: 14px; text-align: center; }
  .score-value { font-size: 28pt; font-weight: bold; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-weight: bold; font-size: 10pt; }
  .safe   { background: #d1fae5; color: #065f46; }
  .warn   { background: #fef3c7; color: #92400e; }
  .danger { background: #fee2e2; color: #991b1b; }
  .highlight { background: #fff8dc; border-left: 3px solid #e5a000; padding: 8px 12px; margin: 8px 0; }
  .footer { margin-top: 48px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 9pt; color: #888; }
  @media print { body { margin: 0.5in; } }
`;

export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function mdToBodyHtml(md: string): string {
  return md
    .replace(/^### (.*)/gm, "<h3>$1</h3>")
    .replace(/^## (.*)/gm, "<h2>$1</h2>")
    .replace(/^# (.*)/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .split("\n\n")
    .map((p) => (p.startsWith("<h") ? p : `<p>${p.replace(/\n/g, "<br>")}</p>`))
    .join("\n");
}

export function wrapDocHtml(title: string, bodyHtml: string, subtitle?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${escHtml(title)}</title>
<style>${ACADEMIC_CSS}</style>
</head>
<body>
<h1>${escHtml(title)}</h1>
${subtitle ? `<p style="text-align:center;color:#888;margin-bottom:24px;font-size:11pt">${escHtml(subtitle)}</p>` : ""}
${bodyHtml}
<div class="footer">LightSpeed Ghost &middot; lightspeedghost.com</div>
</body>
</html>`;
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

/** Legacy .doc — HTML wrapped with Word MIME type */
export function exportAsWord(html: string, filename: string): void {
  triggerDownload(
    new Blob([html], { type: "application/msword" }),
    `${filename}.doc`
  );
}

/** .doc — HTML content with Word MIME type (opens correctly in Microsoft Word and Google Docs) */
export function exportAsDocx(html: string, filename: string): void {
  triggerDownload(
    new Blob([html], { type: "application/msword" }),
    `${filename}.doc`
  );
}

/** PDF via browser print dialog — preserves all styling */
export function exportAsPDF(html: string): void {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

/** Plain text file */
export function exportAsTxt(text: string, filename: string): void {
  triggerDownload(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
    `${filename}.txt`
  );
}

/** Markdown file */
export function exportAsMd(text: string, filename: string): void {
  triggerDownload(
    new Blob([text], { type: "text/markdown;charset=utf-8" }),
    `${filename}.md`
  );
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
