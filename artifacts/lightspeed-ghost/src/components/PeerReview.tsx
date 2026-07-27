import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap, Loader2, Upload, ArrowRight, Download, Check, AlertTriangle,
  Lightbulb, ListChecks, HelpCircle, Lock, FileText,
} from "lucide-react";
import FileUploadZone from "@/components/FileUploadZone";
import { downloadScanReport } from "@/lib/scanReport";
import {
  runPeerReview,
  PAPER_TYPES, CITATION_STYLES, SPACINGS, LANGUAGES, ACADEMIC_LEVELS,
  type PeerReviewOptions, type PeerReviewResult, type PaperType,
  type CitationStyle, type AcademicLevel,
} from "@/lib/peerReview";

// ── Peer Review — professor-style, 100% no-LLM, part of the free checker ──────
// Guests get a real snippet (grade + one reviewer + a few fixes and questions);
// signed-in users get the full panel + downloadable report. Everything runs
// client-side over the text; no AI model is ever called.

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function gradeTone(pct: number): { text: string; ring: string; bar: string } {
  if (pct >= 80) return { text: "text-emerald-600", ring: "border-emerald-200 bg-emerald-50", bar: "bg-emerald-500" };
  if (pct >= 60) return { text: "text-amber-600", ring: "border-amber-200 bg-amber-50", bar: "bg-amber-500" };
  return { text: "text-red-600", ring: "border-red-200 bg-red-50", bar: "bg-red-500" };
}

function buildReportHtml(r: PeerReviewResult, text: string): string {
  const segHtml = r.highlights
    .map((s) => (s.type ? `<mark>${esc(s.text).replace(/\n/g, "<br/>")}</mark>` : esc(s.text).replace(/\n/g, "<br/>")))
    .join("");
  const list = (items: string[]) => items.map((i) => `<li>${esc(i)}</li>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Light Speed Ghost — Peer Review Report</title><style>
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#131b2e;background:#f4faf6;margin:0}
  .wrap{max-width:840px;margin:0 auto;padding:32px 24px 56px}
  header{display:flex;align-items:center;gap:10px;border-bottom:2px solid #d1fae5;padding-bottom:14px;margin-bottom:18px}
  .logo{width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#10b981,#0d9488);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800}
  h1{font-size:16px;margin:0}.meta{margin-left:auto;text-align:right;font-size:11px;color:#76777d}
  .grade{display:flex;gap:16px;align-items:center;border:1px solid #a7f3d0;background:#ecfdf5;border-radius:14px;padding:16px 20px;margin-bottom:18px}
  .grade .big{font-size:40px;font-weight:800;color:#059669;line-height:1}
  h2{font-size:14px;margin:22px 0 8px}
  .profs{display:flex;flex-wrap:wrap;gap:10px}.prof{flex:1;min-width:210px;border:1px solid #e0e3e5;background:#fff;border-radius:12px;padding:12px 14px}
  .prof .s{font-weight:800;color:#0d9488}.prof ul{margin:6px 0 0;padding-left:16px;font-size:12px;color:#45464d}
  ul{font-size:13px;color:#2b2f36}.crit{font-size:13px}
  .doc{border:1px solid #e0e3e5;border-radius:12px;padding:16px 18px;background:#fff;line-height:1.9;font-size:13px;white-space:pre-wrap;word-wrap:break-word}
  mark{background:#fef08a;color:#713f12;border-radius:3px;padding:0 2px}
  .q{font-size:13px;color:#2b2f36}.q li{margin-bottom:4px}
  footer{margin-top:26px;padding-top:12px;border-top:1px solid #e0e3e5;font-size:11px;color:#76777d;line-height:1.6}
  @media print{body{background:#fff}}
</style></head><body><div class="wrap">
  <header><span class="logo">⚡</span><h1>Light Speed Ghost — Peer Review Report</h1>
    <span class="meta">${esc(r.options.paperType)} · ${esc(r.options.level)}<br/>${esc(new Date().toLocaleString())}</span></header>
  <div class="grade"><div><div class="big">${r.grade.letter}</div></div>
    <div><div style="font-size:22px;font-weight:800">${r.grade.percent}%</div>
    <div style="font-size:12px;color:#45464d">${esc(r.grade.band)} · target for ${esc(r.options.level)}</div>
    <div style="font-size:11px;color:#76777d;margin-top:4px">${esc(r.rubricSummary)}</div></div></div>
  <h2>Three-reviewer panel (imitated)</h2><div class="profs">
    ${r.professors.map((p) => `<div class="prof"><div><b>${esc(p.name)}</b> — <span class="s">${p.score}% · ${esc(p.verdict)}</span></div>
      <div style="font-size:11px;color:#76777d">Focus: ${esc(p.focus)}</div><ul>${list(p.comments)}</ul></div>`).join("")}
  </div>
  <h2>Rubric</h2><ul class="crit">${r.criteria.map((c) => `<li><b>${esc(c.label)}</b> — ${c.score}%: ${esc(c.note)}</li>`).join("")}</ul>
  ${r.gaps.length ? `<h2>Gaps</h2><ul>${list(r.gaps)}</ul>` : ""}
  ${r.mistakes.length ? `<h2>Mistakes to fix</h2><ul>${list(r.mistakes)}</ul>` : ""}
  ${r.improvements.length ? `<h2>What to improve</h2><ul>${list(r.improvements)}</ul>` : ""}
  ${r.strengths.length ? `<h2>Strengths</h2><ul>${list(r.strengths)}</ul>` : ""}
  <h2>Academic rules — ${esc(r.options.paperType)}</h2><ul>${list(r.rules)}</ul>
  <h2>Document — highlighted weak spots</h2><div class="doc">${segHtml || esc(text)}</div>
  <h2>Probable questions (${r.questions.length})</h2><ol class="q">${list(r.questions)}</ol>
  <footer>Reviewed by an imitated MIT/Harvard/Yale-style panel — a deterministic rubric engine, not real people and not an AI model. Use this as a writing aid; always review and edit before submitting.<br/>© ${new Date().getFullYear()} Light Speed Ghost · lightspeedghost.com</footer>
</div></body></html>`;
}

const SELECT_CLS = "w-full appearance-none rounded-lg border border-[#e0e3e5] bg-white px-2.5 py-1.5 text-[11px] text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-[#10b981]/30";

export function PeerReview({
  text,
  authed = false,
  onRequireAuth,
  onText,
}: {
  text: string;
  authed?: boolean;
  onRequireAuth?: () => void;
  onText?: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<PeerReviewOptions>({
    paperType: "Essay",
    citationStyle: "apa",
    spacing: "Double",
    minSources: "auto",
    language: "US English",
    level: "UG Year 1–2",
  });
  const [result, setResult] = useState<PeerReviewResult | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const wordCount = useMemo(() => text.split(/\s+/).filter(Boolean).length, [text]);

  // A prior review is stale once the text changes (typing or a new upload).
  useEffect(() => { setResult(null); setErr(null); }, [text]);

  function run() {
    if (!text.trim() || wordCount < 40) {
      setErr("Add at least ~40 words (paste or upload) for a reliable peer review.");
      return;
    }
    setErr(null);
    setRunning(true);
    // Deterministic + local — defer a tick so the spinner paints.
    setTimeout(() => {
      try {
        setResult(runPeerReview(text, opts));
      } catch {
        setErr("Could not review this text — please try again.");
      } finally {
        setRunning(false);
      }
    }, 40);
  }

  function download() {
    if (!result) return;
    downloadScanReport(buildReportHtml(result, text), `lightspeedghost-peer-review-${new Date().toISOString().slice(0, 10)}.html`);
  }

  const set = <K extends keyof PeerReviewOptions>(k: K, v: PeerReviewOptions[K]) => setOpts((p) => ({ ...p, [k]: v }));

  return (
    <div className="mt-3.5 rounded-xl border border-[#c7e9d5] bg-[#f3fbf6] overflow-hidden">
      {/* Launcher header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3.5 py-3 text-left"
      >
        <span className="w-7 h-7 rounded-lg bg-[#10b981] flex items-center justify-center shrink-0">
          <GraduationCap size={15} className="text-white" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[12px] font-bold text-[#0f5132]">Peer Review — a professor-style read before you submit</span>
          <span className="block text-[10.5px] text-[#45733a]">Rubric + 3-reviewer panel (MIT · Harvard · Yale style) · grade estimate · likely questions · no AI model used</span>
        </span>
        <ArrowRight size={15} className={`text-[#10b981] shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3">
          {/* Options */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider">Paper type</span>
              <select value={opts.paperType} onChange={(e) => set("paperType", e.target.value as PaperType)} className={SELECT_CLS}>
                {PAPER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider">Academic level</span>
              <select value={opts.level} onChange={(e) => set("level", e.target.value as AcademicLevel)} className={SELECT_CLS}>
                {ACADEMIC_LEVELS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider">Citation style</span>
              <select value={opts.citationStyle} onChange={(e) => set("citationStyle", e.target.value as CitationStyle)} className={SELECT_CLS}>
                {CITATION_STYLES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider">Spacing</span>
              <select value={opts.spacing} onChange={(e) => set("spacing", e.target.value as PeerReviewOptions["spacing"])} className={SELECT_CLS}>
                {SPACINGS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider">Min. sources</span>
              <select value={String(opts.minSources)} onChange={(e) => set("minSources", e.target.value === "auto" ? "auto" : Number(e.target.value))} className={SELECT_CLS}>
                <option value="auto">Auto</option>
                {[1, 3, 5, 8, 10, 15, 20, 30, 40].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider">Language</span>
              <select value={opts.language} onChange={(e) => set("language", e.target.value as PeerReviewOptions["language"])} className={SELECT_CLS}>
                {LANGUAGES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>

          {/* Upload + run */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex-1">
              <FileUploadZone
                compact
                label="Upload your paper"
                hint="PDF, Word or text — extracted into the box above"
                onExtracted={(f) => { onText?.(f.text); setResult(null); setErr(null); }}
              />
            </div>
            <button
              type="button"
              onClick={run}
              disabled={running}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#059669] disabled:opacity-60 text-white text-[12px] font-bold transition-colors whitespace-nowrap"
            >
              {running ? <Loader2 size={13} className="animate-spin" /> : <GraduationCap size={13} />}
              {running ? "Reviewing…" : "Run peer review"}
            </button>
          </div>
          <p className="text-[10px] text-[#76777d] flex items-center gap-1.5">
            <FileText size={10} /> Reviews the {wordCount.toLocaleString()} words in the box above · runs privately in your browser, never sent to an AI model
          </p>
          {err && <p className="text-[10.5px] text-red-600 flex items-center gap-1.5"><AlertTriangle size={11} /> {err}</p>}

          {result && <PeerReviewResults result={result} authed={authed} onRequireAuth={onRequireAuth} onDownload={download} />}
        </div>
      )}
    </div>
  );
}

function PeerReviewResults({
  result: r, authed, onRequireAuth, onDownload,
}: {
  result: PeerReviewResult; authed: boolean; onRequireAuth?: () => void; onDownload: () => void;
}) {
  const tone = gradeTone(r.grade.percent);
  const shownProfs = authed ? r.professors : r.professors.slice(1, 2); // guests: the Harvard-style reviewer
  const shownImprovements = authed ? r.improvements : r.improvements.slice(0, 3);
  const shownQuestions = authed ? r.questions : r.questions.slice(0, 5);

  return (
    <div className="rounded-xl border border-[#e0e3e5] bg-white p-3.5 space-y-3">
      {/* Grade */}
      <div className="flex items-center justify-between gap-2">
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
        {authed && (
          <button type="button" onClick={onDownload} title="Download the full peer-review report"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#10b981]/40 bg-[#ecfdf5] text-[#047857] text-[10px] font-bold hover:bg-[#d1fae5] transition-colors shrink-0">
            <Download size={11} /> Download
          </button>
        )}
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

      {/* Highlighted weak spots (full) */}
      {authed && (
        <div>
          <p className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider mb-1">Document — weak spots highlighted</p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-[#e0e3e5] bg-[#fbfdfc] px-3 py-2.5 text-[12px] leading-[1.9] text-[#2b2f36] whitespace-pre-wrap break-words">
            {r.highlights.map((s, i) => s.type
              ? <mark key={i} className="bg-[#fef08a] text-[#713f12] rounded-[3px] px-0.5">{s.text}</mark>
              : <span key={i}>{s.text}</span>)}
          </div>
        </div>
      )}

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
          <p className="text-[10.5px] text-[#45733a] mb-2">Sign in free to unlock all three reviewers, the full rubric, every gap &amp; mistake, weak-spot highlighting, all {r.questions.length} questions, and a downloadable report.</p>
          <button type="button" onClick={() => onRequireAuth?.()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-[11px] font-bold transition-colors">
            Unlock the full peer review <ArrowRight size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
