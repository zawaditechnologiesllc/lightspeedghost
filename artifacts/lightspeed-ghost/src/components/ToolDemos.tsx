import { Link } from "wouter";
import {
  PenLine, ListTree, FileEdit, Wand2, ShieldCheck, FlaskConical,
  GraduationCap, BookOpen, ArrowRight, Check, Search, Sparkles,
} from "lucide-react";

// ── Per-tool animated demos for the landing page ──────────────────────────────
// Each demo is a miniature mockup of the real tool that loops through three
// phases — input → processing → result — on a shared 11s pure-CSS timeline
// (no framer-motion: the landing keeps JS animation off the critical path).
// Phase visibility, typing, progress fill, and staggered reveals are all
// keyframe-driven; reduced-motion users see the static result state.

const LOOP = "11s";

const css = `
.td-stage{position:relative;overflow:hidden}
.td-in,.td-proc,.td-res{position:absolute;inset:0;padding:16px;pointer-events:none}
.td-in{opacity:1;animation:tdIn ${LOOP} linear infinite}
.td-proc{opacity:0;animation:tdProc ${LOOP} linear infinite}
.td-res{opacity:0;animation:tdRes ${LOOP} linear infinite}
@keyframes tdIn{0%,29%{opacity:1}33%,96%{opacity:0}100%{opacity:1}}
@keyframes tdProc{0%,30%{opacity:0}34%,57%{opacity:1}61%,100%{opacity:0}}
@keyframes tdRes{0%,58%{opacity:0}63%,96%{opacity:1}100%{opacity:0}}
.td-type{display:inline-block;max-width:100%;overflow:hidden;white-space:nowrap;vertical-align:bottom;width:0;animation:tdType ${LOOP} infinite}
@keyframes tdType{0%,4%{width:0;animation-timing-function:steps(30,end)}24%,100%{width:100%}}
.td-caret{display:inline-block;width:2px;height:1em;background:#6b38d4;vertical-align:text-bottom;margin-left:1px;animation:tdCaret 1s step-end infinite}
@keyframes tdCaret{50%{opacity:0}}
.td-press{animation:tdPress ${LOOP} infinite}
@keyframes tdPress{0%,25%{transform:scale(1)}27%{transform:scale(.95)}29%,100%{transform:scale(1)}}
.td-fill{width:3%;animation:tdFill ${LOOP} linear infinite}
@keyframes tdFill{0%,33%{width:3%}56%,100%{width:100%}}
.td-s1{opacity:.3;animation:tdS1 ${LOOP} infinite}.td-s2{opacity:.3;animation:tdS2 ${LOOP} infinite}.td-s3{opacity:.3;animation:tdS3 ${LOOP} infinite}
@keyframes tdS1{0%,35%{opacity:.3}38%,100%{opacity:1}}
@keyframes tdS2{0%,42%{opacity:.3}45%,100%{opacity:1}}
@keyframes tdS3{0%,49%{opacity:.3}52%,100%{opacity:1}}
.td-r1,.td-r2,.td-r3,.td-r4{opacity:0;transform:translateY(7px)}
.td-r1{animation:tdR1 ${LOOP} infinite}.td-r2{animation:tdR2 ${LOOP} infinite}.td-r3{animation:tdR3 ${LOOP} infinite}.td-r4{animation:tdR4 ${LOOP} infinite}
@keyframes tdR1{0%,60%{opacity:0;transform:translateY(7px)}64%,100%{opacity:1;transform:none}}
@keyframes tdR2{0%,63%{opacity:0;transform:translateY(7px)}67%,100%{opacity:1;transform:none}}
@keyframes tdR3{0%,66%{opacity:0;transform:translateY(7px)}70%,100%{opacity:1;transform:none}}
@keyframes tdR4{0%,69%{opacity:0;transform:translateY(7px)}73%,100%{opacity:1;transform:none}}
.td-shrink{width:87%;animation:tdShrink ${LOOP} infinite}
@keyframes tdShrink{0%,64%{width:87%;background:#dc2626}76%,100%{width:4%;background:#059669}}
.td-dots span{width:5px;height:5px;border-radius:9999px;background:#6b38d4;display:inline-block;margin-right:3px;animation:tdDot 1s ease-in-out infinite}
.td-dots span:nth-child(2){animation-delay:.15s}.td-dots span:nth-child(3){animation-delay:.3s}
@keyframes tdDot{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}
@media (prefers-reduced-motion:reduce){
  .td-stage *{animation:none!important}
  .td-in,.td-proc{display:none!important}
  .td-res{opacity:1!important}
  .td-r1,.td-r2,.td-r3,.td-r4{opacity:1!important;transform:none!important}
  .td-fill{width:100%!important}.td-type{width:100%!important}.td-shrink{width:4%!important;background:#059669!important}
  .td-s1,.td-s2,.td-s3{opacity:1!important}
}
`;

// ── Shared mockup primitives (landing light palette) ──────────────────────────

function Window({ url, height, children }: { url: string; height: number; children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl border border-[#e0e3e5] bg-white shadow-xl overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#e0e3e5] bg-[#f2f4f6]">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="ml-3 text-[11px] text-[#76777d] font-mono truncate">lightspeedghost.com/{url}</span>
      </div>
      <div className="td-stage" style={{ height }}>{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold text-[#76777d] uppercase tracking-wider mb-1.5">{children}</p>;
}

function TypeBox({ text, mono }: { text: string; mono?: boolean }) {
  return (
    <div className={`px-3 py-2.5 rounded-lg border border-[#c6c6cd] bg-[#f7f9fb] text-[12px] text-[#191c1e] ${mono ? "font-mono" : ""} overflow-hidden whitespace-nowrap`}>
      <span className="td-type">{text}</span><span className="td-caret" />
    </div>
  );
}

function FakeButton({ children }: { children: React.ReactNode }) {
  return (
    <div className="td-press mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6b38d4] text-white text-[11px] font-bold shadow-md shadow-[#6b38d4]/25">
      {children}
    </div>
  );
}

function ProcSteps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="h-full flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-3">
        <span className="td-dots"><span /><span /><span /></span>
        <span className="text-[12px] font-semibold text-[#131b2e]">{title}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#eceef0] overflow-hidden mb-4">
        <div className="td-fill h-full rounded-full bg-gradient-to-r from-[#6b38d4] to-[#0090a9]" />
      </div>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={s} className={`td-s${i + 1} flex items-center gap-2 text-[11px] text-[#45464d]`}>
            <span className="w-3.5 h-3.5 rounded-full bg-[#6b38d4]/10 text-[#6b38d4] flex items-center justify-center"><Check size={9} strokeWidth={3.5} /></span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function GhostLines({ n, r }: { n: number; r: 1 | 2 | 3 | 4 }) {
  const widths = ["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3"];
  return (
    <div className={`td-r${r} space-y-1.5`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={`h-1.5 rounded bg-[#d8dadc] ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

// ── The eight tool demos ───────────────────────────────────────────────────────

function WriteDemo() {
  return (
    <Window url="write" height={280}>
      <div className="td-in">
        <Label>Paper topic</Label>
        <TypeBox text="Impact of social media on mental health" />
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {["Psychology", "2,500 words", "APA 7", "Rubric.pdf ✓"].map((c) => (
            <span key={c} className="text-[10px] font-semibold text-[#45464d] bg-white border border-[#e0e3e5] rounded-full px-2 py-0.5">{c}</span>
          ))}
        </div>
        <FakeButton><PenLine size={11} /> Generate Paper</FakeButton>
      </div>
      <div className="td-proc">
        <ProcSteps title="Writing from real research…" steps={[
          "Searching 35+ databases — 18 sources found",
          "Verifying citations against Semantic Scholar",
          "Drafting sections · 1,240 words…",
        ]} />
      </div>
      <div className="td-res">
        <div className="td-r1 text-[13px] font-bold text-[#131b2e] mb-2">The Impact of Social Media on Adolescent Mental Health</div>
        <GhostLines n={3} r={2} />
        <div className="td-r3 flex flex-wrap gap-1.5 mt-3">
          {["Twenge et al., 2023", "Orben & Przybylski, 2022", "+10 more"].map((c) => (
            <span key={c} className="text-[9px] font-semibold text-[#5516be] bg-[#e9ddff] rounded-full px-2 py-0.5">{c}</span>
          ))}
        </div>
        <div className="td-r4 mt-3 flex items-center gap-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 w-fit">
          <Check size={11} strokeWidth={3} /> 12 verified citations · 2,506 words · Grade target: A
        </div>
      </div>
    </Window>
  );
}

function OutlineDemo() {
  const rows: Array<[string, string, 1 | 2 | 3 | 4]> = [
    ["I.", "Introduction — problem & thesis", 1],
    ["II.", "Literature review — CNN diagnostic accuracy", 2],
    ["III.", "Methodology — datasets & model selection", 3],
    ["IV.", "Findings, limitations & conclusion", 4],
  ];
  return (
    <Window url="outline" height={280}>
      <div className="td-in">
        <Label>Outline topic</Label>
        <TypeBox text="Neural Networks in Medical Diagnosis" />
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {["Research paper", "5 sections", "Thesis included"].map((c) => (
            <span key={c} className="text-[10px] font-semibold text-[#45464d] bg-white border border-[#e0e3e5] rounded-full px-2 py-0.5">{c}</span>
          ))}
        </div>
        <FakeButton><ListTree size={11} /> Build Outline</FakeButton>
      </div>
      <div className="td-proc">
        <ProcSteps title="Structuring your argument…" steps={[
          "Mapping key themes from the literature",
          "Ordering sections for logical flow",
          "Writing section notes & thesis statement",
        ]} />
      </div>
      <div className="td-res">
        <div className="space-y-2">
          {rows.map(([n, t, r]) => (
            <div key={n} className={`td-r${r} flex items-start gap-2 bg-[#f7f9fb] border border-[#e0e3e5] rounded-lg px-3 py-2`}>
              <span className="text-[11px] font-bold text-[#6b38d4] w-6 shrink-0">{n}</span>
              <span className="text-[11px] text-[#191c1e] font-medium">{t}</span>
            </div>
          ))}
        </div>
        <div className="td-r4 mt-2.5 text-[10px] text-[#76777d]">Ready to expand into a full draft →</div>
      </div>
    </Window>
  );
}

function RevisionDemo() {
  return (
    <Window url="revision" height={280}>
      <div className="td-in">
        <Label>Your draft</Label>
        <div className="rounded-lg border border-[#c6c6cd] bg-[#f7f9fb] px-3 py-2.5 space-y-1.5">
          <div className="h-1.5 rounded bg-[#d8dadc] w-full" />
          <div className="h-1.5 rounded bg-[#d8dadc] w-10/12" />
          <div className="h-1.5 rounded bg-[#d8dadc] w-3/4" />
        </div>
        <div className="flex gap-2 mt-2.5">
          <span className="text-[10px] font-semibold text-[#45464d] bg-white border border-[#e0e3e5] rounded-full px-2 py-0.5">Current grade: 62/100</span>
          <span className="text-[10px] font-semibold text-[#45464d] bg-white border border-[#e0e3e5] rounded-full px-2 py-0.5">Target: A</span>
        </div>
        <FakeButton><FileEdit size={11} /> Scan Paper</FakeButton>
      </div>
      <div className="td-proc">
        <ProcSteps title="Revising against your rubric…" steps={[
          "Scoring draft against A-grade criteria",
          "Rewriting weak arguments & transitions",
          "Fixing citations · strengthening evidence",
        ]} />
      </div>
      <div className="td-res">
        <div className="td-r1 flex items-center gap-3 mb-3">
          <span className="text-2xl font-bold text-[#dc2626] line-through decoration-2">C−</span>
          <ArrowRight size={14} className="text-[#76777d]" />
          <span className="text-3xl font-bold text-emerald-600">A−</span>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Estimated grade</span>
        </div>
        {["Thesis sharpened & restated in conclusion", "Evidence integrated in body ¶2–4", "4 citations corrected to APA 7"].map((t, i) => (
          <div key={t} className={`td-r${(i + 2) as 2 | 3 | 4} flex items-center gap-2 text-[11px] text-[#45464d] mb-1.5`}>
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Check size={9} strokeWidth={3.5} /></span>
            {t}
          </div>
        ))}
      </div>
    </Window>
  );
}

function HumanizerDemo() {
  return (
    <Window url="humanizer" height={280}>
      <div className="td-in">
        <Label>Paste AI-generated text</Label>
        <div className="rounded-lg border border-[#c6c6cd] bg-[#f7f9fb] px-3 py-2.5 space-y-1.5">
          <div className="h-1.5 rounded bg-[#d8dadc] w-full" />
          <div className="h-1.5 rounded bg-[#d8dadc] w-11/12" />
          <div className="h-1.5 rounded bg-[#d8dadc] w-4/5" />
        </div>
        <div className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] font-bold text-[#dc2626] bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
          AI detection score: 87%
        </div>
        <div><FakeButton><Wand2 size={11} /> Humanize</FakeButton></div>
      </div>
      <div className="td-proc">
        <ProcSteps title="Making it sound like you…" steps={[
          "Varying sentence rhythm & length",
          "Swapping robotic phrasing for natural voice",
          "Preserving citations & meaning",
        ]} />
      </div>
      <div className="td-res">
        <Label>AI detection score</Label>
        <div className="td-r1 h-2.5 rounded-full bg-[#eceef0] overflow-hidden mb-1">
          <div className="td-shrink h-full rounded-full" />
        </div>
        <div className="td-r1 flex justify-between text-[10px] font-bold mb-3"><span className="text-[#76777d]">87% before</span><span className="text-emerald-600">4% after</span></div>
        <GhostLines n={3} r={2} />
        <div className="td-r3 mt-3 flex items-center gap-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 w-fit">
          <Check size={11} strokeWidth={3} /> Reads human · citations preserved · meaning intact
        </div>
      </div>
    </Window>
  );
}

function PlagiarismDemo() {
  return (
    <Window url="plagiarism" height={280}>
      <div className="td-in">
        <Label>Check your work</Label>
        <div className="rounded-lg border border-[#c6c6cd] bg-[#f7f9fb] px-3 py-2.5 space-y-1.5">
          <div className="h-1.5 rounded bg-[#d8dadc] w-full" />
          <div className="h-1.5 rounded bg-[#d8dadc] w-10/12" />
          <div className="h-1.5 rounded bg-[#d8dadc] w-full" />
          <div className="h-1.5 rounded bg-[#d8dadc] w-2/3" />
        </div>
        <FakeButton><Search size={11} /> Scan for AI & Plagiarism</FakeButton>
      </div>
      <div className="td-proc">
        <ProcSteps title="Scanning your paper…" steps={[
          "Comparing against 10B+ indexed pages",
          "Running AI-content detection",
          "Building sentence-level match report",
        ]} />
      </div>
      <div className="td-res">
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="td-r1 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">3%</div>
            <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide">Similarity</div>
          </div>
          <div className="td-r2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">12%</div>
            <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide">AI probability</div>
          </div>
        </div>
        <div className="td-r3 flex items-center justify-between text-[10px] text-[#45464d] bg-[#f7f9fb] border border-[#e0e3e5] rounded-lg px-2.5 py-1.5 mb-1.5">
          <span className="truncate">en.wikipedia.org — common phrase</span><span className="font-bold text-[#76777d] shrink-0 ml-2">1.2%</span>
        </div>
        <div className="td-r4 flex items-center gap-2 text-[10px] font-semibold text-emerald-700"><Check size={11} strokeWidth={3} /> Safe to submit — full report ready</div>
      </div>
    </Window>
  );
}

function StemDemo() {
  return (
    <Window url="stem" height={280}>
      <div className="td-in">
        <Label>Your problem — type it or snap a photo</Label>
        <TypeBox mono text="Find the definite integral of x·sin(x) from 0 to π" />
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {["Calculus", "Step-by-step", "Graph included"].map((c) => (
            <span key={c} className="text-[10px] font-semibold text-[#45464d] bg-white border border-[#e0e3e5] rounded-full px-2 py-0.5">{c}</span>
          ))}
        </div>
        <FakeButton><FlaskConical size={11} /> Solve</FakeButton>
      </div>
      <div className="td-proc">
        <ProcSteps title="Solving step by step…" steps={[
          "Choosing method: integration by parts",
          "Deriving each step with checks",
          "Rendering LaTeX & plotting the curve",
        ]} />
      </div>
      <div className="td-res">
        <div className="td-r1 text-[11px] font-mono text-[#191c1e] bg-[#f7f9fb] border border-[#e0e3e5] rounded-lg px-3 py-2 mb-1.5">
          <span className="text-[#6b38d4] font-bold">Step 1</span> · u = x, dv = sin(x)dx → du = dx, v = −cos(x)
        </div>
        <div className="td-r2 text-[11px] font-mono text-[#191c1e] bg-[#f7f9fb] border border-[#e0e3e5] rounded-lg px-3 py-2 mb-1.5">
          <span className="text-[#6b38d4] font-bold">Step 2</span> · [−x·cos(x)]₀^π + ∫₀^π cos(x)dx
        </div>
        <div className="td-r3 flex items-center gap-2 text-[12px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-2">
          <Check size={12} strokeWidth={3} /> Answer: π ≈ 3.14159
        </div>
        <svg className="td-r4" width="100%" height="34" viewBox="0 0 260 34" fill="none" aria-hidden>
          <path d="M2 32 C 40 32, 60 2, 130 2 S 220 32, 258 32" stroke="#6b38d4" strokeWidth="2" />
          <line x1="2" y1="32" x2="258" y2="32" stroke="#d8dadc" strokeWidth="1" />
        </svg>
      </div>
    </Window>
  );
}

function StudyDemo() {
  return (
    <Window url="study" height={280}>
      <div className="td-in">
        <Label>Ask your tutor anything</Label>
        <TypeBox text="Explain photosynthesis like I'm cramming for finals" />
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {["Biology 201", "Remembers your progress", "Quiz mode"].map((c) => (
            <span key={c} className="text-[10px] font-semibold text-[#45464d] bg-white border border-[#e0e3e5] rounded-full px-2 py-0.5">{c}</span>
          ))}
        </div>
        <FakeButton><GraduationCap size={11} /> Ask Tutor</FakeButton>
      </div>
      <div className="td-proc">
        <ProcSteps title="Your tutor is thinking…" steps={[
          "Recalling your Bio 201 progress",
          "Building an exam-speed explanation",
          "Preparing a quick self-test",
        ]} />
      </div>
      <div className="td-res">
        <div className="td-r1 ml-auto max-w-[85%] bg-[#6b38d4] text-white text-[11px] rounded-xl rounded-br-sm px-3 py-2 mb-2 w-fit">
          Explain photosynthesis like I'm cramming for finals
        </div>
        <div className="td-r2 max-w-[90%] bg-[#f7f9fb] border border-[#e0e3e5] text-[11px] text-[#191c1e] rounded-xl rounded-bl-sm px-3 py-2 mb-2">
          Light reactions capture energy (ATP + NADPH) → the Calvin cycle uses it to fix CO₂ into glucose. Exam shortcut: <b>light = energy capture, Calvin = sugar building.</b>
        </div>
        <div className="td-r3 flex flex-wrap gap-1.5">
          <span className="text-[9px] font-bold text-[#5516be] bg-[#e9ddff] rounded-full px-2 py-1">Remembered: Bio 201 · exam Friday</span>
          <span className="text-[9px] font-bold text-[#45464d] bg-white border border-[#e0e3e5] rounded-full px-2 py-1">Quiz me on this →</span>
        </div>
      </div>
    </Window>
  );
}

function EbookDemo() {
  return (
    <Window url="ebooks" height={280}>
      <div className="td-in">
        <Label>Ebook title</Label>
        <TypeBox text="How to Scale a Dropshipping Business from $0 to $1M" />
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {["Audience: first-time entrepreneurs", "12 chapters"].map((c) => (
            <span key={c} className="text-[10px] font-semibold text-[#45464d] bg-white border border-[#e0e3e5] rounded-full px-2 py-0.5">{c}</span>
          ))}
        </div>
        <FakeButton><BookOpen size={11} /> Generate Ebook</FakeButton>
      </div>
      <div className="td-proc">
        <ProcSteps title="Writing your ebook…" steps={[
          "Structuring 12 chapters for your audience",
          "Writing chapter 4 of 12 — case studies",
          "Formatting title page & table of contents",
        ]} />
      </div>
      <div className="td-res">
        <div className="flex gap-3">
          <div className="td-r1 w-20 h-28 rounded-lg bg-gradient-to-br from-[#6b38d4] to-[#0090a9] shrink-0 p-2 flex flex-col justify-between shadow-md">
            <Sparkles size={10} className="text-white/80" />
            <span className="text-[7px] font-bold text-white leading-tight">HOW TO SCALE A DROPSHIPPING BUSINESS</span>
          </div>
          <div className="flex-1 min-w-0">
            {["1 · The $0 → $1M roadmap", "2 · Picking products that print", "3 · Store setup in a weekend"].map((c, i) => (
              <div key={c} className={`td-r${(i + 1) as 1 | 2 | 3} text-[10px] text-[#45464d] bg-[#f7f9fb] border border-[#e0e3e5] rounded-lg px-2.5 py-1.5 mb-1.5 truncate`}>{c}</div>
            ))}
            <div className="td-r4 flex items-center gap-2 text-[10px] font-semibold text-emerald-700"><Check size={11} strokeWidth={3} /> 12 chapters · 24,300 words · DOCX ready</div>
          </div>
        </div>
      </div>
    </Window>
  );
}

// ── Section config + layout ────────────────────────────────────────────────────

const SHOWCASES = [
  {
    icon: PenLine, name: "AI Paper Writer", demo: <WriteDemo />, cta: "Write your first paper",
    tag: "Topic in. Real-research paper out.",
    desc: "Type your topic, attach a rubric, and watch it search 35+ live databases, verify every citation, and draft section by section — targeting your A-grade criteria.",
    points: ["Real, clickable DOI citations", "Grade-target cross-checking", "High school to PhD, 35+ paper types"],
  },
  {
    icon: ListTree, name: "Outline Builder", demo: <OutlineDemo />, cta: "Build an outline",
    tag: "Structure first. Write with confidence.",
    desc: "Give it a topic and get a logically-ordered outline with a thesis, section notes, and the argument mapped before you write a word.",
    points: ["Thesis statement included", "Section-by-section notes", "Expands into a full draft"],
  },
  {
    icon: FileEdit, name: "Paper Revision", demo: <RevisionDemo />, cta: "Revise my paper",
    tag: "From a C− draft to an A− estimate.",
    desc: "Paste your draft, set your current and target grade, and it rewrites weak arguments, fixes citations, and scores the result against your rubric.",
    points: ["Before/after grade estimate", "Targeted improvement areas", "Rubric-aware rewriting"],
  },
  {
    icon: Wand2, name: "Humanizer", demo: <HumanizerDemo />, cta: "Humanize my text",
    tag: "87% AI score in. 4% out.",
    desc: "Paste AI-sounding text and get natural, human rhythm back — without touching your citations or changing what you meant.",
    points: ["AI-detection score before/after", "Citations preserved", "Meaning stays intact"],
  },
  {
    icon: ShieldCheck, name: "AI & Plagiarism Checker", demo: <PlagiarismDemo />, cta: "Check my paper",
    tag: "Know before your professor does.",
    desc: "Scan against 10B+ indexed pages and an AI-content detector, then get a sentence-level match report you can act on before submitting.",
    points: ["Similarity + AI probability", "Source-by-source matches", "Downloadable report"],
  },
  {
    icon: FlaskConical, name: "STEM Solver", demo: <StemDemo />, cta: "Solve a problem",
    tag: "Every step shown. Nothing skipped.",
    desc: "Type any problem — or photograph it — and get the full worked solution with LaTeX math, method choices explained, and graphs where they help.",
    points: ["Step-by-step derivations", "Math, physics, chem, finance & more", "Photo input supported"],
  },
  {
    icon: GraduationCap, name: "Study Assistant", demo: <StudyDemo />, cta: "Start studying",
    tag: "A tutor that remembers you.",
    desc: "Ask anything and get exam-speed explanations that build on what you've already covered — then flip to quiz mode to test yourself.",
    points: ["Remembers your courses & progress", "Explains at your level", "Built-in quiz mode"],
  },
  {
    icon: BookOpen, name: "Ebook Generator", demo: <EbookDemo />, cta: "Generate an ebook",
    tag: "A full ebook from one title.",
    desc: "Give it a title and an audience, and it writes the whole book — structured chapters, case studies, table of contents — ready to export.",
    points: ["Complete chaptered manuscript", "Audience-tailored tone", "Export-ready DOCX"],
  },
];

export function ToolDemosSection() {
  return (
    <section id="tool-demos" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 bg-white border-y border-[#e0e3e5] overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3 sm:mb-4">Watch them work</p>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight mb-4 text-[#131b2e]">
            Every tool, exactly as it runs.
          </h2>
          <p className="text-[#45464d] text-base sm:text-lg">
            These aren't concept art — each demo mirrors the real tool: what you put in, what it does, and what you get back.
          </p>
        </div>

        <div className="space-y-14 sm:space-y-20">
          {SHOWCASES.map(({ icon: Icon, name, tag, desc, points, cta, demo }, i) => (
            <div key={name} className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <div className="inline-flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-[#6b38d4]/10 text-[#6b38d4] flex items-center justify-center"><Icon size={17} /></div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#6b38d4]">{name}</span>
                </div>
                <h3 className="text-2xl sm:text-[28px] font-bold text-[#131b2e] leading-tight mb-3">{tag}</h3>
                <p className="text-[#45464d] text-sm sm:text-base leading-relaxed mb-5">{desc}</p>
                <ul className="space-y-2 mb-6">
                  {points.map((p) => (
                    <li key={p} className="flex items-center gap-2.5 text-sm text-[#191c1e]">
                      <span className="w-[18px] h-[18px] rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><Check size={10} strokeWidth={3.5} /></span>
                      {p}
                    </li>
                  ))}
                </ul>
                <Link href="/auth">
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-lg transition-all cursor-pointer shadow-md shadow-[#6b38d4]/25 hover:-translate-y-0.5 text-sm">
                    {cta} <ArrowRight size={14} />
                  </span>
                </Link>
              </div>
              <div className={i % 2 === 1 ? "lg:order-1" : ""}>{demo}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
