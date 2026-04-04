import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Zap, Ghost, ArrowRight, CheckCircle, Star, Menu, X,
  PenLine, BookOpen, ShieldCheck, FlaskConical, GraduationCap,
  FileText, ChevronDown, ChevronUp, Sparkles, Upload, BarChart3,
  Users, Award, Clock, Quote
} from "lucide-react";

function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

const tools = [
  {
    icon: PenLine,
    name: "Paper Writer",
    desc: "Full academic papers with properly formatted citations, bibliography, and subject-specific depth. APA, MLA, Chicago, IEEE — pick your style.",
    badge: "Most used",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  {
    icon: BookOpen,
    name: "Outline Builder",
    desc: "Structure your argument before you write a single sentence. Upload an assignment brief and get a complete hierarchical outline in seconds.",
    badge: null,
    color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  {
    icon: FileText,
    name: "Paper Revision",
    desc: "Paste your draft, tell us your target grade, upload the rubric. We rewrite what needs rewriting and explain every change.",
    badge: "Grade booster",
    color: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  },
  {
    icon: ShieldCheck,
    name: "AI & Plagiarism Check",
    desc: "Detect AI patterns and similarity before your professor does. Then humanize flagged sections with one click.",
    badge: null,
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  {
    icon: FlaskConical,
    name: "STEM Solver",
    desc: "Upload a photo of your problem set. Get step-by-step solutions with graphs, molecule data, and linked research papers.",
    badge: "Photo upload",
    color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  },
  {
    icon: GraduationCap,
    name: "AI Study Assistant",
    desc: "Ask anything, upload your lecture notes, and quiz yourself. It remembers your sessions so you can pick up where you left off.",
    badge: null,
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
];

const testimonials = [
  {
    name: "Priya S.",
    role: "3rd Year · Biochemistry · UCL",
    text: "I uploaded my rubric, my draft, and my grade (58%). Asked it to hit a First. The revised version was genuinely better — tighter arguments, proper signposting. Got 72 on the resubmission.",
    stars: 5,
  },
  {
    name: "Marcus T.",
    role: "2nd Year · Computer Science · Georgia Tech",
    text: "The STEM solver is the one. I photograph my problem set, pick the subject, and it walks me through every step. Not just the answer — the actual method. My calc grade went from C to B+ this semester.",
    stars: 5,
  },
  {
    name: "Aisha K.",
    role: "Postgrad · International Relations · Edinburgh",
    text: "The plagiarism checker caught things TurnItIn missed. The humanization actually sounds like me writing on a good day, not like a robot trying to sound human. Big difference from what I've tried before.",
    stars: 5,
  },
];

const faqs = [
  {
    q: "Is this actually safe to use? Will my university know?",
    a: "Light Speed Ghost is a writing aid — the same category as Grammarly, tutoring, or study groups. We don't store or share your work. That said, always review what's generated and make it genuinely yours before submitting.",
  },
  {
    q: "How is the paper quality? I've tried AI writers before and they're terrible.",
    a: "Fair skepticism. The difference is we pull from Semantic Scholar's academic database for real citations, and the output goes through subject-specific prompting — not a generic 'write me an essay' call. It's not perfect, but it's a solid draft you can actually work from.",
  },
  {
    q: "Does file upload work with PDFs from my university portal?",
    a: "Yes — PDFs, Word documents, plain text. You can also photograph a physical problem sheet and our OCR will extract the text. Most PDFs extract cleanly; scanned image-only PDFs may vary.",
  },
  {
    q: "What happens to my data?",
    a: "Your documents and sessions are stored only for your account. We don't train on your content, don't share it with third parties, and you can delete everything from your account at any time.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. Free includes 3 paper generations per month, unlimited plagiarism checks, full STEM solver access, and the study assistant with no session limit. Pro removes all caps.",
  },
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    per: "forever",
    desc: "Good enough to try. Actually useful for occasional work.",
    features: [
      "3 paper generations / month",
      "Unlimited plagiarism checks",
      "Full STEM solver",
      "Study assistant (unlimited sessions)",
      "File upload & OCR",
    ],
    cta: "Start Free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$12",
    per: "per month",
    desc: "For students who have deadlines every week and need all caps removed.",
    features: [
      "Unlimited paper generation",
      "Unlimited revisions",
      "Priority AI processing",
      "Full humanization suite",
      "Document history (90 days)",
      "Citation export (BibTeX, RIS)",
    ],
    cta: "Get Pro",
    highlight: true,
  },
  {
    name: "Team",
    price: "$8",
    per: "per user / month",
    desc: "Study groups, tutoring centers, small institutions.",
    features: [
      "Everything in Pro",
      "Shared document library",
      "5–50 seats",
      "Usage dashboard",
      "Priority support",
    ],
    cta: "Contact Us",
    highlight: false,
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4 group"
      >
        <span className="text-white font-medium group-hover:text-blue-300 transition-colors">{q}</span>
        {open ? <ChevronUp size={18} className="text-blue-400 shrink-0" /> : <ChevronDown size={18} className="text-white/40 group-hover:text-blue-400 shrink-0 transition-colors" />}
      </button>
      {open && (
        <p className="pb-5 text-white/60 leading-relaxed text-sm">{a}</p>
      )}
    </div>
  );
}

export default function Landing() {
  const scrolled = useScrolled();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased overflow-x-hidden">

      {/* ─── NAV ─── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#04080f]/90 backdrop-blur-md border-b border-white/5 shadow-lg" : ""}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-600/30">
                <Ghost size={18} className="text-white" />
              </div>
              <span className="font-bold text-white text-lg tracking-tight">Light Speed <span className="text-blue-400">Ghost</span></span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {["Features", "Tools", "Pricing", "FAQ"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="px-4 py-2 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/app">
              <span className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors cursor-pointer">Sign In</span>
            </Link>
            <Link href="/app">
              <span className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors cursor-pointer shadow-md shadow-blue-600/20">
                Get Started Free
              </span>
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-white/60 hover:text-white"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-[#04080f] border-t border-white/10 px-6 py-4 space-y-1">
            {["Features", "Tools", "Pricing", "FAQ"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5"
              >
                {item}
              </a>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <Link href="/app">
                <span className="block text-center px-4 py-2.5 text-sm border border-white/20 text-white rounded-lg cursor-pointer">Sign In</span>
              </Link>
              <Link href="/app">
                <span className="block text-center px-4 py-2.5 text-sm bg-blue-600 text-white font-medium rounded-lg cursor-pointer">Get Started Free</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center overflow-hidden">
        {/* background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-600/15 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-violet-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium mb-8">
            <Zap size={12} className="text-blue-400" />
            6 AI tools. One platform. Actually works.
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
            Your deadline is{" "}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
                tonight.
              </span>
            </span>
            <br />
            Your notes are chaos.
          </h1>

          <p className="text-lg sm:text-xl text-white/55 max-w-2xl mx-auto leading-relaxed mb-10">
            Light Speed Ghost handles the writing, revision, plagiarism checking, and STEM problems — so you can stop staring at a blank page and start actually sleeping.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/app">
              <span className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-xl shadow-blue-600/25 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-100">
                Start Free — No Card Needed
                <ArrowRight size={16} />
              </span>
            </Link>
            <a href="#tools" className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/15 hover:border-white/30 text-white/70 hover:text-white rounded-xl transition-all hover:bg-white/5">
              See What It Does
            </a>
          </div>

          <p className="mt-5 text-xs text-white/30">Free forever plan · No credit card · Works in any browser</p>
        </div>

        {/* product preview */}
        <div className="relative mt-20 w-full max-w-5xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#04080f] z-10 pointer-events-none" style={{ top: "60%" }} />
          <div className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-blue-900/20 bg-[#0b1120]">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5 bg-[#060d1a]">
              <span className="w-3 h-3 rounded-full bg-red-500/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <span className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs text-white/20 font-mono">lightspeedghost.com/write</span>
            </div>
            <div className="flex" style={{ minHeight: "340px" }}>
              {/* sidebar */}
              <div className="w-52 bg-[#060d1a] border-r border-white/5 p-3 shrink-0 hidden sm:block">
                <div className="mb-4 px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center"><Ghost size={12} /></div>
                    <span className="text-xs font-bold text-white">Light Speed Ghost</span>
                  </div>
                </div>
                {[
                  { label: "Dashboard", active: false },
                  { label: "Write Paper", active: true },
                  { label: "Outline", active: false },
                  { label: "Revision", active: false },
                  { label: "AI & Plagiarism", active: false },
                  { label: "STEM Solver", active: false },
                  { label: "Study Assistant", active: false },
                ].map(({ label, active }) => (
                  <div key={label} className={`px-3 py-2 rounded-lg text-xs mb-0.5 font-medium ${active ? "bg-blue-600 text-white" : "text-white/30"}`}>
                    {label}
                  </div>
                ))}
              </div>
              {/* main content */}
              <div className="flex-1 p-6 space-y-4">
                <div className="h-6 w-48 bg-white/10 rounded-md" />
                <div className="h-3 w-72 bg-white/5 rounded" />
                <div className="mt-6 space-y-3">
                  <div className="h-10 bg-white/5 rounded-lg border border-white/10" />
                  <div className="h-10 bg-white/5 rounded-lg border border-white/10" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-10 bg-white/5 rounded-lg border border-white/10" />
                    <div className="h-10 bg-white/5 rounded-lg border border-white/10" />
                  </div>
                  <div className="h-20 bg-white/5 rounded-lg border border-white/10" />
                  <div className="h-10 bg-blue-600/40 rounded-lg border border-blue-500/30 flex items-center justify-center">
                    <div className="h-3 w-24 bg-blue-400/60 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="border-y border-white/5 bg-white/[0.02] py-14">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "52,000+", label: "Papers generated" },
            { value: "3.5 hrs", label: "Average time saved per essay" },
            { value: "94%", label: "Users who passed their deadline" },
            { value: "200+", label: "Universities represented" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-3xl font-bold text-white mb-1">{value}</div>
              <div className="text-sm text-white/40">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES / TOOLS ─── */}
      <section id="tools" className="py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-4">What it does</p>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-5">
              Six tools.<br />One subscription.
            </h2>
            <p className="text-white/50 text-lg">
              Each tool is built for a specific academic pain point. They work independently or together — run your paper through the writer, then straight into the plagiarism checker.
            </p>
          </div>

          <div id="features" className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tools.map(({ icon: Icon, name, desc, badge, color }) => (
              <div
                key={name}
                className="group relative p-6 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-white/15 hover:bg-white/[0.05] transition-all"
              >
                {badge && (
                  <span className={`absolute top-5 right-5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
                    {badge}
                  </span>
                )}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 border ${color}`}>
                  <Icon size={20} />
                </div>
                <h3 className="font-semibold text-white mb-2">{name}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-4">How it works</p>
            <h2 className="text-4xl font-bold">From brief to submission in three steps</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                num: "01",
                title: "Upload or describe your task",
                body: "Drag in your assignment PDF, paste the brief, or just describe what you need. The platform reads the rubric and figures out the rest.",
                icon: Upload,
              },
              {
                num: "02",
                title: "Generate, revise, or check",
                body: "Pick your tool. Full paper, outline, revision, plagiarism scan, STEM solution — or all four in sequence. Each one feeds into the next.",
                icon: Sparkles,
              },
              {
                num: "03",
                title: "Review, edit, and submit",
                body: "Everything generated is a starting point, not a finish line. Read it, adjust your voice, and submit something you can actually stand behind.",
                icon: CheckCircle,
              },
            ].map(({ num, title, body, icon: Icon }) => (
              <div key={num} className="relative">
                <div className="text-6xl font-bold text-white/5 leading-none mb-4 select-none">{num}</div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <Icon size={18} className="text-blue-400" />
                </div>
                <h3 className="font-semibold text-white mb-3 text-lg">{title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURE DEEP DIVE ─── */}
      <section className="py-28 px-6">
        <div className="max-w-6xl mx-auto space-y-32">

          {/* Feature 1: Paper Writer */}
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-5">Paper Writer</p>
              <h2 className="text-4xl font-bold mb-5 leading-tight">A draft you can actually submit. Not cringe at.</h2>
              <p className="text-white/55 leading-relaxed mb-8">
                Type your topic, pick your citation style, choose your length. We pull real academic sources from Semantic Scholar and weave them into the argument — not fake references with broken URLs.
              </p>
              <ul className="space-y-3">
                {["Real citations with working URLs", "APA, MLA, Chicago, Harvard, IEEE", "STEM mode for equations and technical content", "500 to 2,500+ words on demand"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <CheckCircle size={15} className="text-blue-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-6 shadow-xl">
              <div className="text-xs text-white/30 uppercase tracking-widest mb-4 font-medium">Generated output</div>
              <div className="space-y-3">
                <div className="h-5 w-3/4 bg-white/10 rounded" />
                <div className="h-3 w-full bg-white/5 rounded" />
                <div className="h-3 w-5/6 bg-white/5 rounded" />
                <div className="h-3 w-4/5 bg-white/5 rounded" />
                <div className="h-3 w-full bg-white/5 rounded" />
                <div className="mt-4 h-3 w-2/3 bg-white/5 rounded" />
                <div className="h-3 w-full bg-white/5 rounded" />
                <div className="h-3 w-3/4 bg-white/5 rounded" />
              </div>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex-1 h-8 bg-blue-600/20 border border-blue-500/20 rounded-lg flex items-center px-3">
                  <div className="h-2 w-20 bg-blue-400/40 rounded" />
                </div>
                <div className="flex-1 h-8 bg-white/5 border border-white/10 rounded-lg" />
              </div>
              <div className="mt-3 text-xs text-white/30 flex items-center gap-2">
                <BarChart3 size={12} />
                1,247 words · 6 citations · APA 7th
              </div>
            </div>
          </div>

          {/* Feature 2: STEM Solver */}
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="order-2 md:order-1 rounded-2xl border border-white/10 bg-[#0b1120] p-6 shadow-xl">
              <div className="text-xs text-white/30 uppercase tracking-widest mb-4 font-medium">Step-by-step solution</div>
              <div className="space-y-3">
                {["Step 1 — Identify the knowns", "Step 2 — Apply Newton's second law", "Step 3 — Solve for acceleration", "Step 4 — Calculate displacement"].map((step, i) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-500/30 text-blue-300 text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white/80">{step}</div>
                      <div className="h-2 w-32 bg-white/5 rounded mt-1" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 p-3 bg-blue-600/5 border border-blue-500/15 rounded-xl text-xs text-blue-300 font-mono">
                a = F/m = 12 N / 3 kg = <span className="text-blue-200 font-bold">4 m/s²</span>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <p className="text-cyan-400 text-xs font-semibold uppercase tracking-widest mb-5">STEM Solver</p>
              <h2 className="text-4xl font-bold mb-5 leading-tight">Photograph the problem. Get the method.</h2>
              <p className="text-white/55 leading-relaxed mb-8">
                Point your phone at a problem set and upload the image. OCR extracts the text, we identify the subject, and you get a full worked solution — not just the answer.
              </p>
              <ul className="space-y-3">
                {["Photo upload with browser OCR", "Math, Physics, Chemistry, Biology, CS", "Graph visualization for functions", "Linked research papers per topic"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <CheckCircle size={15} className="text-cyan-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-4">Real students</p>
            <h2 className="text-4xl font-bold">It's not perfect. But it gets the job done.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(({ name, role, text, stars }) => (
              <div key={name} className="p-6 rounded-2xl bg-white/[0.03] border border-white/8">
                <Quote size={20} className="text-blue-500/40 mb-4" />
                <p className="text-white/70 text-sm leading-relaxed mb-6">{text}</p>
                <div className="flex items-center gap-0.5 mb-3">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <div className="font-semibold text-white text-sm">{name}</div>
                <div className="text-white/35 text-xs mt-0.5">{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-4">Pricing</p>
            <h2 className="text-4xl font-bold mb-4">Honest pricing. No dark patterns.</h2>
            <p className="text-white/45">The free plan is actually useful. Pro removes every cap.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {pricingPlans.map(({ name, price, per, desc, features, cta, highlight }) => (
              <div
                key={name}
                className={`relative p-7 rounded-2xl border ${
                  highlight
                    ? "bg-blue-600/10 border-blue-500/40 shadow-xl shadow-blue-900/20"
                    : "bg-white/[0.02] border-white/8"
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                    Most popular
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="font-semibold text-white mb-1">{name}</h3>
                  <div className="flex items-end gap-1.5">
                    <span className="text-4xl font-bold text-white">{price}</span>
                    <span className="text-white/40 text-sm mb-1">{per}</span>
                  </div>
                  <p className="text-white/45 text-xs mt-2 leading-relaxed">{desc}</p>
                </div>
                <ul className="space-y-2.5 mb-7">
                  {features.map(feat => (
                    <li key={feat} className="flex items-center gap-2.5 text-sm text-white/65">
                      <CheckCircle size={14} className={highlight ? "text-blue-400" : "text-white/30"} />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link href="/app">
                  <span className={`block text-center py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    highlight
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20"
                      : "border border-white/15 hover:border-white/30 text-white/80 hover:text-white hover:bg-white/5"
                  }`}>
                    {cta}
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-4">FAQ</p>
            <h2 className="text-4xl font-bold">Questions we actually get asked</h2>
          </div>
          <div>
            {faqs.map(faq => <FAQItem key={faq.q} {...faq} />)}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Ghost size={28} className="text-blue-400" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
            Stop starting at midnight.<br />Start with a draft.
          </h2>
          <p className="text-white/50 mb-10 text-lg">
            Free forever. Six tools. No card required to start.
          </p>
          <Link href="/app">
            <span className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-xl shadow-blue-600/25 hover:scale-[1.02] active:scale-100 text-lg">
              Open the Platform
              <ArrowRight size={18} />
            </span>
          </Link>
          <p className="mt-5 text-xs text-white/25">
            Trusted by students at UCL, Georgia Tech, Edinburgh, UT Austin, and 197 other universities
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Ghost size={16} className="text-white" />
                </div>
                <span className="font-bold text-white">Light Speed Ghost</span>
              </div>
              <p className="text-white/35 text-sm leading-relaxed max-w-xs">
                Academic writing tools for students who have deadlines and standards.
              </p>
              <div className="flex items-center gap-3 mt-5">
                {["Twitter", "Discord", "LinkedIn"].map(soc => (
                  <a key={soc} href="#" className="text-white/25 hover:text-white/60 text-xs transition-colors">{soc}</a>
                ))}
              </div>
            </div>

            {[
              {
                title: "Product",
                links: ["Paper Writer", "Outline Builder", "Revision", "AI & Plagiarism", "STEM Solver", "Study Assistant"],
              },
              {
                title: "Company",
                links: ["About", "Blog", "Changelog", "Careers", "Press"],
              },
              {
                title: "Legal",
                links: ["Privacy Policy", "Terms of Service", "Cookie Policy", "Academic Use Policy"],
              },
            ].map(({ title, links }) => (
              <div key={title}>
                <h4 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-4">{title}</h4>
                <ul className="space-y-2.5">
                  {links.map(link => (
                    <li key={link}>
                      <a href="#" className="text-white/35 hover:text-white/65 text-sm transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 pt-7 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
            <p className="text-white/20 text-xs">Built for students. By students who missed too many deadlines.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
