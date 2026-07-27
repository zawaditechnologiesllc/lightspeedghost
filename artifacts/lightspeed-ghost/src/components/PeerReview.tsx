import {
  Check, AlertTriangle, Lightbulb, ListChecks, HelpCircle, Lock, ArrowRight,
} from "lucide-react";
import type { PeerReviewResult } from "@/lib/peerReview";
import type { HighlightSegment } from "@/lib/scanReport";

// ── Peer Review results + combined report — 100% no-LLM ───────────────────────
// The Peer Review runs inside the free checker's single "Check my writing" pass
// (auto-detected paper type/level/style — the user is never asked). This module
// renders the results panel and builds the combined, downloadable full-check
// report (checker scores + highlighted document + peer review). Guests see a
// snippet; signed-in users get everything + the downloadable report.

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function gradeTone(pct: number): { text: string; ring: string; bar: string } {
  if (pct >= 80) return { text: "text-emerald-600", ring: "border-emerald-200 bg-emerald-50", bar: "bg-emerald-500" };
  if (pct >= 60) return { text: "text-amber-600", ring: "border-amber-200 bg-amber-50", bar: "bg-amber-500" };
  return { text: "text-red-600", ring: "border-red-200 bg-red-50", bar: "bg-red-500" };
}

// ── Combined full-check report (checker scores + highlights + peer review) ─────
export interface FullReportData {
  text: string;
  highlights: HighlightSegment[];        // AI (amber) + plagiarism (red) from the checker
  aiLikelihood?: number;                 // instant, in-browser AI-likelihood %
  readabilityLabel?: string;
  grammarIssues?: number;
  toneLabel?: string;
  scanAiScore?: number;                  // server plagiarism scan (after login)
  similarity?: number;
  risk?: string;
  detectionModel?: string;
  sources?: Array<{ url: string; similarity: number; matchedText?: string; title?: string }>;
  peer: PeerReviewResult;
}

export function buildFullCheckReportHtml(d: FullReportData): string {
  const r = d.peer;
  const list = (items: string[]) => items.map((i) => `<li>${esc(i)}</li>`).join("");
  const segHtml = d.highlights.length
    ? d.highlights.map((s) => s.type === "ai"
        ? `<mark class="ai">${esc(s.text).replace(/\n/g, "<br/>")}</mark>`
        : s.type === "plag"
        ? `<mark class="plag">${esc(s.text).replace(/\n/g, "<br/>")}</mark>`
        : esc(s.text).replace(/\n/g, "<br/>")).join("")
    : esc(d.text).replace(/\n/g, "<br/>");

  const card = (label: string, value: string, tone: "green" | "amber" | "red" | "muted") =>
    `<div class="card ${tone}"><div class="v">${esc(value)}</div><div class="l">${esc(label)}</div></div>`;
  const toneFor = (s?: number): "green" | "amber" | "red" | "muted" => s == null ? "muted" : s < 35 ? "green" : s < 65 ? "amber" : "red";

  const cards: string[] = [];
  cards.push(card("Peer-review grade", `${r.grade.letter} · ${r.grade.percent}%`, toneFor(100 - r.grade.percent)));
  if (d.scanAiScore != null) cards.push(card("AI content", `${Math.round(d.scanAiScore)}%`, toneFor(d.scanAiScore)));
  else if (d.aiLikelihood != null) cards.push(card("AI-likelihood", `${Math.round(d.aiLikelihood)}%`, toneFor(d.aiLikelihood)));
  if (d.similarity != null) cards.push(card("Plagiarism similarity", `${Math.round(d.similarity)}%`, toneFor(d.similarity)));
  if (d.risk) cards.push(card("Overall risk", d.risk, d.risk === "low" ? "green" : d.risk === "high" ? "red" : "amber"));
  cards.push(card("Words", String(r.metrics.words), "muted"));

  const sourcesHtml = d.sources && d.sources.length
    ? `<h2>Matching sources</h2><ol class="src">${d.sources.map((s) =>
        `<li><a href="${esc(s.url)}">${esc(s.title || s.url)}</a> <span class="sim">${Math.round(s.similarity)}%</span>${
          s.matchedText ? `<div class="snip">“${esc(s.matchedText.slice(0, 220))}”</div>` : ""}</li>`).join("")}</ol>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Light Speed Ghost — Full Writing Check &amp; Peer Review</title><style>
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#131b2e;background:#f4faf6;margin:0}
  .wrap{max-width:860px;margin:0 auto;padding:30px 24px 56px}
  header{display:flex;align-items:center;gap:10px;border-bottom:2px solid #d1fae5;padding-bottom:14px;margin-bottom:16px}
  .logo{width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#10b981,#0d9488);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800}
  h1{font-size:16px;margin:0}.meta{margin-left:auto;text-align:right;font-size:11px;color:#76777d}
  .cards{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 6px}
  .card{flex:1;min-width:120px;border:1px solid #e0e3e5;border-radius:12px;padding:11px 13px;text-align:center;background:#fff}
  .card .v{font-size:19px;font-weight:800}.card .l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#76777d;margin-top:2px}
  .card.green .v{color:#059669}.card.green{background:#ecfdf5;border-color:#a7f3d0}
  .card.amber .v{color:#b45309}.card.amber{background:#fffbeb;border-color:#fde68a}
  .card.red .v{color:#b91c1c}.card.red{background:#fef2f2;border-color:#fecaca}
  .detect{font-size:11px;color:#45464d;margin:2px 0 6px}
  h2{font-size:14px;margin:22px 0 8px}
  .legend{font-size:11px;color:#76777d;margin-bottom:8px}.legend mark{padding:0 5px;border-radius:3px}
  .doc{border:1px solid #e0e3e5;border-radius:12px;padding:16px 18px;background:#fff;line-height:1.9;font-size:13px;white-space:pre-wrap;word-wrap:break-word}
  mark.ai{background:#fef08a;color:#713f12;border-radius:3px;padding:0 2px}
  mark.plag{background:#fecaca;color:#7f1d1d;border-radius:3px;padding:0 2px}
  .profs{display:flex;flex-wrap:wrap;gap:10px}.prof{flex:1;min-width:220px;border:1px solid #e0e3e5;background:#fff;border-radius:12px;padding:12px 14px}
  .prof .s{font-weight:800;color:#0d9488}.prof ul{margin:6px 0 0;padding-left:16px;font-size:12px;color:#45464d}
  ul,ol{font-size:13px;color:#2b2f36}.src a{color:#0d9488}.sim{color:#76777d;font-weight:700;font-size:11px}.snip{color:#76777d;font-style:italic;font-size:12px}
  footer{margin-top:26px;padding-top:12px;border-top:1px solid #e0e3e5;font-size:11px;color:#76777d;line-height:1.6}
  @media print{body{background:#fff}.card,.doc,.prof{break-inside:avoid}}
</style></head><body><div class="wrap">
  <header><span class="logo">⚡</span><h1>Light Speed Ghost — Full Writing Check &amp; Peer Review</h1>
    <span class="meta">${esc(new Date().toLocaleString())}<br/>A writing aid — review before submitting.</span></header>
  <div class="detect"><b>Auto-detected:</b> ${esc(r.options.paperType)} · ${esc(r.options.level)} · ${esc(r.options.citationStyle.toUpperCase())} · ${esc(r.options.language)}</div>
  <div class="cards">${cards.join("")}</div>
  <div class="detect">${esc(r.grade.band)} — ${esc(r.rubricSummary)}</div>

  <h2>Three-reviewer panel (imitated MIT · Harvard · Yale)</h2><div class="profs">
    ${r.professors.map((p) => `<div class="prof"><div><b>${esc(p.name)}</b> — <span class="s">${p.score}% · ${esc(p.verdict)}</span></div>
      <div style="font-size:11px;color:#76777d">Focus: ${esc(p.focus)}</div><ul>${list(p.comments)}</ul></div>`).join("")}</div>

  <h2>Rubric — ${esc(r.options.paperType)}</h2><ul>${r.criteria.map((c) => `<li><b>${esc(c.label)}</b> — ${c.score}%: ${esc(c.note)}</li>`).join("")}</ul>
  ${r.gaps.length ? `<h2>Gaps</h2><ul>${list(r.gaps)}</ul>` : ""}
  ${r.mistakes.length ? `<h2>Mistakes to fix</h2><ul>${list(r.mistakes)}</ul>` : ""}
  ${r.improvements.length ? `<h2>What to improve</h2><ul>${list(r.improvements)}</ul>` : ""}
  ${r.strengths.length ? `<h2>Strengths</h2><ul>${list(r.strengths)}</ul>` : ""}
  <h2>Academic rules — ${esc(r.options.paperType)}</h2><ul>${list(r.rules)}</ul>

  <h2>Your document — AI &amp; plagiarism highlighted</h2>
  <div class="legend"><mark class="ai">Highlighted</mark> = AI-flagged · <mark class="plag">Highlighted</mark> = matched to a source</div>
  <div class="doc">${segHtml}</div>
  ${sourcesHtml}

  <h2>Probable questions (${r.questions.length})</h2><ol>${list(r.questions)}</ol>
  <footer>${d.detectionModel ? `Plagiarism/AI detection: ${esc(d.detectionModel)}.<br/>` : ""}Reviewed by an imitated MIT/Harvard/Yale-style panel — a deterministic rubric engine, not real people and not an AI model. Similarity is measured against live academic sources; AI-likelihood is statistical. Use this as a writing aid and always review before submitting.<br/>© ${new Date().getFullYear()} Light Speed Ghost · lightspeedghost.com</footer>
</div></body></html>`;
}

// ── Results panel (rendered inside the checker's "Peer Review" tab) ────────────
export function PeerReviewResults({
  result: r, authed, onRequireAuth,
}: {
  result: PeerReviewResult; authed: boolean; onRequireAuth?: () => void;
}) {
  const tone = gradeTone(r.grade.percent);
  const shownProfs = authed ? r.professors : r.professors.slice(1, 2); // guests: the Harvard-style reviewer
  const shownImprovements = authed ? r.improvements : r.improvements.slice(0, 3);
  const shownQuestions = authed ? r.questions : r.questions.slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Auto-detected banner — no selectors; the checker figures it out. */}
      <p className="text-[10px] text-[#76777d]">
        <span className="font-bold text-[#45464d]">Auto-detected:</span> {r.options.paperType} · {r.options.level} · {r.options.citationStyle.toUpperCase()} · {r.options.language}
      </p>

      {/* Grade */}
      <div className="flex items-center gap-3">
        <div className={`shrink-0 w-16 h-16 rounded-2xl border flex flex-col items-center justify-center ${tone.ring}`}>
          <span className={`text-2xl font-bold leading-none ${tone.text}`}>{r.grade.letter}</span>
          <span className="text-[8px] font-bold text-[#76777d] uppercase mt-0.5">{r.grade.percent}%</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#131b2e]">{r.grade.band}</p>
          <p className="text-[11px] text-[#45464d] leading-snug">{r.rubricSummary}</p>
          <p className="text-[10px] text-[#76777d] mt-0.5">{r.metrics.words.toLocaleString()} words · {r.metrics.citations} citation signals · avg sentence {r.metrics.avgSentence}w</p>
        </div>
      </div>

      {/* Professor panel */}
      <div>
        <p className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider mb-1.5">
          {authed ? "Three-reviewer panel (imitated MIT · Harvard · Yale)" : "Reviewer preview (Harvard-style)"}
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          {shownProfs.map((p) => (
            <div key={p.id} className="rounded-lg border border-[#e0e3e5] bg-[#fbfdfc] p-2.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-[#131b2e]">{p.school}</span>
                <span className="text-[11px] font-bold text-[#0d9488]">{p.score}%</span>
              </div>
              <p className="text-[9px] text-[#76777d] mb-1">{p.verdict}</p>
              <ul className="space-y-0.5">
                {p.comments.slice(0, authed ? 4 : 2).map((c, i) => (
                  <li key={i} className="text-[10px] text-[#45464d] leading-snug flex gap-1"><span className="text-[#10b981]">·</span><span>{c}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Rubric criteria (full only) */}
      {authed && (
        <div>
          <p className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider mb-1.5">Rubric — {r.options.paperType}</p>
          <div className="space-y-1.5">
            {r.criteria.map((c) => (
              <div key={c.key}>
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-[#45464d]">{c.label}</span>
                  <span className="font-bold text-[#131b2e]">{c.score}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#eceef0] overflow-hidden">
                  <div className={`h-full rounded-full ${gradeTone(c.score).bar}`} style={{ width: `${c.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gaps + mistakes (full) */}
      {authed && (r.gaps.length > 0 || r.mistakes.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-2">
          {r.gaps.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-[#b45309] uppercase tracking-wider mb-1 flex items-center gap-1"><ListChecks size={11} /> Gaps</p>
              <ul className="space-y-1">{r.gaps.map((g, i) => <li key={i} className="text-[10.5px] text-[#45464d] bg-amber-50 border border-amber-200 rounded-md px-2 py-1">{g}</li>)}</ul>
            </div>
          )}
          {r.mistakes.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-[#b91c1c] uppercase tracking-wider mb-1 flex items-center gap-1"><AlertTriangle size={11} /> Mistakes to fix</p>
              <ul className="space-y-1">{r.mistakes.map((m, i) => <li key={i} className="text-[10.5px] text-[#45464d] bg-red-50 border border-red-200 rounded-md px-2 py-1">{m}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {/* Improvements */}
      <div>
        <p className="text-[9px] font-bold text-[#047857] uppercase tracking-wider mb-1 flex items-center gap-1"><Lightbulb size={11} /> What to improve</p>
        <ul className="space-y-1">
          {shownImprovements.map((im, i) => (
            <li key={i} className="text-[10.5px] text-[#45464d] bg-[#eef7f1] border border-[#d1fae5] rounded-md px-2 py-1 flex gap-1.5">
              <Check size={11} className="text-[#10b981] shrink-0 mt-0.5" /> <span>{im}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Probable questions */}
      <div>
        <p className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider mb-1 flex items-center gap-1">
          <HelpCircle size={11} /> Probable questions {authed ? `(${r.questions.length})` : `(showing 5 of ${r.questions.length})`}
        </p>
        <ol className="space-y-1 list-decimal list-inside">
          {shownQuestions.map((q, i) => (
            <li key={i} className="text-[10.5px] text-[#45464d] leading-snug">{q}</li>
          ))}
        </ol>
      </div>

      {/* Guest gate */}
      {!authed && (
        <div className="rounded-lg border border-[#10b981]/30 bg-[#ecfdf5] px-3 py-2.5 text-center">
          <p className="text-[11px] font-bold text-[#0f5132] flex items-center justify-center gap-1.5 mb-1">
            <Lock size={12} /> This is a preview of your peer review
          </p>
          <p className="text-[10.5px] text-[#45733a] mb-2">Sign in free to unlock all three reviewers, the full rubric, every gap &amp; mistake, all {r.questions.length} questions, live plagiarism scanning, and a downloadable PDF report.</p>
          <button type="button" onClick={() => onRequireAuth?.()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-[11px] font-bold transition-colors">
            Unlock the full check <ArrowRight size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
