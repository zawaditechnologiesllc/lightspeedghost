import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Wand2, BookOpen, SpellCheck2, Gauge, ArrowRight, Sparkles, Lock, Check,
  Plus, FlaskConical, PenLine, LayoutGrid, X, ShieldCheck, Loader2, ExternalLink,
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

// ── The free tool: one powerful AI + plagiarism + writing checker ─────────────
// Two layers in a single box:
//   1. Instant, in-browser report (AI-likelihood, readability, grammar, tone) —
//      runs client-side, no login, never touches an AI model.
//   2. The full AI & plagiarism scan (the deep check that used to be its own
//      tool) — runs the real /plagiarism/check endpoint when signed in: measured
//      AI score, similarity against live academic sources with links, and the
//      most AI-sounding sections. Guests are prompted to sign in for it.

type Tab = "ai" | "readability" | "grammar" | "tone";

const TABS: Array<{ id: Tab; label: string; icon: typeof Wand2 }> = [
  { id: "ai",          label: "AI Detector",  icon: Wand2 },
  { id: "readability", label: "Readability",  icon: Gauge },
  { id: "grammar",     label: "Grammar",      icon: SpellCheck2 },
  { id: "tone",        label: "Tone",         icon: BookOpen },
];

// Tool shortcuts shown beneath the box. The first runs the instant in-browser
// check; the rest deep-link into the real tools (AuthGuard prompts sign-up).
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

// Shape of the /plagiarism/check "done" payload (loosely typed — we render a subset).
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
    <div className="rounded-lg border border-[#e0e3e5] bg-[#f7f9fb] px-3 py-2">
      <p className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-[#131b2e]">{value}</p>
      {sub && <p className="text-[9px] text-[#76777d]">{sub}</p>}
    </div>
  );
}

// Big score dial used by the full scan (AI %, Similarity %).
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
  /** True when a signed-in user is using the tool (dashboard). Enables the full scan inline. */
  authed?: boolean;
  /** Called when a guest tries to run the full scan (opens sign-in). */
  onRequireAuth?: () => void;
} = {}) {
  const [text, setText] = useState("");
  const [tab, setTab] = useState<Tab>("ai");
  const [report, setReport] = useState<Report | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Full AI + plagiarism scan (server) state
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const wordCount = useMemo(() => text.split(/\s+/).filter(Boolean).length, [text]);

  function analyze(input?: string) {
    const t = input ?? text;
    if (!t.trim()) { taRef.current?.focus(); return; }
    setReport({
      ai: analyzeAiLikelihood(t),
      readability: analyzeReadability(t),
      grammar: checkGrammar(t),
      tone: detectTone(t),
    });
  }

  function loadSample(sample: string) {
    setText(sample);
    setReport(null);
    setScanResult(null);
    setScanError(null);
    requestAnimationFrame(() => taRef.current?.focus());
  }

  // Run the real AI + plagiarism scan (the deep check) inline.
  async function runFullScan() {
    if (!text.trim()) { taRef.current?.focus(); return; }
    if (!authed) { onRequireAuth?.(); return; }
    if (!report) analyze(); // make sure the instant report is shown too
    setScanError(null);
    setScanResult(null);
    setScanning(true);
    setScanStep("Starting scan…");
    try {
      const resp = await apiFetch("/plagiarism/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, checkAi: true, checkPlagiarism: true }),
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

  const ai = report?.ai;
  const colors = ai ? scoreColor(ai.score) : null;

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* ── The command box ── */}
      <div className="rounded-[26px] border border-[#e0e3e5] bg-white shadow-[0_18px_50px_-20px_rgba(19,27,46,0.28)] focus-within:border-[#10b981]/50 focus-within:shadow-[0_18px_50px_-16px_rgba(16,185,129,0.30)] transition-all overflow-hidden">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => { setText(e.target.value); setReport(null); setScanResult(null); setScanError(null); }}
          placeholder="Write, paste, or upload your text — check it free, no account needed…"
          rows={4}
          className="w-full resize-none bg-transparent px-5 pt-5 pb-2 text-[15px] text-[#191c1e] placeholder:text-[#9aa0a6] focus:outline-none leading-relaxed"
        />
        <div className="flex items-center gap-2 px-3.5 pb-3.5 pt-1">
          <button
            type="button"
            onClick={() => loadSample(SAMPLE_AI)}
            title="Load a sample to try it"
            className="w-9 h-9 rounded-full border border-[#e0e3e5] text-[#45464d] hover:border-[#10b981] hover:text-[#10b981] flex items-center justify-center transition-colors shrink-0"
          >
            <Plus size={17} />
          </button>
          {text && (
            <button
              type="button"
              onClick={() => { setText(""); setReport(null); setScanResult(null); setScanError(null); taRef.current?.focus(); }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#76777d] hover:text-[#45464d] px-2 py-1 rounded-md hover:bg-[#f2f4f6] transition-colors"
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

      {/* Sample + reassurance */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3.5 text-[11px] text-[#76777d]">
        <span className="inline-flex items-center gap-1.5"><Lock size={11} className="text-emerald-600" /> Instant check runs in your browser</span>
        <span className="hidden sm:inline text-[#c6c6cd]">·</span>
        <button type="button" onClick={() => loadSample(SAMPLE_AI)} className="font-semibold text-[#10b981] hover:underline">Try an AI-written sample</button>
        <button type="button" onClick={() => loadSample(SAMPLE_HUMAN)} className="font-semibold text-[#10b981] hover:underline">Try a human sample</button>
      </div>

      {/* ── Instant client-side report ── */}
      {report && (
        <div className="mt-5 rounded-2xl border border-[#e0e3e5] bg-white shadow-lg overflow-hidden text-left">
          <div className="flex items-center gap-1 px-3 pt-3 border-b border-[#eceef0] overflow-x-auto">
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
                      <div key={i} className="flex items-start gap-2 text-[10.5px] bg-[#f7f9fb] border border-[#e0e3e5] rounded-lg px-2.5 py-1.5">
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
                    <span key={s.tone} className="text-[9.5px] font-semibold text-[#45464d] bg-[#f7f9fb] border border-[#e0e3e5] rounded-full px-2 py-0.5 capitalize">
                      {s.tone} {s.score}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Full AI & plagiarism scan launcher */}
            <div className="mt-3.5 rounded-xl border border-[#d1fae5] bg-[#ecfdf5] px-3.5 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <p className="text-[11px] text-[#45464d] leading-snug flex-1">
                  <span className="font-bold text-[#047857]">Full AI &amp; plagiarism scan.</span> Measured AI score + similarity against 10B+ live academic sources, with the exact matching sentences and sources.
                </p>
                {authed ? (
                  <button
                    type="button"
                    onClick={runFullScan}
                    disabled={scanning}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#10b981] hover:bg-[#059669] disabled:opacity-60 text-white text-[11px] font-bold transition-colors whitespace-nowrap"
                  >
                    {scanning ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                    {scanning ? "Scanning…" : "Run full scan"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRequireAuth?.()}
                    className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#10b981] hover:text-[#059669] whitespace-nowrap"
                  >
                    Sign in to run the full scan <ArrowRight size={11} />
                  </button>
                )}
              </div>

              {scanning && scanStep && (
                <p className="mt-2 text-[10.5px] text-[#047857] flex items-center gap-1.5">
                  <Loader2 size={10} className="animate-spin" /> {scanStep}
                </p>
              )}
              {scanError && (
                <p className="mt-2 text-[10.5px] text-red-600">{scanError}</p>
              )}
            </div>

            {/* Full scan results */}
            {scanResult && (
              <div className="mt-3 rounded-xl border border-[#e0e3e5] bg-white p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-bold text-[#131b2e] flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-[#10b981]" /> Full AI &amp; plagiarism report
                  </p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${riskBadge(scanResult.overallRisk)}`}>
                    {scanResult.overallRisk} risk
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <ScoreDial label="AI content" score={scanResult.aiScore ?? 0} sub={scanResult.detectionModel} />
                  <ScoreDial label="Similarity" score={scanResult.plagiarismScore ?? 0} sub="vs. academic sources" />
                </div>

                {/* Plagiarism sources */}
                {scanResult.plagiarismSources && scanResult.plagiarismSources.length > 0 ? (
                  <div className="space-y-1 mb-3">
                    <p className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider">Matching sources</p>
                    {scanResult.plagiarismSources.slice(0, 5).map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 text-[10.5px] bg-[#f7f9fb] border border-[#e0e3e5] rounded-lg px-2.5 py-1.5 hover:border-[#10b981]/40 transition-colors"
                      >
                        <span className="truncate text-[#45464d]">
                          {s.title || s.url}
                          {s.matchedText && <span className="text-[#76777d]"> — "{s.matchedText.slice(0, 60)}"</span>}
                        </span>
                        <span className="shrink-0 flex items-center gap-1 font-bold text-[#76777d]">
                          {Math.round(s.similarity)}% <ExternalLink size={10} />
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-emerald-700 mb-3">
                    <Check size={11} strokeWidth={3} /> No significant matching sources found
                  </p>
                )}

                {/* Most AI-sounding sections */}
                {scanResult.aiSections && scanResult.aiSections.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-[#76777d] uppercase tracking-wider">Most AI-sounding sections</p>
                    {scanResult.aiSections.slice(0, 3).map((s, i) => (
                      <p key={i} className="text-[10.5px] text-[#45464d] bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 leading-snug">
                        "{s.text.length > 140 ? s.text.slice(0, 140) + "…" : s.text}" <span className="font-bold text-amber-700">{s.score}%</span>
                      </p>
                    ))}
                  </div>
                )}

                {scanResult.detectionModel && (
                  <p className="text-[9px] text-[#9aa0a6] mt-2.5">Detection: {scanResult.detectionModel}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
