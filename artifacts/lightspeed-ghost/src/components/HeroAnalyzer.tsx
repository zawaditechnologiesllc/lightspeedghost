import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Wand2, BookOpen, SpellCheck2, Gauge, ArrowRight, Sparkles, Lock, Check,
  Plus, ShieldCheck, PenLine, LayoutGrid, X,
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

// ── Command box (the open hero) ───────────────────────────────────────────────
// The landing IS the product: paste text into the command box and get an instant
// writing report. Every calculation runs in the browser (lib/textAnalysis.ts) —
// no login, no server call, and it NEVER touches an AI model, so it costs nothing
// to run no matter how many visitors use it. The numbers match the Free plan's
// local detection mode server-side. Laid out like a modern "one box, pick an
// action" app shell: a big input, then a row of tool actions beneath it.

type Tab = "ai" | "readability" | "grammar" | "tone";

const TABS: Array<{ id: Tab; label: string; icon: typeof Wand2 }> = [
  { id: "ai",          label: "AI Detector",  icon: Wand2 },
  { id: "readability", label: "Readability",  icon: Gauge },
  { id: "grammar",     label: "Grammar",      icon: SpellCheck2 },
  { id: "tone",        label: "Tone",         icon: BookOpen },
];

// Tool actions shown beneath the box. The first runs the free in-browser
// analyzer; the rest deep-link into the real tools (AuthGuard prompts sign-up).
const ACTIONS: Array<{ label: string; icon: typeof Wand2; href?: string; accent: string }> = [
  { label: "Check my writing", icon: Sparkles,    accent: "text-[#6b38d4]" },
  { label: "AI & Plagiarism",  icon: ShieldCheck, href: "/plagiarism", accent: "text-emerald-600" },
  { label: "Humanizer",        icon: Wand2,       href: "/humanizer",  accent: "text-purple-600" },
  { label: "Write Paper",      icon: PenLine,     href: "/write",      accent: "text-blue-600" },
];

const SAMPLE_AI = `Furthermore, it is important to note that social media plays a crucial role in shaping adolescent development in today's world. Moreover, numerous studies have shown that excessive screen time has a significant impact on mental health outcomes. Additionally, it is essential to recognize that these multifaceted factors underscore the importance of digital literacy. In conclusion, it is clear that society must navigate the complexities of this evolving landscape in order to safeguard future generations.`;

const SAMPLE_HUMAN = `I didn't expect the data to look like this. Three cohorts, same protocol — and yet the attention scores diverge wildly after week six. Why? My best guess is the evening usage window. Teens who scrolled past midnight showed reaction times almost 14% slower, which lines up with what Okafor and Lin found last year. But here's the part that bugs me: the effect nearly vanishes on weekends. Sleep debt, maybe. Or something else we haven't measured yet.`;

interface Report {
  ai: AiLikelihoodResult;
  readability: ReadabilityResult;
  grammar: GrammarIssue[];
  tone: ToneResult;
}

function scoreColor(score: number): { text: string; bar: string; ring: string } {
  if (score < 35) return { text: "text-emerald-600", bar: "bg-emerald-500", ring: "border-emerald-200 bg-emerald-50" };
  if (score < 65) return { text: "text-amber-600", bar: "bg-amber-500", ring: "border-amber-200 bg-amber-50" };
  return { text: "text-red-600", bar: "bg-red-500", ring: "border-red-200 bg-red-50" };
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

export function HeroAnalyzer() {
  const [text, setText] = useState("");
  const [tab, setTab] = useState<Tab>("ai");
  const [report, setReport] = useState<Report | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

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
    requestAnimationFrame(() => taRef.current?.focus());
  }

  const ai = report?.ai;
  const colors = ai ? scoreColor(ai.score) : null;

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* ── The command box ── */}
      <div className="rounded-[26px] border border-[#e0e3e5] bg-white shadow-[0_18px_50px_-20px_rgba(19,27,46,0.28)] focus-within:border-[#6b38d4]/50 focus-within:shadow-[0_18px_50px_-16px_rgba(107,56,212,0.35)] transition-all overflow-hidden">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => { setText(e.target.value); setReport(null); }}
          placeholder="Write, paste, or upload your text — check it free, no account needed…"
          rows={4}
          className="w-full resize-none bg-transparent px-5 pt-5 pb-2 text-[15px] text-[#191c1e] placeholder:text-[#9aa0a6] focus:outline-none leading-relaxed"
        />
        <div className="flex items-center gap-2 px-3.5 pb-3.5 pt-1">
          <button
            type="button"
            onClick={() => loadSample(SAMPLE_AI)}
            title="Load a sample to try it"
            className="w-9 h-9 rounded-full border border-[#e0e3e5] text-[#45464d] hover:border-[#6b38d4] hover:text-[#6b38d4] flex items-center justify-center transition-colors shrink-0"
          >
            <Plus size={17} />
          </button>
          {text && (
            <button
              type="button"
              onClick={() => { setText(""); setReport(null); taRef.current?.focus(); }}
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
            className="w-9 h-9 rounded-full bg-[#6b38d4] hover:bg-[#5b2fc0] text-white flex items-center justify-center transition-colors shadow-md shadow-[#6b38d4]/30 shrink-0"
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </div>

      {/* ── Action row ── */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        {ACTIONS.map(({ label, icon: Icon, href, accent }) => {
          const inner = (
            <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e0e3e5] bg-white text-sm font-semibold text-[#191c1e] hover:border-[#6b38d4]/50 hover:bg-[#faf9ff] cursor-pointer transition-all shadow-sm">
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
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e0e3e5] bg-white text-sm font-semibold text-[#45464d] hover:border-[#6b38d4]/50 hover:bg-[#faf9ff] transition-all shadow-sm"
        >
          <LayoutGrid size={15} className="text-[#76777d]" /> More
        </a>
      </div>

      {/* Sample + reassurance */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3.5 text-[11px] text-[#76777d]">
        <span className="inline-flex items-center gap-1.5"><Lock size={11} className="text-emerald-600" /> Runs in your browser · never sent to an AI model</span>
        <span className="hidden sm:inline text-[#c6c6cd]">·</span>
        <button type="button" onClick={() => loadSample(SAMPLE_AI)} className="font-semibold text-[#6b38d4] hover:underline">Try an AI-written sample</button>
        <button type="button" onClick={() => loadSample(SAMPLE_HUMAN)} className="font-semibold text-[#6b38d4] hover:underline">Try a human sample</button>
      </div>

      {/* ── Results ── */}
      {report && (
        <div className="mt-5 rounded-2xl border border-[#e0e3e5] bg-white shadow-lg overflow-hidden text-left">
          {/* Result tabs */}
          <div className="flex items-center gap-1 px-3 pt-3 border-b border-[#eceef0] overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[12px] font-semibold whitespace-nowrap transition-colors ${
                  tab === id ? "text-[#6b38d4] border-b-2 border-[#6b38d4] -mb-px" : "text-[#45464d] hover:text-[#191c1e]"
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
                        <span className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${iss.severity === "error" ? "bg-red-500" : iss.severity === "warning" ? "bg-amber-500" : "bg-sky-500"}`} />
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

            {/* Upgrade path */}
            <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-[#e9ddff] bg-[#f7f4ff] px-3.5 py-2.5">
              <p className="text-[10.5px] text-[#45464d] leading-snug flex-1">
                <span className="font-bold text-[#5516be]">Want the full deep scan?</span> Check against 10B+ academic sources, humanize, or write from real research.
              </p>
              <Link href="/auth">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#6b38d4] hover:text-[#5b2fc0] cursor-pointer whitespace-nowrap">
                  Create free account <ArrowRight size={11} />
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
