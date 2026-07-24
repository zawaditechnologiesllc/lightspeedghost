import { Link } from "wouter";
import {
  PenLine, ListTree, FileEdit, Wand2, ShieldCheck, FlaskConical,
  GraduationCap, BookOpen, ArrowRight, Check, Search, Sparkles, CheckCircle,
  Camera, Upload, Calculator, Atom, Cpu, Zap,
} from "lucide-react";

// ── "Watch them work" — the single per-tool section of the landing page ───────
// Each tool gets ONE row that carries everything about it: the marketing copy
// from the old tools grid, its purpose-built AI capabilities, the deep-dive
// bullets, and (for ebooks) the whole publisher pitch — plus a looping demo
// modeled on the real tool: the exact inputs it takes, the processing it
// actually runs, and the shape of its real output.
//
// Animations are a pure-CSS 11s timeline (typing, source rows, live word
// counter, staggered reveals) — no framer-motion, SSR-prerender safe, and
// reduced-motion users see the static result state.

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
.td-caret{display:inline-block;width:2px;height:1em;background:#10b981;vertical-align:text-bottom;margin-left:1px;animation:tdCaret 1s step-end infinite}
@keyframes tdCaret{50%{opacity:0}}
.td-press{animation:tdPress ${LOOP} infinite}
@keyframes tdPress{0%,25%{transform:scale(1)}27%{transform:scale(.95)}29%,100%{transform:scale(1)}}
.td-fill{width:3%;animation:tdFill ${LOOP} linear infinite}
@keyframes tdFill{0%,33%{width:3%}56%,100%{width:100%}}
.td-s1{opacity:.25;animation:tdS1 ${LOOP} infinite}.td-s2{opacity:.25;animation:tdS2 ${LOOP} infinite}.td-s3{opacity:.25;animation:tdS3 ${LOOP} infinite}.td-s4{opacity:.25;animation:tdS4 ${LOOP} infinite}
@keyframes tdS1{0%,35%{opacity:.25}37.5%,100%{opacity:1}}
@keyframes tdS2{0%,40%{opacity:.25}42.5%,100%{opacity:1}}
@keyframes tdS3{0%,45%{opacity:.25}47.5%,100%{opacity:1}}
@keyframes tdS4{0%,50%{opacity:.25}52.5%,100%{opacity:1}}
.td-r1,.td-r2,.td-r3,.td-r4{opacity:0;transform:translateY(7px)}
.td-r1{animation:tdR1 ${LOOP} infinite}.td-r2{animation:tdR2 ${LOOP} infinite}.td-r3{animation:tdR3 ${LOOP} infinite}.td-r4{animation:tdR4 ${LOOP} infinite}
@keyframes tdR1{0%,60%{opacity:0;transform:translateY(7px)}64%,100%{opacity:1;transform:none}}
@keyframes tdR2{0%,63%{opacity:0;transform:translateY(7px)}67%,100%{opacity:1;transform:none}}
@keyframes tdR3{0%,66%{opacity:0;transform:translateY(7px)}70%,100%{opacity:1;transform:none}}
@keyframes tdR4{0%,69%{opacity:0;transform:translateY(7px)}73%,100%{opacity:1;transform:none}}
.td-shrink{width:87%;animation:tdShrink ${LOOP} infinite}
@keyframes tdShrink{0%,64%{width:87%;background:#dc2626}76%,100%{width:4%;background:#059669}}
.td-dots span{width:5px;height:5px;border-radius:9999px;background:#10b981;display:inline-block;margin-right:3px;animation:tdDot 1s ease-in-out infinite}
.td-dots span:nth-child(2){animation-delay:.15s}.td-dots span:nth-child(3){animation-delay:.3s}
@keyframes tdDot{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}
.td-count{position:relative;display:inline-block;min-width:4.5ch;text-align:right}
.td-count span{position:absolute;right:0;top:0;opacity:0}
.td-count span:nth-child(1){animation:tdC1 ${LOOP} infinite}
.td-count span:nth-child(2){animation:tdC2 ${LOOP} infinite}
.td-count span:nth-child(3){position:static;animation:tdC3 ${LOOP} infinite}
@keyframes tdC1{0%,34%{opacity:0}35%,42%{opacity:1}43%,100%{opacity:0}}
@keyframes tdC2{0%,43%{opacity:0}44%,50%{opacity:1}51%,100%{opacity:0}}
@keyframes tdC3{0%,51%{opacity:0}52%,100%{opacity:1}}
@media (prefers-reduced-motion:reduce){
  .td-stage *{animation:none!important}
  .td-in,.td-proc{display:none!important}
  .td-res{opacity:1!important}
  .td-r1,.td-r2,.td-r3,.td-r4{opacity:1!important;transform:none!important}
  .td-fill{width:100%!important}.td-type{width:100%!important}.td-shrink{width:4%!important;background:#059669!important}
  .td-s1,.td-s2,.td-s3,.td-s4{opacity:1!important}
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

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2.5">
      {items.map((c) => (
        <span key={c} className="text-[10px] font-semibold text-[#45464d] bg-white border border-[#e0e3e5] rounded-full px-2 py-0.5">{c}</span>
      ))}
    </div>
  );
}

// A row of labeled mini-selects, exactly like the real tools' option rows.
function SelectRow({ fields }: { fields: Array<[string, string]> }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2.5">
      {fields.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <p className="text-[8.5px] font-semibold text-[#76777d] uppercase tracking-wide mb-0.5">{label}</p>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-[#c6c6cd] bg-white text-[10px] font-medium text-[#191c1e]">
            {value} <span className="text-[#76777d] text-[8px]">▾</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function UploadRow({ label, file }: { label: string; file: string }) {
  return (
    <div className="mt-2.5">
      <p className="text-[8.5px] font-semibold text-[#76777d] uppercase tracking-wide mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-dashed border-[#c6c6cd] bg-white text-[10px] text-[#45464d] w-fit">
        <Upload size={10} className="text-[#10b981]" /> {file} <Check size={10} className="text-emerald-600" strokeWidth={3} />
      </div>
    </div>
  );
}

function FakeButton({ children }: { children: React.ReactNode }) {
  return (
    <div className="td-press mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#10b981] text-white text-[11px] font-bold shadow-md shadow-[#10b981]/25">
      {children}
    </div>
  );
}

// Processing layer: headline + progress bar + realistic telemetry rows that
// tick on one by one (source names, counts, checks) — like the real tools'
// activity feeds.
function Proc({ title, rows, counter }: {
  title: string;
  rows: Array<{ label: string; meta?: string }>;
  counter?: { label: string; values: [string, string, string] };
}) {
  return (
    <div className="h-full flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-3">
        <span className="td-dots"><span /><span /><span /></span>
        <span className="text-[12px] font-semibold text-[#131b2e]">{title}</span>
        {counter && (
          <span className="ml-auto text-[10px] font-mono font-bold text-[#10b981]">
            <span className="td-count"><span>{counter.values[0]}</span><span>{counter.values[1]}</span><span>{counter.values[2]}</span></span> {counter.label}
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-[#eceef0] overflow-hidden mb-4">
        <div className="td-fill h-full rounded-full bg-gradient-to-r from-[#10b981] to-[#0d9488]" />
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={r.label} className={`td-s${i + 1} flex items-center gap-2 text-[11px] text-[#45464d] bg-[#f7f9fb] border border-[#eceef0] rounded-lg px-2.5 py-1.5`}>
            <span className="w-3.5 h-3.5 rounded-full bg-[#10b981]/10 text-[#10b981] flex items-center justify-center shrink-0"><Check size={9} strokeWidth={3.5} /></span>
            <span className="truncate">{r.label}</span>
            {r.meta && <span className="ml-auto shrink-0 text-[9px] font-bold text-[#10b981]">{r.meta}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── The eight tool demos — modeled on the real tools ──────────────────────────

function WriteDemo() {
  return (
    <Window url="write" height={336}>
      <div className="td-in">
        <Label>Topic *</Label>
        <TypeBox text="Impact of social media on adolescent mental health" />
        <SelectRow fields={[["Paper Type", "Research Paper"], ["Word Count", "2,500"], ["Citation Style", "APA 7th"], ["Subject", "Psychology"]]} />
        <UploadRow label="Marking Rubric (optional)" file="PSY204_rubric.pdf" />
        <FakeButton><PenLine size={11} /> Generate Paper</FakeButton>
      </div>
      <div className="td-proc">
        <Proc
          title="Writing from real research…"
          counter={{ label: "words", values: ["412", "1,238", "2,180"] }}
          rows={[
            { label: "OpenAlex · 250M+ papers", meta: "8 sources" },
            { label: "PubMed · CrossRef · Semantic Scholar", meta: "10 sources" },
            { label: "A-grade criteria extracted from your rubric", meta: "✓" },
            { label: "Drafting: Introduction → Method → Discussion", meta: "§3/5" },
          ]}
        />
      </div>
      <div className="td-res">
        <div className="td-r1 text-[12px] font-bold text-[#131b2e] leading-snug mb-1.5">The Impact of Social Media Use on Adolescent Mental Health: A Systematic Perspective</div>
        <p className="td-r2 text-[10px] text-[#45464d] leading-relaxed mb-2">
          Adolescents reporting more than three hours of daily social-media use show elevated rates of anxiety and depressive symptoms <span className="text-[#10b981] font-semibold">(Twenge et al., 2023)</span>, an effect that persists after controlling for baseline mood <span className="text-[#10b981] font-semibold">(Orben &amp; Przybylski, 2022)</span>.
        </p>
        <p className="td-r3 text-[9px] text-[#76777d] leading-relaxed mb-2 border-t border-[#eceef0] pt-2">
          Twenge, J. M., et al. (2023). Worldwide increases in adolescent loneliness. <span className="italic">J. Adolescence, 93</span>, 257–269. <span className="text-[#10b981]">doi:10.1016/j.adolescence.2023.06.006 ↗</span>
        </p>
        <div className="td-r4 flex items-center gap-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 w-fit">
          <Check size={11} strokeWidth={3} /> 2,506 words · 12 verified citations · similarity 4.2% · rubric check passed
        </div>
      </div>
    </Window>
  );
}

function OutlineDemo() {
  const rows: Array<[string, string, 1 | 2 | 3 | 4]> = [
    ["I.", "Introduction — thesis: CNNs match radiologist accuracy in narrow tasks", 1],
    ["II.", "Literature review — diagnostic imaging benchmarks 2019–2024", 2],
    ["III.", "Methodology — datasets, architectures, validation strategy", 3],
    ["IV.", "Findings · limitations · ethical considerations · conclusion", 4],
  ];
  return (
    <Window url="outline" height={336}>
      <div className="td-in">
        <Label>Topic *</Label>
        <TypeBox text="Neural Networks in Medical Diagnosis" />
        <SelectRow fields={[["Paper Type", "Research Paper"], ["Sections", "5"], ["Citation Style", "APA 7th"]]} />
        <UploadRow label="Assignment brief (optional)" file="Assignment_brief.pdf" />
        <FakeButton><ListTree size={11} /> Generate Outline</FakeButton>
      </div>
      <div className="td-proc">
        <Proc
          title="Structuring your argument…"
          rows={[
            { label: "Reading your assignment brief", meta: "✓" },
            { label: "Extracting requirements: length, sections, style", meta: "4 found" },
            { label: "Mapping themes from the literature", meta: "6 themes" },
            { label: "Ordering sections for logical flow", meta: "✓" },
          ]}
        />
      </div>
      <div className="td-res">
        <div className="space-y-1.5">
          {rows.map(([n, t, r]) => (
            <div key={n} className={`td-r${r} flex items-start gap-2 bg-[#f7f9fb] border border-[#e0e3e5] rounded-lg px-3 py-2`}>
              <span className="text-[11px] font-bold text-[#10b981] w-5 shrink-0">{n}</span>
              <span className="text-[10.5px] text-[#191c1e] font-medium leading-snug">{t}</span>
            </div>
          ))}
        </div>
        <div className="td-r4 mt-2 text-[10px] text-[#76777d]">Each section includes notes + suggested sources · expand into a full draft →</div>
      </div>
    </Window>
  );
}

function RevisionDemo() {
  return (
    <Window url="revision" height={336}>
      <div className="td-in">
        <Label>Paste your paper text here…</Label>
        <div className="rounded-lg border border-[#c6c6cd] bg-[#f7f9fb] px-3 py-2 text-[9.5px] text-[#76777d] leading-relaxed">
          Social media is very bad for teenagers mental health. Many studies show that it causes problems. This paper will discuss the problems it causes and why it is bad…
        </div>
        <SelectRow fields={[["Current Grade", "62/100"], ["Target Grade", "A"]]} />
        <UploadRow label="Marking rubric (recommended)" file="Rubric.pdf" />
        <FakeButton><FileEdit size={11} /> Scan Paper</FakeButton>
      </div>
      <div className="td-proc">
        <Proc
          title="Revising against your rubric…"
          rows={[
            { label: "Scoring draft against A-grade criteria", meta: "62/100" },
            { label: "Weak thesis + unsupported claims flagged", meta: "7 issues" },
            { label: "Rewriting arguments · adding evidence", meta: "§2/4" },
            { label: "Explaining every change made", meta: "✓" },
          ]}
        />
      </div>
      <div className="td-res">
        <div className="td-r1 flex items-center gap-3 mb-2">
          <span className="text-xl font-bold text-[#dc2626] line-through decoration-2">C−</span>
          <ArrowRight size={13} className="text-[#76777d]" />
          <span className="text-2xl font-bold text-emerald-600">A−</span>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Estimated grade</span>
        </div>
        <div className="td-r2 text-[9.5px] leading-relaxed rounded-lg border border-[#e0e3e5] bg-[#f7f9fb] px-3 py-2 mb-2">
          <span className="text-[#dc2626] line-through">Social media is very bad for teenagers…</span>{" "}
          <span className="text-[#191c1e]">→ Longitudinal cohort data links heavy use to elevated anxiety and depressive symptoms <span className="text-[#10b981] font-semibold">(Twenge et al., 2023)</span>.</span>
        </div>
        {["Thesis sharpened & restated in conclusion", "4 citations corrected to APA 7 — every change explained"].map((t, i) => (
          <div key={t} className={`td-r${(i + 3) as 3 | 4} flex items-center gap-2 text-[10.5px] text-[#45464d] mb-1`}>
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><Check size={9} strokeWidth={3.5} /></span>
            {t}
          </div>
        ))}
      </div>
    </Window>
  );
}

function HumanizerDemo() {
  return (
    <Window url="humanizer" height={336}>
      <div className="td-in">
        <Label>Paste your AI-generated essay, paper, or any text you want to humanize…</Label>
        <div className="rounded-lg border border-[#c6c6cd] bg-[#f7f9fb] px-3 py-2 text-[9.5px] text-[#76777d] leading-relaxed">
          Furthermore, it is imperative to acknowledge that numerous multifaceted factors contribute significantly to the aforementioned phenomenon. Moreover, it is essential to note that…
        </div>
        <div className="mt-2">
          <p className="text-[8.5px] font-semibold text-[#76777d] uppercase tracking-wide mb-0.5">Instructions (optional)</p>
          <div className="rounded-md border border-[#c6c6cd] bg-white px-2.5 py-1.5 text-[9.5px] text-[#76777d] italic">Keep the introduction formal. Preserve all citations.</div>
        </div>
        <div><FakeButton><Wand2 size={11} /> Detect AI &amp; Humanize</FakeButton></div>
      </div>
      <div className="td-proc">
        <Proc
          title="Rewriting in your voice…"
          rows={[
            { label: "Varying sentence rhythm & length", meta: "✓" },
            { label: "Swapping robotic connectors (furthermore, moreover…)", meta: "9 fixed" },
            { label: "Preserving citations & technical terms", meta: "6 kept" },
            { label: "Re-running AI detection", meta: "4%" },
          ]}
        />
      </div>
      <div className="td-res">
        <Label>AI detection score</Label>
        <div className="td-r1 h-2.5 rounded-full bg-[#eceef0] overflow-hidden mb-1">
          <div className="td-shrink h-full rounded-full" />
        </div>
        <div className="td-r1 flex justify-between text-[10px] font-bold mb-2"><span className="text-[#76777d]">87% before</span><span className="text-emerald-600">4% after</span></div>
        <div className="td-r2 text-[9.5px] text-[#191c1e] leading-relaxed rounded-lg border border-[#e0e3e5] bg-[#f7f9fb] px-3 py-2 mb-2">
          A lot of forces pull at this at once — some obvious, some not. What matters is which ones actually move the needle, and the evidence points to three <span className="text-[#10b981] font-semibold">(Chen &amp; Park, 2023)</span>.
        </div>
        <div className="td-r3 flex items-center gap-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 w-fit">
          <Check size={11} strokeWidth={3} /> Reads human · citations preserved · meaning intact
        </div>
      </div>
    </Window>
  );
}

function PlagiarismDemo() {
  return (
    <Window url="plagiarism" height={336}>
      <div className="td-in">
        <Label>Paste your text here to check for AI content and plagiarism…</Label>
        <div className="rounded-lg border border-[#c6c6cd] bg-[#f7f9fb] px-3 py-2 text-[9.5px] text-[#76777d] leading-relaxed">
          The bystander effect describes the phenomenon in which individuals are less likely to offer help when other people are present. Darley and Latané first demonstrated this in laboratory conditions…
        </div>
        <Chips items={["Essay · 1,842 words", "Text check", "Code check (A vs B)"]} />
        <FakeButton><Search size={11} /> Check for AI &amp; Plagiarism</FakeButton>
      </div>
      <div className="td-proc">
        <Proc
          title="Scanning your paper…"
          rows={[
            { label: "Comparing against 10B+ indexed pages", meta: "✓" },
            { label: "Tracing matches to their real sources", meta: "2 found" },
            { label: "Running AI-content detection", meta: "✓" },
            { label: "Building sentence-level report", meta: "✓" },
          ]}
        />
      </div>
      <div className="td-res">
        <div className="grid grid-cols-2 gap-2.5 mb-2">
          <div className="td-r1 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-center">
            <div className="text-xl font-bold text-emerald-600">3.1%</div>
            <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide">Similarity</div>
          </div>
          <div className="td-r2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-center">
            <div className="text-xl font-bold text-emerald-600">12%</div>
            <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide">AI probability</div>
          </div>
        </div>
        <div className="td-r3 space-y-1 mb-1.5">
          <div className="flex items-center justify-between text-[9.5px] text-[#45464d] bg-[#f7f9fb] border border-[#e0e3e5] rounded-lg px-2.5 py-1.5">
            <span className="truncate">en.wikipedia.org/wiki/Bystander_effect — "less likely to offer help"</span><span className="font-bold text-[#76777d] shrink-0 ml-2">1.8%</span>
          </div>
          <div className="flex items-center justify-between text-[9.5px] text-[#45464d] bg-[#f7f9fb] border border-[#e0e3e5] rounded-lg px-2.5 py-1.5">
            <span className="truncate">psycnet.apa.org — Darley &amp; Latané (1968) definition</span><span className="font-bold text-[#76777d] shrink-0 ml-2">1.3%</span>
          </div>
        </div>
        <div className="td-r4 flex items-center gap-2 text-[10px] font-semibold text-emerald-700"><Check size={11} strokeWidth={3} /> Under the 8% ceiling — safe to submit · full report downloadable</div>
      </div>
    </Window>
  );
}

function StemDemo() {
  return (
    <Window url="stem" height={336}>
      <div className="td-in">
        <div className="flex flex-wrap gap-1 mb-2">
          {[
            { label: "Math", icon: <Calculator size={9} />, on: true },
            { label: "Physics", icon: <Atom size={9} />, on: false },
            { label: "Chemistry", icon: <FlaskConical size={9} />, on: false },
            { label: "CS", icon: <Cpu size={9} />, on: false },
          ].map((s) => (
            <span key={s.label} className={`inline-flex items-center gap-1 text-[9.5px] font-semibold rounded-full px-2 py-1 border ${s.on ? "bg-[#10b981] text-white border-[#10b981]" : "bg-white text-[#45464d] border-[#e0e3e5]"}`}>
              {s.icon} {s.label}
            </span>
          ))}
          <span className="text-[9.5px] font-semibold text-[#76777d] px-1.5 py-1">+6 more</span>
        </div>
        <TypeBox mono text="Find the definite integral of x·sin(x) from 0 to π" />
        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-[#45464d] bg-white border border-[#e0e3e5] rounded-lg px-2.5 py-1.5 w-fit">
          <Camera size={11} className="text-[#10b981]" /> IMG_2041.jpg · OCR extracted the problem <Check size={10} className="text-emerald-600" strokeWidth={3} />
        </div>
        <FakeButton><Zap size={11} /> Solve</FakeButton>
      </div>
      <div className="td-proc">
        <Proc
          title="Reason → act → observe → check…"
          rows={[
            { label: "Method selected: integration by parts", meta: "✓" },
            { label: "Deriving each step with KaTeX rendering", meta: "2 steps" },
            { label: "Critic layer verifying the math", meta: "no errors" },
            { label: "Plotting x·sin(x) on [0, π]", meta: "✓" },
          ]}
        />
      </div>
      <div className="td-res">
        <div className="td-r1 text-[10.5px] font-mono text-[#191c1e] bg-[#f7f9fb] border border-[#e0e3e5] rounded-lg px-3 py-1.5 mb-1.5">
          <span className="text-[#10b981] font-bold">Step 1</span> · u = x, dv = sin(x)dx → du = dx, v = −cos(x)
        </div>
        <div className="td-r2 text-[10.5px] font-mono text-[#191c1e] bg-[#f7f9fb] border border-[#e0e3e5] rounded-lg px-3 py-1.5 mb-1.5">
          <span className="text-[#10b981] font-bold">Step 2</span> · [−x·cos(x)]₀^π + ∫₀^π cos(x)dx = π + [sin(x)]₀^π
        </div>
        <div className="td-r3 flex items-center gap-2 text-[11.5px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 mb-2">
          <Check size={12} strokeWidth={3} /> Answer: π ≈ 3.14159 · verified by critic layer
        </div>
        <svg className="td-r4" width="100%" height="30" viewBox="0 0 260 30" fill="none" aria-hidden>
          <path d="M2 28 C 40 28, 60 2, 130 2 S 220 28, 258 28" stroke="#10b981" strokeWidth="2" />
          <line x1="2" y1="28" x2="258" y2="28" stroke="#d8dadc" strokeWidth="1" />
        </svg>
      </div>
    </Window>
  );
}

function StudyDemo() {
  return (
    <Window url="study" height={336}>
      <div className="td-in">
        <div className="flex flex-wrap gap-1 mb-2">
          {["Tutor", "Explain", "Quiz", "Summarize"].map((mo, i) => (
            <span key={mo} className={`text-[9.5px] font-semibold rounded-full px-2.5 py-1 border ${i === 0 ? "bg-[#10b981] text-white border-[#10b981]" : "bg-white text-[#45464d] border-[#e0e3e5]"}`}>{mo}</span>
          ))}
        </div>
        <Label>Enter a topic, question, or paste your notes here…</Label>
        <TypeBox text="Explain photosynthesis like I'm cramming for finals" />
        <UploadRow label="Your materials (optional)" file="Bio_201_notes.pdf" />
        <FakeButton><GraduationCap size={11} /> Start Session</FakeButton>
      </div>
      <div className="td-proc">
        <Proc
          title="Your tutor is thinking…"
          rows={[
            { label: "Semantic recall: your past Bio 201 sessions", meta: "3 found" },
            { label: "You struggled with electron transport — adjusting", meta: "✓" },
            { label: "Reading your uploaded chapter notes", meta: "p. 4–9" },
            { label: "Preparing quiz questions for weak spots", meta: "3 Qs" },
          ]}
        />
      </div>
      <div className="td-res">
        <div className="td-r1 ml-auto max-w-[85%] bg-[#10b981] text-white text-[10.5px] rounded-xl rounded-br-sm px-3 py-1.5 mb-1.5 w-fit">
          Explain photosynthesis like I'm cramming for finals
        </div>
        <div className="td-r2 max-w-[92%] bg-[#f7f9fb] border border-[#e0e3e5] text-[10.5px] text-[#191c1e] rounded-xl rounded-bl-sm px-3 py-2 mb-1.5 leading-relaxed">
          Two stages. <b>Light reactions</b> (thylakoid): capture light → ATP + NADPH. <b>Calvin cycle</b> (stroma): spend that energy to fix CO₂ → glucose. Last week the electron transport chain tripped you up — remember: it's just electrons falling downhill, pumping H⁺ as they go.
        </div>
        <div className="td-r3 flex flex-wrap gap-1.5">
          <span className="text-[9px] font-bold text-[#047857] bg-[#d1fae5] rounded-full px-2 py-1">Memory: Bio 201 · exam Friday · weak spot: ETC</span>
          <span className="text-[9px] font-bold text-[#45464d] bg-white border border-[#e0e3e5] rounded-full px-2 py-1">Quiz me →</span>
          <span className="text-[9px] font-bold text-[#45464d] bg-white border border-[#e0e3e5] rounded-full px-2 py-1">Make flashcards</span>
        </div>
      </div>
    </Window>
  );
}

function EbookDemo() {
  return (
    <Window url="ebooks" height={336}>
      <div className="td-in">
        <Label>Ebook title *</Label>
        <TypeBox text="How to Scale a Dropshipping Business from $0 to $1M" />
        <div className="mt-2">
          <p className="text-[8.5px] font-semibold text-[#76777d] uppercase tracking-wide mb-0.5">Target audience *</p>
          <div className="rounded-md border border-[#c6c6cd] bg-white px-2.5 py-1.5 text-[9.5px] text-[#45464d]">First-time entrepreneurs aged 25–40 seeking passive income</div>
        </div>
        <SelectRow fields={[["Language", "English"], ["Tone", "Authoritative"], ["Length", "Standard ~15k"]]} />
        <FakeButton><Sparkles size={11} /> Generate with LightSpeed AI</FakeButton>
      </div>
      <div className="td-proc">
        <Proc
          title="Writing your ebook…"
          rows={[
            { label: "Research: HBR · MIT Sloan · McKinsey", meta: "14 sources" },
            { label: "Expert quotes matched: Drucker, Buffett, Sinek", meta: "6 quotes" },
            { label: "Writing chapter 4 of 12 — case studies", meta: "§4/12" },
            { label: "Building Amazon KDP listing guide", meta: "✓" },
          ]}
        />
      </div>
      <div className="td-res">
        <div className="flex gap-3">
          <div className="td-r1 w-[74px] h-[104px] rounded-lg bg-gradient-to-br from-[#10b981] to-[#0d9488] shrink-0 p-2 flex flex-col justify-between shadow-md">
            <Sparkles size={10} className="text-white/80" />
            <span className="text-[6.5px] font-bold text-white leading-tight">HOW TO SCALE A DROPSHIPPING BUSINESS FROM $0 TO $1M</span>
          </div>
          <div className="flex-1 min-w-0">
            {["1 · The $0 → $1M roadmap", "2 · Products that actually sell", "3 · \"Efficiency is doing things right…\" — Drucker"].map((c, i) => (
              <div key={c} className={`td-r${(i + 1) as 1 | 2 | 3} text-[9.5px] text-[#45464d] bg-[#f7f9fb] border border-[#e0e3e5] rounded-lg px-2.5 py-1.5 mb-1.5 truncate`}>{c}</div>
            ))}
            <div className="td-r4 space-y-1">
              <div className="flex items-center gap-2 text-[9.5px] font-semibold text-emerald-700"><Check size={10} strokeWidth={3} /> 12 chapters · 15,214 words · DOCX ready</div>
              <div className="flex items-center gap-2 text-[9.5px] font-semibold text-emerald-700"><Check size={10} strokeWidth={3} /> KDP title, keywords &amp; category paths included</div>
            </div>
          </div>
        </div>
      </div>
    </Window>
  );
}

// ── Per-tool content: everything about each tool, in one place ────────────────
// Merged from the old tools grid, AI-capabilities grid, feature deep-dives,
// and the ebooks section.

interface Showcase {
  anchor: string;
  icon: typeof PenLine;
  kicker: string;
  badge?: string;
  headline: string;
  desc: string;
  bullets: string[];
  capabilities: string[];
  cta: string;
  ctaNote?: string;
  demo: React.ReactNode;
}

const SHOWCASES: Showcase[] = [
  {
    anchor: "tool-write", icon: PenLine, kicker: "Ground Truth Research · Paper Writer", badge: "Most used",
    headline: "A draft you can actually submit. Not cringe at.",
    desc: "Writes from real academic papers, never from memory. Upload your rubric and the A-grade criteria are extracted first — before a single word is written. Every paragraph is then grounded in 35+ live databases with real, clickable DOI citations, plagiarism-gated below 8%, and cross-checked against your rubric before delivery.",
    bullets: [
      "35+ live academic databases queried per paper — 10B+ papers",
      "A-grade rubric extraction + cross-check on every output",
      "Plagiarism enforced below 8% — not estimated, measured",
      "APA 7th, MLA 9th, Chicago 17th, Harvard, IEEE — latest editions",
      "500 to 15,000 words — essays, research papers, dissertations, theses",
    ],
    capabilities: ["35+ Live Academic Databases", "Dataset Analysis — CSV & spreadsheets", "STEM mode: equations in the right section"],
    cta: "Write your first paper",
    demo: <WriteDemo />,
  },
  {
    anchor: "tool-outline", icon: ListTree, kicker: "Structure First · Outline Builder",
    headline: "Your argument, mapped before you write a sentence.",
    desc: "Upload your assignment brief and get a complete hierarchical outline built for your topic in seconds — thesis statement, section-by-section notes, and suggested sources, ordered for logical flow.",
    bullets: [
      "Reads your assignment brief and extracts the requirements",
      "Thesis statement written for you, ready to defend",
      "Notes + suggested sources under every section",
      "Expands straight into a full draft with the Paper Writer",
    ],
    capabilities: ["Brief parsing", "Theme mapping from live literature"],
    cta: "Build an outline",
    demo: <OutlineDemo />,
  },
  {
    anchor: "tool-revision", icon: FileEdit, kicker: "Rubric-Aware Rewriting · Paper Revision", badge: "Grade booster",
    headline: "From the grade you got to the grade you need.",
    desc: "Paste your draft, upload the rubric, set your target grade. We score the draft against the A-grade criteria, rewrite what needs rewriting, and explain every change so you actually learn from it.",
    bullets: [
      "Before/after grade estimate scored against your rubric",
      "Weak arguments rewritten with real evidence added",
      "Citations corrected to the right style edition",
      "Every change explained — improve the paper and your writing",
    ],
    capabilities: ["Rubric criteria scoring", "Change-by-change explanations"],
    cta: "Revise my paper",
    demo: <RevisionDemo />,
  },
  {
    anchor: "tool-humanizer", icon: Wand2, kicker: "Natural Academic Voice · LightSpeed Humanizer", badge: "Authentic voice",
    headline: "Reads like you on a good day. Not a robot.",
    desc: "AI-assisted drafts read stiff and robotic. The Humanizer rewrites them into natural, authentic academic prose in your own voice — varied sentence rhythm, genuine phrasing — so your writing reads as authentically human, never machine-generated.",
    bullets: [
      "AI-detection score measured before and after",
      "Robotic connectors and templated phrasing swapped out",
      "Citations, quotes, and technical terms preserved exactly",
      "Meaning stays intact — it's your argument, in your voice",
    ],
    capabilities: ["Natural Academic Voice engine", "Detection re-check built in"],
    cta: "Humanize my text",
    demo: <HumanizerDemo />,
  },
  {
    anchor: "tool-plagiarism", icon: ShieldCheck, kicker: "Free · Verify Before You Submit · AI & Plagiarism Checker", badge: "Free — no AI model",
    headline: "Know before your professor does — free.",
    desc: "The free tool at the top of the page. Verify your own work for originality and accuracy before you submit. Every similarity match is traced back to its real source so you can check and correct it yourself — plus an AI-content probability score on the same scan. It never touches an AI model, so it's free.",
    bullets: [
      "Similarity measured against 10B+ indexed pages",
      "Every match traced to its real source, sentence by sentence",
      "AI-content probability on the same report",
      "Downloadable report you can keep as evidence",
    ],
    capabilities: ["Structural code plagiarism — MOSS-style fingerprinting", "Catches renamed variables & reshuffled logic"],
    cta: "Check your writing free",
    ctaNote: "Free forever · never touches an AI model · sign in to run the full scan",
    demo: <PlagiarismDemo />,
  },
  {
    anchor: "tool-stem", icon: FlaskConical, kicker: "Step-by-Step STEM Logic · STEM Solver", badge: "Photo upload",
    headline: "Photograph the problem. Get the full method.",
    desc: "Point your phone at a problem set and upload the image. OCR extracts the text, we identify the subject, and you get a full worked solution with step-by-step reasoning — not just the answer. Drop in lab data and it analyses it for you.",
    bullets: [
      "Photo upload with browser OCR — or type it",
      "Math, Physics, Chemistry, Biology, CS, Engineering",
      "KaTeX equation rendering + graphs where they help",
      "Linked research papers per topic",
    ],
    capabilities: ["Multi-Step Reasoning — think, act, observe + critic layer that checks the math", "Chemistry Intelligence — PubChem, 100M+ compounds", "Dataset analysis — CSV uploads"],
    cta: "Solve a problem",
    demo: <StemDemo />,
  },
  {
    anchor: "tool-study", icon: GraduationCap, kicker: "Persistent Student Memory · Study Assistant", badge: "Reads your materials",
    headline: "A tutor that already knows where you struggle.",
    desc: "Reads your own materials or pulls from academic databases, then builds flashcards, quizzes, summaries, study guides, and slides tailored to your content. Every session is silently indexed into your personal AI memory — next time, it already knows what you've covered and where you've struggled.",
    bullets: [
      "Persistent memory across every session, forever",
      "Semantic recall — ask about \"Newton's laws\", it finds your \"force and acceleration\" session",
      "Flashcards, quizzes, summaries, study guides & slides from your content",
      "Finds your weak points and tells you exactly where to focus",
    ],
    capabilities: ["Persistent Student Memory", "Semantic Recall", "4 modes: Tutor · Explain · Quiz · Summarize"],
    cta: "Start studying",
    demo: <StudyDemo />,
  },
  {
    anchor: "ebooks", icon: BookOpen, kicker: "Ebook Generator · For Publishers", badge: "2.5M+ publishers · $29.99/mo · separate from academic plans",
    headline: "Publish ebooks on Amazon & every platform.",
    desc: "Write professional, publish-ready ebooks grounded in verified academic and industry research — Harvard Business Review, MIT Sloan, McKinsey, Semantic Scholar and 10 more. Expert quotes from Drucker, Buffett, Sinek chosen to match your topic. Every ebook arrives with a complete Amazon KDP listing guide.",
    bullets: [
      "Amazon KDP, Apple Books, Google Play, Kobo, B&N Press",
      "15 languages · 20+ industries · 6 writing tones",
      "Short (~8k), Standard (~15k) or Extended (~25k words)",
      "Ready-to-paste KDP title, description, keywords & category paths",
      "15 ebooks per month — separate from academic plans",
    ],
    capabilities: ["Verified research grounding", "Expert-quote matching", "KDP listing generator"],
    cta: "Start Writing Ebooks",
    ctaNote: "$29.99/month · cancel anytime · not included in any academic subscription",
    demo: <EbookDemo />,
  },
];

export function ToolDemosSection() {
  return (
    <section id="tools" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 bg-white border-y border-[#e0e3e5] overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <p className="text-[#10b981] text-sm font-bold uppercase tracking-widest mb-3 sm:mb-4">One workspace · a free checker + every writing tool · watch them work</p>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight mb-4 text-[#131b2e]">
            Everything you need, built on real research.
          </h2>
          <p className="text-[#45464d] text-base sm:text-lg">
            Every tool is powered by purpose-built AI capabilities — not a generic chatbot wrapper. Each demo below mirrors the real tool: what you put in, what it does, and what you get back.
          </p>
        </div>

        <div className="space-y-16 sm:space-y-24">
          {SHOWCASES.map(({ anchor, icon: Icon, kicker, badge, headline, desc, bullets, capabilities, cta, ctaNote, demo }, i) => (
            <div key={anchor} id={anchor} className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center scroll-mt-24">
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-[#10b981]/10 text-[#10b981] flex items-center justify-center shrink-0"><Icon size={17} /></div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#10b981]">{kicker}</span>
                  {badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#10b981] text-white">{badge}</span>
                  )}
                </div>
                <h3 className="text-2xl sm:text-[28px] font-bold text-[#131b2e] leading-tight mb-3">{headline}</h3>
                <p className="text-[#45464d] text-sm sm:text-base leading-relaxed mb-5">{desc}</p>
                <ul className="space-y-2 mb-5">
                  {bullets.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-[#191c1e]">
                      <CheckCircle size={15} className="text-[#10b981] shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <div className="mb-6">
                  <p className="text-[10px] font-bold text-[#76777d] uppercase tracking-widest mb-2">Powered by</p>
                  <div className="flex flex-wrap gap-1.5">
                    {capabilities.map((c) => (
                      <span key={c} className="text-[11px] font-semibold text-[#45464d] bg-[#f7f9fb] border border-[#e0e3e5] rounded-full px-2.5 py-1">{c}</span>
                    ))}
                  </div>
                </div>
                <Link href="/auth">
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-lg transition-all cursor-pointer shadow-md shadow-[#10b981]/25 hover:-translate-y-0.5 text-sm">
                    {cta} <ArrowRight size={14} />
                  </span>
                </Link>
                {ctaNote && <p className="text-[11px] text-[#76777d] mt-2.5">{ctaNote}</p>}
              </div>
              <div className={i % 2 === 1 ? "lg:order-1" : ""}>{demo}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
