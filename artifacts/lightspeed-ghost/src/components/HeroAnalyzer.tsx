import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Wand2, BookOpen, SpellCheck2, Gauge, ArrowRight, Sparkles, Lock, Check,
  Plus, FlaskConical, PenLine, LayoutGrid, X, ShieldCheck, Loader2, ExternalLink,
  Download, GraduationCap, FileText, ThumbsUp, ThumbsDown,
} from "lucide-react";
import {
  analyzeAiLikelihood,
  analyzeReadability,
  checkGrammar,
  detectTone,
  type AiLikelihoodResult,
  type ReadabilityResult,
  type GrammarIssue,
  type ToneResult,
} from "@/lib/textAnalysis";
import { apiFetch } from "@/lib/apiFetch";
import { extractFile } from "@/lib/extractFile";
import {
  buildHighlightSegments,
  countHighlights,
  downloadScanReport,
  downloadReportPdf,
} from "@/lib/scanReport";
import { runPeerReview, autoDetectOptions, type PeerReviewResult } from "@/lib/peerReview";
import { PeerReviewResults, buildFullCheckReportHtml } from "@/components/PeerReview";

// ── The free tool: ONE "Check my writing" pass, no LLM ────────────────────────
// Clicking check runs everything at once over the text in the box:
//   • Instant, in-browser signals — AI detector, readability, grammar, tone
//   • Plagiarism — the real /plagiarism/check scan against live academic sources
//     (runs automatically after login; a sign-in teaser for guests)
//   • Peer Review — a professor-style rubric read with an auto-detected paper
//     type/level/style (the user is never asked), a 3-reviewer panel, a grade
//     estimate, gaps/mistakes/fixes and likely questions
// Signed-in users get the full result + a downloadable PDF/HTML report. Upload is
// the "+" button on the box. Nothing here ever calls an AI model.

type Tab = "ai" | "readability" | "grammar" | "tone" | "plagiarism" | "peer";

const TABS: Array<{ id: Tab; label: string; icon: typeof Wand2 }> = [
  { id: "ai",          label: "AI Detector",  icon: Wand2 },
  { id: "plagiarism",  label: "Plagiarism",   icon: ShieldCheck },
  { id: "peer",        label: "Peer Review",  icon: GraduationCap },
  { id: "readability", label: "Readability",  icon: Gauge },
  { id: "grammar",     label: "Grammar",      icon: SpellCheck2 },
  { id: "tone",        label: "Tone",         icon: BookOpen },
];

const ACTIONS: Array<{ label: string; icon: typeof Wand2; href?: string; accent: string }> = [
  { label: "Check my writing", icon: Sparkles,     accent: "text-[#10b981]" },
  { label: "Write Paper",      icon: PenLine,      href: "/write",     accent: "text-emerald-600" },
  { label: "Humanizer",        icon: Wand2,        href: "/humanizer", accent: "text-teal-700" },
  { label: "STEM Solver",      icon: FlaskConical, href: "/stem",      accent: "text-green-600" },
];

const SAMPLE_AI = `Furthermore, it is important to note that social media plays a crucial role in shaping adolescent development in today's world. Moreover, numerous studies have shown that excessive screen time has a significant impact on mental health outcomes. Additionally, it is essential to recognize that these multifaceted factors underscore the importance of digital literacy. In conclusion, it is clear that society must navigate the complexities of this evolving landscape in order to safeguard future generations.`;

const SAMPLE_HUMAN = `I didn't expect the data to look like this. Three cohorts, same protocol — and yet the attention scores diverge wildly after week six. Why? My best guess is the evening usage window. Teens who scrolled past midnight showed reaction times almost 14% slower, which lines up with what Okafor and Lin found last year. But here's the part that bugs me: the effect nearly vanishes on weekends. Sleep debt, maybe. Or something else we haven't measured yet.`;

interface Report {
  ai: AiLikelihoodResult;
  readability: ReadabilityResult;
  grammar: GrammarIssue[];
  tone: ToneResult;
}

interface ScanSource { url: string; similarity: number; matchedText?: string; title?: string; authors?: string; year?: number; }
interface ScanResult {
  aiScore: number;
  aiDetectionAvailable?: boolean;
  plagiarismScore: number;
  overallRisk: "low" | "medium" | "high";
  plagiarismSources?: ScanSource[];
  aiSections?: Array<{ text: string; score: number }>;
  aiFlags?: string[];
  burstiness?: number;
  detectionModel?: string;
  sourcesScanned?: string[];
}

function scoreColor(score: number): { text: string; bar: string; ring: string } {
  if (score < 35) return { text: "text-emerald-600", bar: "bg-emerald-500", ring: "border-emerald-200 bg-emerald-50" };
  if (score < 65) return { text: "text-amber-600", bar: "bg-amber-500", ring: "border-amber-200 bg-amber-50" };
  return { text: "text-red-600", bar: "bg-red-500", ring: "border-red-200 bg-red-50" };
}

function riskBadge(risk: "low" | "medium" | "high") {
  if (risk === "low") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (risk === "medium") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#e0e3e5] bg-[#eef7f1] px-3 py-2">
      <p className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-[#131b2e]">{value}</p>
      {sub && <p className="text-[9px] text-[#76777d]">{sub}</p>}
    </div>
  );
}

function ScoreDial({ label, score, sub }: { label: string; score: number; sub?: string }) {
  const c = scoreColor(score);
  return (
    <div className={`rounded-xl border p-3 text-center ${c.ring}`}>
      <div className={`text-2xl font-bold leading-none ${c.text}`}>{score}%</div>
      <div className="text-[10px] font-bold text-[#45464d] uppercase tracking-wide mt-1">{label}</div>
      {sub && <div className="text-[9px] text-[#76777d] mt-0.5">{sub}</div>}
    </div>
  );
}

export function HeroAnalyzer({
  authed = false,
  onRequireAuth,
}: {
  authed?: boolean;
  onRequireAuth?: () => void;
} = {}) {
  const [text, setText] = useState("");
  const [tab, setTab] = useState<Tab>("ai");
  const [report, setReport] = useState<Report | null>(null);
  const [peerResult, setPeerResult] = useState<PeerReviewResult | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Track the text the plagiarism scan last ran on, so re-clicking "Check" on the
  // same text doesn't spend another metered scan (quotas: free 3/mo, Pro 30/mo).
  const scannedTextRef = useRef("");

  // Plagiarism scan (server) state
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Self-learning capture: a thumbs up/down on the check feeds output_feedback,
  // which the aggregate loop uses to nudge each tool. Non-blocking, guest-safe.
  const [feedbackSent, setFeedbackSent] = useState<null | "up" | "down">(null);
  function sendFeedback(rating: "up" | "down") {
    if (feedbackSent) return;
    setFeedbackSent(rating);
    void apiFetch("/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "free-checker", rating, subject: peerResult?.options.paperType }),
    }).catch(() => {}); // fire-and-forget — never block or surface an error
  }

  const wordCount = useMemo(() => text.split(/\s+/).filter(Boolean).length, [text]);

  const highlightSegments = useMemo(() => {
    if (!report) return [];
    const aiSnippets = [
      ...report.ai.flaggedSentences.map((s) => s.text),
      ...(scanResult?.aiSections?.map((s) => s.text) ?? []),
    ];
    const plagSnippets = scanResult?.plagiarismSources?.map((s) => s.matchedText ?? "").filter(Boolean) ?? [];
    return buildHighlightSegments(text, aiSnippets, plagSnippets);
  }, [report, scanResult, text]);
  const highlightCounts = useMemo(() => countHighlights(highlightSegments), [highlightSegments]);

  function resetResults() {
    setReport(null);
    setPeerResult(null);
    setScanResult(null);
    setScanError(null);
    setFeedbackSent(null);
    scannedTextRef.current = "";
  }

  // ONE pass: instant signals + peer review + (after login) the plagiarism scan.
  function analyze(input?: string) {
    const t = input ?? text;
    if (!t.trim()) { taRef.current?.focus(); return; }
    setFeedbackSent(null);
    setReport({
      ai: analyzeAiLikelihood(t),
      readability: analyzeReadability(t),
      grammar: checkGrammar(t),
      tone: detectTone(t),
    });
    const words = t.split(/\s+/).filter(Boolean).length;
    try {
      setPeerResult(words >= 25 ? runPeerReview(t, autoDetectOptions(t)) : null);
    } catch {
      setPeerResult(null);
    }
    setTab("ai");
    // Plagiarism is part of the full check after login — but only spend a metered
    // scan when the text actually changed since the last one.
    if (authed) {
      if (t !== scannedTextRef.current) {
        scannedTextRef.current = t;
        setScanResult(null);
        setScanError(null);
        runFullScan(t);
      }
    } else {
      setScanResult(null);
      setScanError(null);
    }
  }

  function loadSample(sample: string) {
    setText(sample);
    resetResults();
    requestAnimationFrame(() => taRef.current?.focus());
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const extracted = await extractFile(file);
      if (!extracted.text?.trim()) throw new Error("No readable text found in that file.");
      setText(extracted.text);
      resetResults();
      analyze(extracted.text);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runFullScan(scanText: string) {
    if (!scanText.trim()) return;
    if (!authed) { onRequireAuth?.(); return; }
    setScanError(null);
    setScanResult(null);
    setScanning(true);
    setScanStep("Scanning against live academic sources…");
    try {
      const resp = await apiFetch("/plagiarism/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: scanText, checkAi: true, checkPlagiarism: true }),
      });
      if (!resp.ok || !resp.body) throw new Error("Scan failed — please try again.");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let event = "";
      let terminal = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (terminal) continue;
          if (line.startsWith("event: ")) {
            event = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (event === "step") {
                if (data.status === "running" && data.message) setScanStep(data.message);
              } else if (event === "done") {
                setScanResult(data as ScanResult);
                terminal = true;
              } else if (event === "error") {
                setScanError(data.message ?? "Scan failed.");
                terminal = true;
              }
            } catch { /* ignore parse errors */ }
            event = "";
          }
        }
      }
      if (!terminal) throw new Error("Scan interrupted — please try again.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed — please try again.";
      setScanError(msg.startsWith("{") ? "Scan failed — please try again." : msg);
    } finally {
      setScanning(false);
    }
  }

  function reportData() {
    if (!report || !peerResult) return null;
    return {
      text,
      highlights: highlightSegments,
      aiLikelihood: report.ai.score,
      readabilityLabel: report.readability.levelLabel,
      grammarIssues: report.grammar.length,
      toneLabel: report.tone.dominant,
      scanAiScore: scanResult?.aiScore,
      similarity: scanResult?.plagiarismScore,
      risk: scanResult?.overallRisk,
      detectionModel: scanResult?.detectionModel,
      sources: scanResult?.plagiarismSources?.map((s) => ({ url: s.url, similarity: s.similarity, matchedText: s.matchedText, title: s.title })),
      peer: peerResult,
    };
  }
  function downloadPdf() { const d = reportData(); if (d) downloadReportPdf(buildFullCheckReportHtml(d)); }
  function downloadHtml() { const d = reportData(); if (d) downloadScanReport(buildFullCheckReportHtml(d), `lightspeedghost-check-${new Date().toISOString().slice(0, 10)}.html`); }

  const ai = report?.ai;
  const colors = ai ? scoreColor(ai.score) : null;

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* ── The command box ── */}
      <div className="rounded-[26px] border border-[#e0e3e5] bg-white shadow-[0_18px_50px_-20px_rgba(19,27,46,0.28)] focus-within:border-[#10b981]/50 focus-within:shadow-[0_18px_50px_-16px_rgba(16,185,129,0.30)] transition-all overflow-hidden">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => { setText(e.target.value); resetResults(); }}
          placeholder="Write, paste, or upload your paper — one free check for AI, plagiarism, peer review and more…"
          rows={4}
          className="w-full resize-none bg-transparent px-5 pt-5 pb-2 text-[15px] text-[#191c1e] placeholder:text-[#9aa0a6] focus:outline-none leading-relaxed"
        />
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
        />
        <div className="flex items-center gap-2 px-3.5 pb-3.5 pt-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Upload a file (PDF, Word or text)"
            aria-label="Upload a file"
            className="w-9 h-9 rounded-full border border-[#e0e3e5] text-[#45464d] hover:border-[#10b981] hover:text-[#10b981] flex items-center justify-center transition-colors shrink-0 disabled:opacity-60"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={17} />}
          </button>
          {text && (
            <button
              type="button"
              onClick={() => { setText(""); resetResults(); setUploadError(null); taRef.current?.focus(); }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#76777d] hover:text-[#45464d] px-2 py-1 rounded-md hover:bg-[#e8f3ed] transition-colors"
            >
              <X size={12} /> Clear
            </button>
          )}
          <span className="ml-auto text-[11px] text-[#76777d] tabular-nums">{wordCount} words</span>
          <button
            type="button"
            onClick={() => analyze()}
            aria-label="Check my writing"
            className="w-9 h-9 rounded-full bg-[#10b981] hover:bg-[#059669] text-white flex items-center justify-center transition-colors shadow-md shadow-[#10b981]/30 shrink-0"
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
      {uploadError && <p className="mt-2 text-[11px] text-red-600 text-center">{uploadError}</p>}

      {/* ── Action row ── */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        {ACTIONS.map(({ label, icon: Icon, href, accent }) => {
          const inner = (
            <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e0e3e5] bg-white text-sm font-semibold text-[#191c1e] hover:border-[#10b981]/50 hover:bg-[#f0fdf4] cursor-pointer transition-all shadow-sm">
              <Icon size={15} className={accent} /> {label}
            </span>
          );
          return href ? (
            <Link key={label} href={href}>{inner}</Link>
          ) : (
            <button key={label} type="button" onClick={() => analyze()}>{inner}</button>
          );
        })}
        <a
          href="#tools"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e0e3e5] bg-white text-sm font-semibold text-[#45464d] hover:border-[#10b981]/50 hover:bg-[#f0fdf4] transition-all shadow-sm"
        >
          <LayoutGrid size={15} className="text-[#76777d]" /> More
        </a>
      </div>

      {/* Reassurance + samples */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3.5 text-[11px] text-[#76777d]">
        <span className="inline-flex items-center gap-1.5"><Lock size={11} className="text-emerald-600" /> One check: AI · plagiarism · peer review — no AI model</span>
        <span className="hidden sm:inline text-[#c6c6cd]">·</span>
        <button type="button" onClick={() => loadSample(SAMPLE_AI)} className="font-semibold text-[#10b981] hover:underline">Try an AI-written sample</button>
        <button type="button" onClick={() => loadSample(SAMPLE_HUMAN)} className="font-semibold text-[#10b981] hover:underline">Try a human sample</button>
      </div>

      {/* ── Unified report ── */}
      {report && (
        <div className="mt-5 rounded-2xl border border-[#e0e3e5] bg-white shadow-lg overflow-hidden text-left">
          {/* Header: title + download (after login) */}
          <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
            <p className="text-xs font-bold text-[#131b2e] flex items-center gap-1.5">
              <Sparkles size={13} className="text-[#10b981]" /> Your writing check
              {authed && scanning && <span className="text-[10px] font-medium text-[#76777d] inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> scanning plagiarism…</span>}
            </p>
            {authed && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={downloadPdf}
                  title="Download the full report as PDF"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#10b981] hover:bg-[#059669] text-white text-[10px] font-bold transition-colors"
                >
                  <Download size={11} /> Download PDF
                </button>
                <button type="button" onClick={downloadHtml} title="Download as HTML" className="text-[10px] font-semibold text-[#76777d] hover:text-[#10b981] transition-colors">HTML</button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-3 pt-2 border-b border-[#eceef0] overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[12px] font-semibold whitespace-nowrap transition-colors ${
                  tab === id ? "text-[#10b981] border-b-2 border-[#10b981] -mb-px" : "text-[#45464d] hover:text-[#191c1e]"
                }`}
              >
                <Icon size={13} /> {label}
                {id === "plagiarism" && authed && scanning && <Loader2 size={10} className="animate-spin" />}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === "ai" && ai && colors && (
              <div>
                <div className="flex items-center gap-3 mb-2.5">
                  <div className={`shrink-0 w-16 h-16 rounded-full border-4 ${colors.ring} flex flex-col items-center justify-center`}>
                    <span className={`text-lg font-bold leading-none ${colors.text}`}>{ai.score}%</span>
                    <span className="text-[8px] font-bold text-[#76777d] uppercase">AI-like</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#131b2e]">
                      {ai.verdict === "human" ? "Reads human-written" : ai.verdict === "mixed" ? "Mixed signals detected" : "Likely AI-generated"}
                    </p>
                    <p className="text-[11px] text-[#45464d] leading-snug">
                      Sentence-rhythm variance (burstiness) {ai.stdDev} words · {ai.perplexity}% AI-pattern predictability
                      {!ai.meetsMinimumWordCount && " · paste 100+ words for a reliable score"}
                    </p>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-[#eceef0] overflow-hidden mb-2.5">
                  <div className={`h-full rounded-full ${colors.bar} transition-all`} style={{ width: `${ai.score}%` }} />
                </div>
                {ai.flaggedSentences.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider">Most AI-sounding sentences</p>
                    {ai.flaggedSentences.slice(0, 2).map((s) => (
                      <p key={s.text.slice(0, 40)} className="text-[10.5px] text-[#45464d] bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 leading-snug">
                        "{s.text.length > 130 ? s.text.slice(0, 130) + "…" : s.text}" <span className="font-bold text-amber-700">{s.score}%</span>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-emerald-700">
                    <Check size={11} strokeWidth={3} /> No AI-typical phrasing flagged
                  </p>
                )}
              </div>
            )}

            {tab === "plagiarism" && (
              <div>
                {!authed ? (
                  <div className="rounded-xl border border-[#d1fae5] bg-[#ecfdf5] px-3.5 py-3 text-center">
                    <p className="text-[12px] font-bold text-[#0f5132] flex items-center justify-center gap-1.5 mb-1"><ShieldCheck size={13} /> Plagiarism scan against 10B+ live sources</p>
                    <p className="text-[10.5px] text-[#45733a] mb-2">Sign in free to scan your text against live academic databases sentence by sentence — every match traced to its real source, on the same report as your AI score.</p>
                    <button type="button" onClick={() => onRequireAuth?.()} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-[11px] font-bold transition-colors">
                      Sign in to run the plagiarism scan <ArrowRight size={11} />
                    </button>
                  </div>
                ) : scanning ? (
                  <p className="text-[11px] text-[#047857] flex items-center gap-1.5 py-4 justify-center"><Loader2 size={13} className="animate-spin" /> {scanStep}</p>
                ) : scanError ? (
                  <div className="text-center py-2">
                    <p className="text-[11px] text-red-600 mb-2">{scanError}</p>
                    <button type="button" onClick={() => runFullScan(text)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-[11px] font-bold"><ShieldCheck size={12} /> Retry scan</button>
                  </div>
                ) : scanResult ? (
                  <div>
                    <div className="flex items-center justify-end mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${riskBadge(scanResult.overallRisk)}`}>{scanResult.overallRisk} risk</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <ScoreDial label="AI content" score={scanResult.aiScore ?? 0} sub={scanResult.detectionModel} />
                      <ScoreDial label="Similarity" score={scanResult.plagiarismScore ?? 0} sub="vs. academic sources" />
                    </div>
                    {scanResult.plagiarismSources && scanResult.plagiarismSources.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider">Matching sources</p>
                        {scanResult.plagiarismSources.slice(0, 6).map((s, i) => (
                          <a key={i} href={s.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 text-[10.5px] bg-[#eef7f1] border border-[#e0e3e5] rounded-lg px-2.5 py-1.5 hover:border-[#10b981]/40 transition-colors">
                            <span className="truncate text-[#45464d]">{s.title || s.url}{s.matchedText && <span className="text-[#76777d]"> — "{s.matchedText.slice(0, 60)}"</span>}</span>
                            <span className="shrink-0 flex items-center gap-1 font-bold text-[#76777d]">{Math.round(s.similarity)}% <ExternalLink size={10} /></span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-emerald-700"><Check size={11} strokeWidth={3} /> No significant matching sources found</p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <button type="button" onClick={() => runFullScan(text)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-[11px] font-bold"><ShieldCheck size={12} /> Run plagiarism scan</button>
                  </div>
                )}
              </div>
            )}

            {tab === "peer" && (
              peerResult ? (
                <PeerReviewResults result={peerResult} authed={authed} onRequireAuth={onRequireAuth} />
              ) : (
                <p className="text-[11px] text-[#76777d] flex items-center gap-1.5 py-3 justify-center"><FileText size={12} /> Add ~40+ words (type, paste, or upload) for a peer review.</p>
              )
            )}

            {tab === "readability" && report.readability && (
              <div>
                <p className="text-sm font-bold text-[#131b2e] mb-2">
                  {report.readability.levelLabel} <span className="text-[#76777d] font-medium text-xs">· Flesch-Kincaid grade {report.readability.fleschKincaidGrade}</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <Metric label="Reading ease" value={String(report.readability.fleschReadingEase)} sub="0–100, higher = easier" />
                  <Metric label="Avg sentence" value={`${report.readability.avgSentenceLength} w`} />
                  <Metric label="Word count" value={String(report.readability.wordCount)} />
                  <Metric label="Reading time" value={`${report.readability.readingTime} min`} />
                </div>
              </div>
            )}

            {tab === "grammar" && (
              <div>
                <p className="text-sm font-bold text-[#131b2e] mb-2">
                  {report.grammar.length === 0 ? "No issues found" : `${report.grammar.length} issue${report.grammar.length === 1 ? "" : "s"} found`}
                </p>
                {report.grammar.length === 0 ? (
                  <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-emerald-700">
                    <Check size={11} strokeWidth={3} /> Grammar, spelling and style look clean
                  </p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {report.grammar.slice(0, 6).map((iss, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10.5px] bg-[#eef7f1] border border-[#e0e3e5] rounded-lg px-2.5 py-1.5">
                        <span className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${iss.severity === "error" ? "bg-red-500" : iss.severity === "warning" ? "bg-amber-500" : "bg-emerald-500"}`} />
                        <span className="text-[#45464d] leading-snug">{iss.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "tone" && report.tone && (
              <div>
                <p className="text-sm font-bold text-[#131b2e] capitalize mb-1">{report.tone.dominant} tone <span className="text-[#76777d] font-medium text-xs">· formality {report.tone.formality}/100</span></p>
                <p className="text-[11px] text-[#45464d] leading-relaxed mb-2">{report.tone.suggestion}</p>
                <div className="flex flex-wrap gap-1.5">
                  {report.tone.scores.slice(0, 4).map((s) => (
                    <span key={s.tone} className="text-[9.5px] font-semibold text-[#45464d] bg-[#eef7f1] border border-[#e0e3e5] rounded-full px-2 py-0.5 capitalize">
                      {s.tone} {s.score}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Highlighted document — exactly where AI + plagiarism are, Turnitin-style */}
            <div className="mt-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5 text-[9.5px] text-[#76777d]">
                <p className="text-[9px] font-bold uppercase tracking-wider mr-1">Highlighted document</p>
                <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#fef08a] border border-[#fde68a]" /> AI-flagged ({highlightCounts.ai})</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#fecaca] border border-[#fca5a5]" /> Matched to a source ({highlightCounts.plag})</span>
                {!authed && <span className="text-[#9aa0a6]">Sign in to add source-match highlighting</span>}
              </div>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-[#e0e3e5] bg-[#fbfdfc] px-3.5 py-3 text-[12.5px] leading-[1.9] text-[#2b2f36] whitespace-pre-wrap break-words">
                {highlightSegments.map((seg, i) =>
                  seg.type === "ai" ? (
                    <mark key={i} className="bg-[#fef08a] text-[#713f12] rounded-[3px] px-0.5">{seg.text}</mark>
                  ) : seg.type === "plag" ? (
                    <mark key={i} className="bg-[#fecaca] text-[#7f1d1d] rounded-[3px] px-0.5">{seg.text}</mark>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )}
              </div>
              {!authed && (
                <p className="mt-2.5 text-[10.5px] text-[#45733a] bg-[#ecfdf5] border border-[#d1fae5] rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                  <span>Sign in free for the plagiarism scan, the full peer review, and a downloadable PDF report.</span>
                  <button type="button" onClick={() => onRequireAuth?.()} className="shrink-0 inline-flex items-center gap-1 font-bold text-[#10b981] hover:text-[#059669]">Unlock <ArrowRight size={11} /></button>
                </p>
              )}
            </div>

            {/* Was this helpful? — feeds the self-learning loop (output_feedback) */}
            <div className="mt-3 pt-2.5 border-t border-[#eceef0] flex items-center justify-center gap-2 text-[10.5px] text-[#76777d]">
              {feedbackSent ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700"><Check size={11} strokeWidth={3} /> Thanks — your feedback helps us improve.</span>
              ) : (
                <>
                  <span className="font-semibold">Was this check helpful?</span>
                  <button type="button" onClick={() => sendFeedback("up")} title="Yes, helpful" className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-[#e0e3e5] text-[#45464d] hover:border-[#10b981] hover:text-[#10b981] transition-colors"><ThumbsUp size={12} /></button>
                  <button type="button" onClick={() => sendFeedback("down")} title="Not helpful" className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-[#e0e3e5] text-[#45464d] hover:border-red-400 hover:text-red-500 transition-colors"><ThumbsDown size={12} /></button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
