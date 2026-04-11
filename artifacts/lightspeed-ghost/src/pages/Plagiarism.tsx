import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useCheckPlagiarism, useHumanizeText, compareCode } from "@workspace/api-client-react";
import type { PlagiarismResult, CodeCompareResult } from "@workspace/api-client-react";
import {
  ShieldCheck, ShieldAlert, Zap, AlertTriangle, Code2, FileText,
  ExternalLink, Info, Download, Copy, CheckCheck, FileEdit,
  PenLine, ChevronRight, RefreshCcw, BarChart3, X, Wand2,
} from "lucide-react";
import FullscreenLoader from "@/components/FullscreenLoader";
import { Slider } from "@/components/ui/slider";
import { Link, useLocation } from "wouter";
import FileUploadZone, { type ExtractedFile } from "@/components/FileUploadZone";
import { cn } from "@/lib/utils";
import { ExportButtons } from "@/components/ExportButtons";
import { makeLsgFilename } from "@/lib/exportUtils";
import { extractTopic, extractSubject } from "@/lib/autofill";
import { usePaywallGuard } from "@/hooks/usePaywallGuard";
import { PaywallFlow } from "@/components/checkout/PaywallFlow";
import { useWakeLock } from "@/hooks/useWakeLock";

// ── Types ──────────────────────────────────────────────────────────────────────

type PageTab = "text" | "code";
type TextPhase = "idle" | "checking" | "results";
type CodePhase = "idle" | "comparing" | "results";

// ── Report generator ──────────────────────────────────────────────────────────

// ── Export helpers ─────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Builds an inline-highlighted version of the text, Turnitin-style.
 * aiSections carry { startIndex, endIndex, score } — we walk through the text
 * and wrap each flagged region in a <mark> with colour intensity matching the score.
 */
function buildInlineHighlightedText(
  text: string,
  aiSections: Array<{ text: string; score: number; startIndex: number; endIndex: number }>,
): string {
  const sorted = [...aiSections]
    .filter(s => s.startIndex >= 0 && s.endIndex > s.startIndex)
    .sort((a, b) => a.startIndex - b.startIndex);

  let html = "";
  let cursor = 0;

  for (const section of sorted) {
    const start = Math.max(cursor, section.startIndex);
    const end = Math.min(text.length, section.endIndex);
    if (start >= end) continue;

    if (start > cursor) {
      html += esc(text.slice(cursor, start)).replace(/\n/g, "<br>");
    }

    const intensity = section.score >= 75 ? "high" : section.score >= 55 ? "med" : "low";
    html += `<mark class="ai-hl ai-hl-${intensity}" title="AI probability: ${section.score}%">${esc(text.slice(start, end)).replace(/\n/g, "<br>")}</mark>`;
    cursor = end;
  }

  if (cursor < text.length) {
    html += esc(text.slice(cursor)).replace(/\n/g, "<br>");
  }

  return html;
}

/** Parses [[HL]]...[[/HL]] markers into HTML-escaped highlighted code blocks. */
function renderHighlightedCode(raw: string): string {
  const parts = raw.split(/(\[\[HL\]\][\s\S]*?\[\[\/HL\]\])/);
  return parts
    .map(part => {
      if (part.startsWith("[[HL]]")) {
        const content = part.replace("[[HL]]", "").replace("[[/HL]]", "");
        return `<mark class="code-hl">${esc(content)}</mark>`;
      }
      return esc(part);
    })
    .join("");
}

function buildReportHtml(result: PlagiarismResult, text: string): string {
  const date = new Date().toLocaleString();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasHighlights = result.aiSections.length > 0;
  const highlightedBody = hasHighlights
    ? buildInlineHighlightedText(text, result.aiSections as Array<{ text: string; score: number; startIndex: number; endIndex: number }>)
    : esc(text).replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AI &amp; Plagiarism Report — LightSpeed Ghost</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12pt; max-width: 860px; margin: 40px auto; color: #111; padding: 0 30px; }
  h1 { font-size: 20pt; color: #1a1a2e; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; margin-bottom: 4px; }
  h2 { font-size: 13pt; color: #1a1a2e; margin-top: 30px; margin-bottom: 10px; }
  .meta { font-size: 10pt; color: #6b7280; margin-bottom: 4px; }
  .threshold { font-size: 10pt; color: #6b7280; margin-bottom: 20px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-weight: bold; font-size: 10pt; }
  .safe { background: #d1fae5; color: #065f46; }
  .warn { background: #fef3c7; color: #92400e; }
  .danger { background: #fee2e2; color: #991b1b; }
  .score-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
  .score-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; text-align: center; }
  .score-value { font-size: 32pt; font-weight: bold; }
  .score-label { font-size: 10pt; color: #374151; margin: 4px 0; }

  /* ── Turnitin-style colour legend ── */
  .legend { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; font-size: 10pt; margin-bottom: 14px; }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-swatch { width: 18px; height: 14px; border-radius: 3px; display: inline-block; }
  .ls-ai-high { background: #f97316; }
  .ls-ai-med  { background: #fbbf24; }
  .ls-ai-low  { background: #fde68a; }
  .ls-clean   { background: #e5e7eb; }

  /* ── Inline text highlights (AI) ── */
  mark.ai-hl { border-radius: 2px; padding: 0 1px; cursor: default; }
  mark.ai-hl-high { background: #fed7aa; border-bottom: 2px solid #f97316; } /* strong orange */
  mark.ai-hl-med  { background: #fef3c7; border-bottom: 2px solid #f59e0b; } /* amber */
  mark.ai-hl-low  { background: #fef9c3; border-bottom: 2px solid #eab308; } /* yellow */

  /* ── Full document area ── */
  .doc-body { background: #fff; border: 1px solid #d1d5db; border-radius: 8px; padding: 20px 24px; font-size: 11pt; line-height: 1.8; white-space: pre-wrap; word-break: break-word; margin-bottom: 8px; }

  /* ── Flagged sections list ── */
  .ai-section { background: #fff7ed; border-left: 4px solid #f97316; padding: 10px 14px; margin: 8px 0; border-radius: 4px; font-size: 10pt; }
  .ai-section .score-tag { font-size: 9pt; font-weight: bold; color: #ea580c; margin-bottom: 4px; }

  /* ── Plagiarism sources ── */
  .source { background: #fff1f2; border: 1px solid #fecaca; padding: 10px 14px; margin: 8px 0; border-radius: 8px; font-size: 10pt; }

  .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 9pt; color: #6b7280; }
  @media print { body { margin: 0.5in; } }
</style>
</head>
<body>

<h1>AI &amp; Plagiarism Check Report</h1>
<p class="meta"><strong>Generated:</strong> ${date} &nbsp;|&nbsp; <strong>Words analysed:</strong> ${wordCount.toLocaleString()}</p>
<p class="threshold">Institutional thresholds: AI ≤ 30% &nbsp;·&nbsp; Plagiarism ≤ 30%</p>

<h2>Scores</h2>
<div class="score-grid">
  <div class="score-card">
    <div class="score-value" style="color:${result.aiScore < 30 ? "#059669" : "#dc2626"}">${result.aiScore.toFixed(0)}%</div>
    <div class="score-label">AI Detection</div>
    <span class="badge ${result.aiScore < 20 ? "safe" : result.aiScore < 30 ? "warn" : "danger"}">${result.aiScore < 20 ? "Safe" : result.aiScore < 30 ? "Borderline" : "Above Threshold"}</span>
  </div>
  <div class="score-card">
    <div class="score-value" style="color:${result.plagiarismScore < 30 ? "#059669" : "#dc2626"}">${result.plagiarismScore.toFixed(0)}%</div>
    <div class="score-label">Plagiarism Risk</div>
    <span class="badge ${result.plagiarismScore < 15 ? "safe" : result.plagiarismScore < 30 ? "warn" : "danger"}">${result.plagiarismScore < 15 ? "Original" : result.plagiarismScore < 30 ? "Acceptable" : "High Risk"}</span>
  </div>
</div>

${result.lexicalDiversity !== undefined ? `
<h2>Writing Metrics</h2>
<p><strong>Lexical Diversity:</strong> ${result.lexicalDiversity}% &nbsp;·&nbsp; <strong>Avg Sentence Length:</strong> ${result.avgSentenceLength} words</p>
` : ""}

${result.aiFlags && result.aiFlags.length > 0 ? `
<h2>AI Indicators Detected</h2>
${result.aiFlags.map((f: string) => `<p style="margin:4px 0; font-size:10pt;">⚠ ${esc(f)}</p>`).join("")}
` : ""}

<h2>Full Text — Highlighted</h2>
<div class="legend">
  <strong>Colour key:</strong>
  <span class="legend-item"><span class="legend-swatch ls-ai-high"></span> High AI probability (≥75%)</span>
  <span class="legend-item"><span class="legend-swatch ls-ai-med"></span> Medium AI probability (55–74%)</span>
  <span class="legend-item"><span class="legend-swatch ls-ai-low"></span> Lower AI probability (&lt;55%)</span>
  <span class="legend-item"><span class="legend-swatch ls-clean"></span> No flag (human-like)</span>
</div>
<div class="doc-body">${highlightedBody}</div>

${hasHighlights ? `
<h2>Flagged AI Sections (${result.aiSections.length})</h2>
${(result.aiSections as Array<{ text: string; score: number }>).map((s, i) => `
<div class="ai-section">
  <div class="score-tag">Section ${i + 1} &nbsp;·&nbsp; AI probability: ${s.score.toFixed(0)}%</div>
  ${esc(s.text)}
</div>`).join("")}
` : "<p style='font-size:10pt; color:#059669;'>✓ No AI-suspected sections identified.</p>"}

${result.plagiarismSources.length > 0 ? `
<h2>Plagiarism Source Matches (${result.plagiarismSources.length})</h2>
${(result.plagiarismSources as Array<{ url: string; similarity: number; matchedText: string }>).map(s => `
<div class="source">
  <strong>${s.similarity}% similarity</strong> — <a href="${esc(s.url)}">${esc(s.url)}</a><br>
  <span style="font-size:9pt; color:#6b7280;">Shared terms: ${esc(s.matchedText)}</span>
</div>`).join("")}
` : ""}

<div class="footer">
  <strong>LightSpeed Ghost</strong> &middot; AI &amp; Plagiarism Checker &middot; lightspeedghost.com<br>
  These are AI-estimated scores. Highlights indicate suspected AI-generated passages. For authoritative institutional results, submit through Turnitin or Copyleaks.
</div>
</body>
</html>`;
}

function buildCodeReportHtml(result: CodeCompareResult): string {
  const date = new Date().toLocaleString();
  const renderedA = renderHighlightedCode(result.highlightedDoc1 ?? "");
  const renderedB = renderHighlightedCode(result.highlightedDoc2 ?? "");
  const matchCountA = (result.slices1 ?? []).length;
  const matchCountB = (result.slices2 ?? []).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Code Similarity Report — LightSpeed Ghost</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12pt; max-width: 920px; margin: 40px auto; color: #111; padding: 0 30px; }
  h1 { font-size: 20pt; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; }
  h2 { font-size: 13pt; color: #1a1a2e; margin-top: 28px; margin-bottom: 10px; }
  .meta { font-size: 10pt; color: #6b7280; }
  .score-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 16px 0; }
  .score-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; text-align: center; }
  .score-value { font-size: 28pt; font-weight: bold; }
  .score-label { font-size: 10pt; color: #374151; margin: 4px 0; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-weight: bold; font-size: 10pt; }
  .safe { background: #d1fae5; color: #065f46; }
  .warn { background: #fef3c7; color: #92400e; }
  .danger { background: #fee2e2; color: #991b1b; }

  /* ── Colour legend ── */
  .legend { display: flex; align-items: center; gap: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; font-size: 10pt; margin-bottom: 10px; }
  .legend-swatch { width: 18px; height: 14px; border-radius: 3px; display: inline-block; }

  /* ── Code panels ── */
  .code-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .code-panel { border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; }
  .code-header { background: #1e293b; color: #e2e8f0; padding: 8px 14px; font-size: 10pt; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
  .match-badge { background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 9pt; font-weight: normal; }
  .code-body { background: #f8fafc; padding: 14px; overflow-x: auto; max-height: 500px; overflow-y: auto; }
  pre { margin: 0; font-family: "Courier New", monospace; font-size: 10pt; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }

  /* ── Match highlights ── */
  mark.code-hl { background: #fecaca; border-bottom: 2px solid #ef4444; border-radius: 2px; padding: 0 1px; }

  .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 9pt; color: #6b7280; }
  @media print { body { margin: 0.5in; } .code-body { max-height: none; } }
</style>
</head>
<body>

<h1>Code Similarity Report</h1>
<p class="meta"><strong>Generated:</strong> ${date} &nbsp;|&nbsp; <strong>Algorithm:</strong> ${esc(result.algorithm ?? "Winnowing (MOSS)")}</p>

<h2>Scores</h2>
<div class="score-grid">
  <div class="score-card">
    <div class="score-value" style="color:${result.similarity1 >= 40 ? "#dc2626" : result.similarity1 >= 20 ? "#d97706" : "#059669"}">${result.similarity1}%</div>
    <div class="score-label">of Submission A matched</div>
  </div>
  <div class="score-card">
    <div class="score-value" style="color:${result.overallSimilarity >= 40 ? "#dc2626" : result.overallSimilarity >= 20 ? "#d97706" : "#059669"}">${result.overallSimilarity}%</div>
    <div class="score-label">Overall Similarity</div>
    <span class="badge ${result.riskLevel === "low" ? "safe" : result.riskLevel === "medium" ? "warn" : "danger"}">${result.riskLevel.toUpperCase()} RISK</span>
  </div>
  <div class="score-card">
    <div class="score-value" style="color:${result.similarity2 >= 40 ? "#dc2626" : result.similarity2 >= 20 ? "#d97706" : "#059669"}">${result.similarity2}%</div>
    <div class="score-label">of Submission B matched</div>
  </div>
</div>

<h2>Side-by-Side Comparison — Matched Regions Highlighted</h2>
<div class="legend">
  <strong>Colour key:</strong>
  <span style="display:flex;align-items:center;gap:6px;"><span class="legend-swatch" style="background:#fecaca;border-bottom:2px solid #ef4444;"></span> Matching code region</span>
  <span style="font-size:10pt; color:#6b7280;">Highlighted sections share identical or near-identical token sequences between both submissions.</span>
</div>

<div class="code-panels">
  <div class="code-panel">
    <div class="code-header">
      Submission A
      ${matchCountA > 0 ? `<span class="match-badge">${matchCountA} matched region${matchCountA !== 1 ? "s" : ""}</span>` : ""}
    </div>
    <div class="code-body"><pre>${renderedA || "<em style='color:#9ca3af'>No content</em>"}</pre></div>
  </div>
  <div class="code-panel">
    <div class="code-header">
      Submission B
      ${matchCountB > 0 ? `<span class="match-badge">${matchCountB} matched region${matchCountB !== 1 ? "s" : ""}</span>` : ""}
    </div>
    <div class="code-body"><pre>${renderedB || "<em style='color:#9ca3af'>No content</em>"}</pre></div>
  </div>
</div>

<div class="footer">
  <strong>LightSpeed Ghost</strong> &middot; Code Similarity Checker &middot; Winnowing / MOSS algorithm (Aiken et al., SIGMOD 2003)<br>
  Highlighted regions indicate character-level token sequences found in both submissions.
</div>
</body>
</html>`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score, label, safe }: { score: number; label: string; safe: boolean }) {
  const color = safe ? "text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/5"
    : score < 50 ? "text-yellow-600 dark:text-yellow-400 border-yellow-500/30 bg-yellow-500/5"
    : "text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/5";
  const sublabel = safe ? "✓ Within threshold" : score < 50 ? "⚠ Borderline" : "✕ Above threshold";
  return (
    <div className={cn("rounded-xl border p-5 text-center", color)}>
      <div className="text-4xl font-bold tabular-nums">{score.toFixed(0)}%</div>
      <div className="text-sm font-semibold mt-0.5">{label}</div>
      <div className="text-[10px] mt-1 opacity-70">{sublabel}</div>
      <div className="mt-3 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", safe ? "bg-green-500" : score < 50 ? "bg-yellow-500" : "bg-red-500")}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

function HighlightedCode({ label, raw, matchCount }: { label: string; raw: string; matchCount: number }) {
  const parts: { text: string; highlighted: boolean }[] = [];
  const segments = raw.split(/(\[\[HL\]\].*?\[\[\/HL\]\])/s);
  for (const seg of segments) {
    if (seg.startsWith("[[HL]]")) {
      parts.push({ text: seg.replace("[[HL]]", "").replace("[[/HL]]", ""), highlighted: true });
    } else {
      parts.push({ text: seg, highlighted: false });
    }
  }
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        {matchCount > 0 && (
          <span className="text-[10px] bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
            {matchCount} matched region{matchCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="overflow-auto max-h-72 p-3">
        <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all">
          {parts.map((part, i) =>
            part.highlighted ? (
              <mark key={i} className="bg-red-200 dark:bg-red-900/60 text-foreground rounded px-0.5 not-italic">{part.text}</mark>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </pre>
      </div>
    </div>
  );
}

// ── Action Buttons component ──────────────────────────────────────────────────

function ActionButtons({
  aiScore, plagiarismScore, text, onRevise, onHumanize,
}: {
  aiScore: number;
  plagiarismScore: number;
  text: string;
  onRevise: () => void;
  onHumanize: () => void;
}) {
  const aiSafe = aiScore < 30;
  const plagSafe = plagiarismScore < 30;
  const bothSafe = aiSafe && plagSafe;
  const bothUnsafe = !aiSafe && !plagSafe;
  const aiAbove20 = aiScore > 20;

  const topic = encodeURIComponent(text.trim() ? extractTopic(text) : "");
  const subject = encodeURIComponent(text.trim() ? extractSubject(text) : "");
  const writeHref = `/write?topic=${topic}&subject=${subject}&from=plagiarism`;

  if (bothSafe) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Both thresholds passed — choose what to do next:</p>
        {aiAbove20 && (
          <button
            onClick={onHumanize}
            className="w-full flex items-center justify-between gap-3 bg-primary text-primary-foreground px-4 py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 group"
          >
            <div className="flex items-center gap-2.5">
              <Wand2 size={16} className="shrink-0" />
              <div className="text-left">
                <div className="font-bold">Humanize with LightSpeed AI</div>
                <div className="text-[10px] font-normal opacity-80">Bring AI score to 0% — fully undetectable</div>
              </div>
            </div>
            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform shrink-0" />
          </button>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={onRevise}
            className="flex items-center justify-between gap-3 bg-card border border-border text-foreground px-4 py-3.5 rounded-xl font-bold text-sm hover:bg-muted/30 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <FileEdit size={16} className="shrink-0" />
              <div className="text-left">
                <div className="font-bold">Revise Paper</div>
                <div className="text-[10px] font-normal opacity-60">Raise to 92%+ with targeted rewriting</div>
              </div>
            </div>
            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform shrink-0" />
          </button>

          <Link href={writeHref}>
            <div className="flex items-center justify-between gap-3 bg-card border border-primary/30 text-foreground px-4 py-3.5 rounded-xl font-bold text-sm hover:bg-primary/5 transition-all cursor-pointer group">
              <div className="flex items-center gap-2.5">
                <PenLine size={16} className="text-primary shrink-0" />
                <div className="text-left">
                  <div className="font-bold text-primary">Write New Paper</div>
                  <div className="text-[10px] font-normal text-muted-foreground">Start fresh — 0% AI guaranteed</div>
                </div>
              </div>
              <ChevronRight size={14} className="text-primary group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
          </Link>
        </div>
      </div>
    );
  }

  if (bothUnsafe) {
    return (
      <div className="space-y-3">
        <div className="px-4 py-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-400">
          <div className="font-semibold mb-0.5 flex items-center gap-2">
            <ShieldAlert size={14} /> Both AI ({aiScore.toFixed(0)}%) and plagiarism ({plagiarismScore.toFixed(0)}%) exceed the threshold
          </div>
          <p className="text-xs opacity-80">Most institutions will reject this. Humanize it first to drop AI to 0%, or write a new paper from scratch.</p>
        </div>
        <button
          onClick={onHumanize}
          className="w-full flex items-center justify-between gap-3 bg-primary text-primary-foreground px-5 py-4 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 group"
        >
          <div className="flex items-center gap-3">
            <Wand2 size={18} className="shrink-0" />
            <div className="text-left">
              <div className="font-bold">Humanize with LightSpeed AI</div>
              <div className="text-[10px] font-normal opacity-80">Instantly drop AI score to 0% — fully undetectable</div>
            </div>
          </div>
          <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
        <Link href={writeHref}>
          <div className="flex items-center justify-between gap-3 bg-card border border-border text-foreground px-5 py-3.5 rounded-xl font-bold text-sm hover:bg-muted/30 transition-all cursor-pointer group">
            <div className="flex items-center gap-3">
              <PenLine size={16} className="text-primary shrink-0" />
              <div className="text-left">
                <div className="font-bold text-primary">Write a New Paper Instead</div>
                <div className="text-[10px] font-normal text-muted-foreground">0% AI · &lt;8% plagiarism · 92%+ grade</div>
              </div>
            </div>
            <ChevronRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
        </Link>
      </div>
    );
  }

  if (!aiSafe) {
    return (
      <div className="space-y-3">
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-400">
          <div className="font-semibold flex items-center gap-2">
            <ShieldAlert size={14} /> AI content at {aiScore.toFixed(0)}% — above the 30% institutional threshold
          </div>
          <p className="text-xs mt-0.5 opacity-80">Humanize your text to instantly bring AI detection to 0% — guaranteed undetectable.</p>
        </div>
        <button
          onClick={onHumanize}
          className="w-full flex items-center justify-between gap-3 bg-primary text-primary-foreground px-5 py-4 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 group"
        >
          <div className="flex items-center gap-3">
            <Wand2 size={18} className="shrink-0" />
            <div className="text-left">
              <div className="font-bold">Humanize with LightSpeed AI</div>
              <div className="text-[10px] font-normal opacity-80">Drop AI to 0% — your text, fully undetectable</div>
            </div>
          </div>
          <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={onRevise}
            className="flex items-center justify-center gap-2 border border-border text-muted-foreground px-4 py-3 rounded-xl text-sm font-medium hover:text-foreground hover:bg-muted/30 transition-all"
          >
            <FileEdit size={14} />
            Revise paper
          </button>
          <Link href={writeHref}>
            <div className="flex items-center justify-center gap-2 border border-border text-muted-foreground px-4 py-3 rounded-xl text-sm font-medium hover:text-foreground hover:bg-muted/30 transition-all cursor-pointer">
              <PenLine size={14} />
              Write new paper
            </div>
          </Link>
        </div>
      </div>
    );
  }

  // plagiarism high, AI safe
  return (
    <div className="space-y-3">
      <div className="px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-700 dark:text-yellow-400">
        <div className="font-semibold flex items-center gap-2">
          <AlertTriangle size={14} /> Plagiarism {plagiarismScore.toFixed(0)}% exceeds the 30% threshold
        </div>
        <p className="text-xs mt-0.5 opacity-80">Revision can rephrase flagged passages and bring plagiarism well under 8%.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <button
          onClick={onRevise}
          className="flex items-center justify-between gap-3 bg-primary text-primary-foreground px-4 py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 group"
        >
          <div className="flex items-center gap-2.5">
            <FileEdit size={16} className="shrink-0" />
            <div className="text-left">
              <div className="font-bold">Revise Paper</div>
              <div className="text-[10px] font-normal opacity-80">Rephrase & fix plagiarism</div>
            </div>
          </div>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
        <Link href={writeHref}>
          <div className="flex items-center justify-between gap-3 bg-card border border-border text-foreground px-4 py-3.5 rounded-xl text-sm hover:bg-muted/30 transition-all cursor-pointer group">
            <div className="flex items-center gap-2.5">
              <PenLine size={16} className="text-primary shrink-0" />
              <div className="text-left">
                <div className="font-medium text-primary">Write New Paper</div>
                <div className="text-[10px] text-muted-foreground">Start fresh instead</div>
              </div>
            </div>
            <ChevronRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
        </Link>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PlagiarismChecker() {
  const [, navigate] = useLocation();
  const { guard, openBuy, plan, isAtLimit, pickerState, checkoutState, closePicker, closeCheckout, chooseSubscription, choosePayg } = usePaywallGuard();
  const [pageTab, setPageTab] = useState<PageTab>("text");

  // ── Text check state
  const [text, setText] = useState("");
  const [textPhase, setTextPhase] = useState<TextPhase>("idle");
  useWakeLock(textPhase === "checking");
  const [checkError, setCheckError] = useState<string | null>(null);
  const [result, setResult] = useState<PlagiarismResult | null>(null);
  const [humanizedText, setHumanizedText] = useState<string | null>(null);
  const [intensityValue, setIntensityValue] = useState(50);
  const [copied, setCopied] = useState(false);
  const humanizeIntensity: "light" | "medium" | "heavy" =
    intensityValue <= 33 ? "light" : intensityValue <= 66 ? "medium" : "heavy";

  // ── Code check state
  const [doc1, setDoc1] = useState("");
  const [doc2, setDoc2] = useState("");
  const [language, setLanguage] = useState("auto");
  const [codePhase, setCodePhase] = useState<CodePhase>("idle");
  const [codeResult, setCodeResult] = useState<CodeCompareResult | null>(null);

  const checkPlagiarism = useCheckPlagiarism();
  const humanizeText = useHumanizeText();
  const compareCodeMutation = useMutation({
    mutationFn: (body: { doc1: string; doc2: string; language?: string }) =>
      compareCode({ doc1: body.doc1, doc2: body.doc2, language: body.language === "auto" ? undefined : body.language }),
  });

  const handleCheck = async () => {
    if (!text.trim()) return;
    if (isAtLimit("plagiarism")) { guard("plagiarism", () => {}); return; }
    setCheckError(null);
    setTextPhase("checking");
    setResult(null);
    setHumanizedText(null);
    try {
      const res = await checkPlagiarism.mutateAsync({ data: { text, checkAi: true, checkPlagiarism: true } });
      setResult(res);
      setTextPhase("results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed — please try again";
      setCheckError(msg.startsWith("{") ? "Analysis failed — please try again" : msg);
      setTextPhase("idle");
    }
  };

  const handleHumanize = async () => {
    const textToHumanize = humanizedText ?? text;
    if (!textToHumanize.trim()) return;
    const res = await humanizeText.mutateAsync({ data: { text: textToHumanize, intensity: humanizeIntensity } });
    setHumanizedText(res.humanizedText);
  };

  const handleCodeCompare = async () => {
    if (!doc1.trim() || !doc2.trim()) return;
    setCodePhase("comparing");
    setCodeResult(null);
    try {
      const res = await compareCodeMutation.mutateAsync({ doc1, doc2, language });
      setCodeResult(res);
      setCodePhase("results");
    } catch {
      setCodePhase("idle");
    }
  };

  const handleRevise = useCallback(() => {
    localStorage.setItem("plag-prefill-revision-text", text);
    navigate("/revision");
  }, [text, navigate]);

  const handleHumanizeRedirect = useCallback(() => {
    sessionStorage.setItem("lsg_humanize_text", text);
    sessionStorage.setItem("lsg_humanize_autorun", "true");
    navigate("/humanizer");
  }, [text, navigate]);

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const LANGUAGES = [
    { value: "auto", label: "Auto-detect" },
    { value: "python", label: "Python" },
    { value: "javascript", label: "JavaScript / TypeScript" },
    { value: "java", label: "Java" },
    { value: "cpp", label: "C / C++" },
    { value: "c_sharp", label: "C#" },
    { value: "go", label: "Go" },
    { value: "rust", label: "Rust" },
    { value: "r", label: "R" },
    { value: "matlab", label: "MATLAB" },
    { value: "sql", label: "SQL" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── Tab switcher ─────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-muted/10 px-6 py-2 flex gap-1 justify-center">
        {([
          { id: "text" as PageTab, label: "Text & Paper Check", icon: FileText },
          { id: "code" as PageTab, label: "Code Similarity", icon: Code2 },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPageTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              pageTab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ════════════════════ TEXT CHECK TAB ════════════════════ */}
        {pageTab === "text" && (
          textPhase === "checking" ? (
            <FullscreenLoader
              icon={<ShieldCheck size={32} />}
              title="Running full check…"
              subtitle={`Analysing ${wordCount.toLocaleString()} words across multiple detection layers`}
              steps={[
                "Tokenising document and building word frequency map",
                "Detecting AI-generated patterns — lexical diversity & sentence flow",
                "Analysing sentence structure and variation",
                "Scanning against academic corpus for plagiarism sources",
                "Computing writing quality metrics and readability scores",
                "Generating your full diagnostic report",
              ]}
            />
          ) : (
          <div className={cn("flex-1 min-h-0", textPhase === "results" ? "flex flex-col md:flex-row overflow-y-auto md:overflow-hidden" : "overflow-y-auto")}>

            {/* Input panel */}
            <div className={cn(
              "flex flex-col",
              textPhase === "results" ? "shrink-0 border-b md:border-b-0 md:w-[400px] md:border-r border-border overflow-y-auto max-h-[45vh] md:max-h-none" : "max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full"
            )}>
              <div className={cn("space-y-4", textPhase === "results" && "px-5 py-5")}>
                {textPhase !== "results" && (
                  <>
                    {/* Page header */}
                    <div className="text-center space-y-1.5 pt-2 pb-1">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Zap size={16} className="text-primary" />
                        <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-bold tracking-tight">AI & Plagiarism Checker</h1>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Detect AI content · Plagiarism risk · Code similarity · Download report
                      </p>
                    </div>
                    <div className="space-y-1">
                      <h2 className="font-bold text-base">Upload or paste your text</h2>
                      <p className="text-xs text-muted-foreground">Works with papers, essays, reports, assignments, code comments, or any written content</p>
                    </div>
                  </>
                )}

                <FileUploadZone
                  onExtracted={(f: ExtractedFile) => { setText(f.text); setTextPhase("idle"); setResult(null); }}
                  accept=".pdf,.docx,.doc,.txt,.md"
                  label="Upload document"
                  hint="PDF, Word, or text file — auto-fills the area below"
                  compact={textPhase === "results"}
                />

                <textarea
                  value={text}
                  onChange={e => { setText(e.target.value); if (textPhase === "results") { setTextPhase("idle"); setResult(null); } }}
                  rows={textPhase === "results" ? 8 : 12}
                  placeholder="Paste your text here to check for AI content and plagiarism…"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed font-mono"
                />

                {checkError && (
                  <div className="mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
                    {checkError}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground tabular-nums">{wordCount.toLocaleString()} words</span>
                  <div className="flex items-center gap-2">
                    {textPhase === "results" && (
                      <button
                        onClick={() => { setTextPhase("idle"); setResult(null); setHumanizedText(null); }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
                      >
                        <X size={12} /> Clear
                      </button>
                    )}
                    <button
                      onClick={handleCheck}
                      disabled={!text.trim()}
                      className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      <ShieldCheck size={15} /> {textPhase === "results" ? "Re-run Check" : "Run Full Check"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openBuy("plagiarism")}
                      className="text-[11px] text-orange-400 hover:text-orange-300 transition-colors font-medium whitespace-nowrap"
                    >
                      Buy check →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results panel */}
            {textPhase === "results" && result && (
              <div className="flex-1 overflow-y-auto min-w-0">
                <div className="px-6 py-5 space-y-5 max-w-2xl">

                  {/* Toolbar */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold",
                      result.overallRisk === "high" ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                      : result.overallRisk === "medium" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                      : "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                    )}>
                      {result.overallRisk === "high" ? <ShieldAlert size={12} /> : result.overallRisk === "medium" ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
                      Overall Risk: {result.overallRisk.toUpperCase()}
                    </div>
                    <ExportButtons
                      getHtml={() => buildReportHtml(result, text)}
                      getText={() => `AI Detection: ${result.aiScore}%\nPlagiarism Risk: ${result.plagiarismScore}%\nOverall Risk: ${result.overallRisk}\n${result.aiFlags?.length ? "\nAI Indicators:\n" + result.aiFlags.join("\n") : ""}`}
                      filename={makeLsgFilename("plagiarism", "AI-PLAGIARISM-REPORT")}
                      formats={["pdf", "docx", "copy"]}
                    />
                  </div>

                  {/* Score cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <ScoreRing score={result.aiScore} label="AI Detection" safe={result.aiScore < 30} />
                    <ScoreRing score={result.plagiarismScore} label="Plagiarism Risk" safe={result.plagiarismScore < 30} />
                  </div>

                  {/* Threshold reminder */}
                  <p className="text-[10px] text-muted-foreground text-center">
                    Institutional threshold: AI ≤ 30% · Plagiarism ≤ 30% for submission
                  </p>

                  {/* ── ACTION BUTTONS ── */}
                  <ActionButtons
                    aiScore={result.aiScore}
                    plagiarismScore={result.plagiarismScore}
                    text={text}
                    onRevise={handleRevise}
                    onHumanize={handleHumanizeRedirect}
                  />

                  {/* Writing metrics */}
                  {(result.lexicalDiversity !== undefined || result.avgSentenceLength !== undefined) && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-1.5 mb-3">
                        <BarChart3 size={13} className="text-muted-foreground" />
                        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Writing Metrics</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {result.lexicalDiversity !== undefined && (
                          <div className="bg-muted/40 rounded-lg p-3 border border-border">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Lexical Diversity</div>
                            <div className="text-xl font-bold mt-0.5">{result.lexicalDiversity}%</div>
                            <div className="text-[10px] text-muted-foreground">
                              {result.lexicalDiversity >= 60 ? "High — varied vocabulary" : result.lexicalDiversity >= 45 ? "Medium — some repetition" : "Low — repetitive (AI indicator)"}
                            </div>
                            <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full", result.lexicalDiversity >= 60 ? "bg-green-500" : result.lexicalDiversity >= 45 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${result.lexicalDiversity}%` }} />
                            </div>
                          </div>
                        )}
                        {result.avgSentenceLength !== undefined && (
                          <div className="bg-muted/40 rounded-lg p-3 border border-border">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg Sentence Length</div>
                            <div className="text-xl font-bold mt-0.5">{result.avgSentenceLength} words</div>
                            <div className="text-[10px] text-muted-foreground">
                              {result.avgSentenceLength <= 20 ? "Natural — human-length" : result.avgSentenceLength <= 28 ? "Moderate — slightly long" : "Long — AI indicator"}
                            </div>
                          </div>
                        )}
                      </div>
                      {result.aiFlags && result.aiFlags.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {result.aiFlags.map((flag: string, i: number) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px] text-yellow-700 dark:text-yellow-400">
                              <AlertTriangle size={10} />
                              {flag}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border flex items-center gap-1">
                        <Info size={9} />
                        AI detection via lexical diversity · Algorithm from{" "}
                        <a href="https://github.com/Churanta/Plagiarism-Checker-and-AI-Text-Detection" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                          open research <ExternalLink size={8} />
                        </a>
                      </p>
                    </div>
                  )}

                  {/* AI Sections */}
                  {result.aiSections.length > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-3">AI-Suspected Sections ({result.aiSections.length})</h3>
                      <div className="space-y-2">
                        {result.aiSections.map((section: { text: string; score: number }, i: number) => (
                          <div key={i} className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded">AI: {section.score.toFixed(0)}%</span>
                            </div>
                            <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">{section.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Plagiarism sources */}
                  {result.plagiarismSources.length > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Source Matches ({result.plagiarismSources.length})</h3>
                        <span className="text-[10px] text-muted-foreground">{result.sourcesScanned ? `${result.sourcesScanned.length} sources scanned` : "Multiple sources scanned"}</span>
                      </div>
                      <div className="space-y-2">
                        {(result.plagiarismSources as Array<{ url: string; similarity: number; matchedText: string; title?: string; authors?: string; year?: number; sourceType?: string; live?: boolean }>).map((source, i) => {
                          const typeColors: Record<string, string> = {
                            "wikipedia": "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900",
                            "open-library": "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
                            "google-books": "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
                            "internet-archive": "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900",
                            "crossref": "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900",
                            "academic-live": "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900",
                            "academic-local": "bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800",
                          };
                          const typeLabel: Record<string, string> = {
                            "wikipedia": "Wikipedia",
                            "open-library": "Open Library",
                            "google-books": "Google Books",
                            "internet-archive": "Internet Archive",
                            "crossref": "CrossRef DOI",
                            "academic-live": "Academic DB",
                            "academic-local": "Academic Corpus",
                          };
                          const colorClass = typeColors[source.sourceType ?? ""] ?? typeColors["academic-local"];
                          const label = typeLabel[source.sourceType ?? ""] ?? "Source";
                          const displayTitle = source.title ?? decodeURIComponent(source.url.split("q=")[1] ?? source.url).slice(0, 60);
                          return (
                            <div key={i} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${colorClass}`}>{label}</span>
                                    {source.year && <span className="text-[10px] text-muted-foreground">{source.year}</span>}
                                  </div>
                                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex items-center gap-0.5">
                                    <span className="truncate">{displayTitle}</span> <ExternalLink size={9} className="shrink-0" />
                                  </a>
                                  {source.authors && <p className="text-[10px] text-muted-foreground truncate">{source.authors}</p>}
                                </div>
                                <span className="text-xs font-bold text-red-600 dark:text-red-400 shrink-0">{source.similarity}%</span>
                              </div>
                              {source.matchedText && <p className="text-[11px] text-muted-foreground mt-1">Matched: "{source.matchedText.slice(0, 80)}{source.matchedText.length > 80 ? "…" : ""}"</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sentence-level matches from open-source check */}
                  {result.matchedSentences && result.matchedSentences.length > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-3">Flagged Sentences — External Source Matches</h3>
                      <div className="space-y-2.5">
                        {(result.matchedSentences as Array<{ sentence: string; matchScore: number; sources: Array<{ url: string; title: string; sourceType: string }> }>).map((ms, i) => (
                          <div key={i} className="rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20 p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-400">Sentence {i + 1} — {ms.matchScore}% match confidence</span>
                            </div>
                            <p className="text-[12px] text-foreground/90 leading-relaxed mb-2">"{ms.sentence}"</p>
                            <div className="flex flex-wrap gap-1">
                              {ms.sources.map((src, j) => (
                                <a key={j} href={src.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 bg-white dark:bg-black/20 border border-border rounded px-1.5 py-0.5">
                                  {src.title.slice(0, 30)}{src.title.length > 30 ? "…" : ""} <ExternalLink size={8} />
                                </a>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matched words */}
                  {result.matchedWords && result.matchedWords.length > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2.5">Words Matched in Academic Corpus</h3>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {result.matchedWords.slice(0, 60).map((word: string) => (
                          <span key={word} className="text-[11px] px-2 py-0.5 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 rounded font-medium">
                            {word}
                          </span>
                        ))}
                        {result.matchedWords.length > 60 && (
                          <span className="text-[11px] text-muted-foreground">+{result.matchedWords.length - 60} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Humanizer — only if AI high */}
                  {result.aiScore > 20 && (
                    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                      <div>
                        <h3 className="font-semibold text-sm">Ghost Writer — Humanize AI Content</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Recursive paraphrasing up to 3 passes to reduce AI score</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-muted-foreground">Intensity</label>
                          <span className={cn("text-xs font-semibold capitalize px-2 py-0.5 rounded-full",
                            humanizeIntensity === "light" ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400"
                            : humanizeIntensity === "medium" ? "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400"
                            : "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                          )}>
                            {humanizeIntensity}
                          </span>
                        </div>
                        <Slider value={[intensityValue]} onValueChange={([v]) => setIntensityValue(v)} min={0} max={100} step={1} className="mt-2 mb-1" />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Light — minor edits</span>
                          <span>Medium — rephrase</span>
                          <span>Heavy — full rewrite</span>
                        </div>
                      </div>
                      <button
                        onClick={handleHumanize}
                        disabled={humanizeText.isPending}
                        className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                      >
                        {humanizeText.isPending ? (
                          <><div className="w-3.5 h-3.5 rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground animate-spin" /> Humanizing…</>
                        ) : (
                          <><Zap size={14} /> Humanize Text</>
                        )}
                      </button>

                      {humanizedText && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">Ghost Writer Output</span>
                            <div className="flex items-center gap-2">
                              {humanizeText.data && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900">
                                  {humanizeText.data.beforeScore ?? "–"}% → {humanizeText.data.afterScore ?? "–"}%
                                </span>
                              )}
                              <button
                                onClick={() => { navigator.clipboard.writeText(humanizedText); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                              >
                                {copied ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
                                {copied ? "Copied!" : "Copy"}
                              </button>
                            </div>
                          </div>
                          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border border-border max-h-64 overflow-y-auto">
                            {humanizedText}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Empty state */}
            {textPhase === "idle" && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground/40">
                <ShieldCheck size={40} />
                <p className="text-sm">Upload or paste text, then click Run Full Check</p>
              </div>
            )}
          </div>
          )
        )}

        {/* ════════════════════ CODE TAB ════════════════════ */}
        {pageTab === "code" && (
          codePhase === "comparing" ? (
            <FullscreenLoader
              icon={<Code2 size={32} />}
              title="Comparing code submissions…"
              subtitle="Running the Winnowing algorithm (Stanford MOSS)"
              steps={[
                "Tokenising Submission A — normalising code structure",
                "Tokenising Submission B — normalising code structure",
                "Computing k-gram fingerprints (k=8)",
                "Running Winnowing algorithm — selecting minimum fingerprints",
                "Identifying shared fingerprint windows between documents",
                "Rendering highlighted similarity map",
              ]}
              stepInterval={900}
            />
          ) : (
          <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-semibold text-sm">Code Similarity Detection</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Powered by the Winnowing algorithm (Stanford MOSS) — the same engine used for academic code plagiarism detection</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Language</label>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Submission A</label>
                  <textarea
                    value={doc1}
                    onChange={e => setDoc1(e.target.value)}
                    rows={14}
                    placeholder="Paste code submission A here…"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
                    spellCheck={false}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">{doc1.split("\n").length} lines · {doc1.length} chars</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Submission B</label>
                  <textarea
                    value={doc2}
                    onChange={e => setDoc2(e.target.value)}
                    rows={14}
                    placeholder="Paste code submission B here…"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
                    spellCheck={false}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">{doc2.split("\n").length} lines · {doc2.length} chars</p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCodeCompare}
                  disabled={!doc1.trim() || !doc2.trim()}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50"
                >
                  <Code2 size={15} /> Compare Code
                </button>
              </div>
            </div>

            {codePhase === "results" && codeResult && (
              <div className="space-y-4">
                <div className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3 rounded-xl border",
                  codeResult.riskLevel === "high" ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                  : codeResult.riskLevel === "medium" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                  : "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                )}>
                  <div className="flex items-center gap-2">
                    {codeResult.riskLevel === "high" ? <ShieldAlert size={16} /> : codeResult.riskLevel === "medium" ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
                    <span className="font-semibold capitalize">Similarity Risk: {codeResult.riskLevel}</span>
                    <span className="font-bold">({codeResult.overallSimilarity}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-75">Algorithm: {codeResult.algorithm}</span>
                    <ExportButtons
                      getHtml={() => buildCodeReportHtml(codeResult)}
                      getText={() => `Code Similarity Report\nAlgorithm: ${codeResult.algorithm}\nSubmission A matched: ${codeResult.similarity1}%\nSubmission B matched: ${codeResult.similarity2}%\nOverall Similarity: ${codeResult.overallSimilarity}%\nRisk: ${codeResult.riskLevel.toUpperCase()}`}
                      filename={makeLsgFilename("plagiarism", "CODE-SIMILARITY-REPORT")}
                      formats={["pdf", "docx", "copy"]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-card border border-border rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{codeResult.similarity1}%</div>
                    <div className="text-xs text-muted-foreground mt-0.5">of Submission A matched</div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-foreground">{codeResult.overallSimilarity}%</div>
                    <div className="text-xs text-muted-foreground mt-0.5">overall similarity</div>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", codeResult.overallSimilarity >= 40 ? "bg-red-500" : codeResult.overallSimilarity >= 20 ? "bg-yellow-500" : "bg-green-500")}
                        style={{ width: `${codeResult.overallSimilarity}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{codeResult.similarity2}%</div>
                    <div className="text-xs text-muted-foreground mt-0.5">of Submission B matched</div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <HighlightedCode label="Submission A — Highlighted Matches" raw={codeResult.highlightedDoc1} matchCount={codeResult.slices1.length} />
                  <HighlightedCode label="Submission B — Highlighted Matches" raw={codeResult.highlightedDoc2} matchCount={codeResult.slices2.length} />
                </div>

                <div className="flex items-center justify-between bg-muted/40 border border-border rounded-lg px-4 py-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    Detection via <strong>Winnowing (k={codeResult.kgramSize}, w={codeResult.windowSize})</strong> · Algorithm from{" "}
                    <a href="https://theory.stanford.edu/~aiken/publications/papers/sigmod03.pdf" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                      Aiken et al. SIGMOD 2003 <ExternalLink size={9} />
                    </a>
                  </p>
                  <button
                    onClick={() => { setCodePhase("idle"); setCodeResult(null); }}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <RefreshCcw size={10} /> Reset
                  </button>
                </div>
              </div>
            )}

            {codePhase === "idle" && (
              <div className="bg-card border border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
                <Code2 size={36} className="opacity-30 mb-1" />
                <p className="text-sm font-medium">Paste two code submissions and click Compare Code</p>
                <p className="text-xs max-w-sm">The Winnowing algorithm fingerprints both documents and highlights structurally similar sections, even if variable names or formatting were changed</p>
              </div>
            )}
          </div>
          </div>
          )
        )}
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
