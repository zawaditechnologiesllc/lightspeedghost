import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import type { PlanId } from "@/lib/pricing";
import {
  Zap, ArrowRight, CheckCircle, Star, Menu, X,
  PenLine, BookOpen, ShieldCheck, FlaskConical, GraduationCap,
  FileText, ChevronDown, ChevronUp, Sparkles, Upload, BarChart3,
  Users, Award, Clock, Quote, MapPin, Mail, Twitter, Linkedin,
} from "lucide-react";
import { Logo } from "@/components/Logo";

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
    name: "AI Paper Writer",
    desc: "Full academic papers with verified citations from Semantic Scholar. APA, MLA, Chicago, Harvard, IEEE — streamed to you in real time, never a blank page again.",
    badge: "Most used",
    href: "/auth",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  {
    icon: BookOpen,
    name: "Outline Builder",
    desc: "Structure your argument before writing a single sentence. Upload your assignment brief and get a complete hierarchical outline built for your topic in seconds.",
    badge: null,
    href: "/auth",
    color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  {
    icon: FileText,
    name: "Paper Revision",
    desc: "Paste your draft, upload the rubric, set your target grade. We rewrite what needs rewriting and explain every change so you actually learn from it.",
    badge: "Grade booster",
    href: "/auth",
    color: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  },
  {
    icon: ShieldCheck,
    name: "AI & Plagiarism Check",
    desc: "Detect AI patterns and similarity before your professor does. One click humanizes flagged sections while keeping your argument intact.",
    badge: null,
    href: "/auth",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  {
    icon: FlaskConical,
    name: "STEM Solver",
    desc: "Photograph your problem set. Get full step-by-step solutions with equations, graphs, and linked research papers — Math, Physics, Chemistry, CS, and more.",
    badge: "Photo upload",
    href: "/auth",
    color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  },
  {
    icon: GraduationCap,
    name: "AI Study Assistant",
    desc: "Ask anything, upload lecture notes, quiz yourself with flashcards. It remembers your sessions so you pick up exactly where you left off.",
    badge: null,
    href: "/auth",
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
    text: "The plagiarism checker caught things TurnItIn missed. The humanization actually sounds like me on a good day — not a robot trying to sound human. Big difference from everything else I've tried.",
    stars: 5,
  },
];

const faqs = [
  {
    q: "What is Light Speed Ghost?",
    a: "Light Speed Ghost is an AI-powered academic writing platform built for students. It includes six tools: an AI paper writer with real citations, an outline builder, a paper revision tool, an AI and plagiarism checker with humanization, a STEM step-by-step solver, and an AI study assistant with session memory.",
  },
  {
    q: "Is this actually safe to use? Will my university know?",
    a: "Light Speed Ghost is a writing aid — the same category as Grammarly, tutoring, or study groups. We don't store or share your work with third parties. That said, always review what's generated and make it genuinely yours before submitting. Read our Academic Use Policy for guidance.",
  },
  {
    q: "How is the paper quality? I've tried AI writers before and they're terrible.",
    a: "Fair skepticism. The difference is we pull from Semantic Scholar's academic database for real, verified citations — not fake references with broken URLs. Output goes through subject-specific AI prompting, not a generic 'write me an essay' call. It's a solid draft you can actually work from.",
  },
  {
    q: "Does file upload work with PDFs from my university portal?",
    a: "Yes — PDFs, Word documents, plain text, and images. You can also photograph a physical problem sheet and OCR extracts the text. Most PDFs work cleanly; scanned image-only PDFs may vary.",
  },
  {
    q: "How does Light Speed Ghost compare to ChatGPT for essays?",
    a: "ChatGPT is a general-purpose chatbot. Light Speed Ghost is purpose-built for academic work: real, verifiable citations, specific citation formats, plagiarism checking, grade-targeted revision, and a STEM solver with step-by-step verification — all in one platform with a student-focused interface.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes — and it's genuinely useful, not a bait-and-switch. Free includes 3 paper generations per month (any document type), 5 plagiarism + AI checks, 10 STEM queries per day, 10 study messages per day, 1 revision, and unlimited outline generation. No credit card required.",
  },
  {
    q: "What's the difference between Pro monthly and annual?",
    a: "Same features, different price. Monthly is $14.99/month. Annual is $99/year — that works out to $8.25/month, saving you 45%. Most students buy annual at the start of a semester. You can cancel anytime and keep access until the billing period ends.",
  },
  {
    q: "How does Pay-As-You-Go work?",
    a: "No subscription needed. You pay per job at the time of use. Paper generation is priced by document type — from $1.99 for a short discussion post up to $24.99 for a full dissertation. Plagiarism checks are $0.99 per submission (Scribbr charges $19.95 for the same thing). Credits never expire. If you find yourself using PAYG more than twice a month, Pro becomes the better deal.",
  },
];

const pricingPlans = [
  {
    name: "Free",
    priceMonthly: "$0",
    priceAnnual: "$0",
    perMonthly: "forever",
    perAnnual: "forever",
    desc: "Genuinely useful. No card required. No tricks.",
    features: [
      "3 paper generations / month (any type)",
      "5 plagiarism + AI detection checks / mo",
      "10 STEM solver queries / day",
      "10 study messages / day",
      "1 revision / month",
      "Outline generator (unlimited)",
      "7-day document history",
    ],
    locked: ["Ghost Writer humanizer", "Priority AI processing", "Citation export (BibTeX / RIS)"],
    cta: "Start Free",
    ctaLink: "/auth",
    highlight: false,
    badge: null,
  },
  {
    name: "Pro",
    priceMonthly: "$14.99",
    priceAnnual: "$8.25",
    perMonthly: "/ month",
    perAnnual: "/ month  ·  billed $99 / year",
    desc: "Every cap removed. Every tool unlocked. One flat price.",
    features: [
      "Unlimited paper generation (all types)",
      "Unlimited revisions",
      "Unlimited STEM solver",
      "Unlimited study sessions",
      "Unlimited plagiarism + AI detection",
      "Ghost Writer humanizer (unlimited)",
      "90-day history + BibTeX / RIS / Zotero export",
      "Priority AI processing",
    ],
    locked: [],
    cta: "Get Pro",
    ctaLink: "/auth",
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Campus",
    priceMonthly: null,
    priceAnnual: "$6",
    perMonthly: "",
    perAnnual: "/ user / month  ·  min 5 seats",
    desc: "For study groups, tutoring centers, and institutions. Annual billing only.",
    features: [
      "Everything in Pro",
      "Minimum 5 seats — single invoice",
      "Shared document library",
      "Admin usage dashboard",
      "Academic integrity reporting",
      "Priority support + SLA",
    ],
    locked: [],
    cta: "Contact Us",
    ctaLink: "/contact",
    highlight: false,
    badge: "Annual only",
  },
];

const paygWritingTools = [
  {
    tool: "Paper Writer", color: "blue", Icon: PenLine,
    tiers: [
      { label: "Discussion / Short response", words: "≤ 500 words",          price: "$1.99" },
      { label: "Essay",                        words: "500 – 1,500 words",    price: "$3.99" },
      { label: "Research Paper",               words: "1,500 – 3,500 words",  price: "$7.99" },
      { label: "Proposal / Report",            words: "3,500 – 6,000 words",  price: "$12.99" },
      { label: "Dissertation / Thesis",        words: "6,000 – 15,000 words", price: "$24.99" },
    ],
  },
  {
    tool: "Revision", color: "violet", Icon: FileText,
    tiers: [
      { label: "Discussion",         words: "≤ 500 words",          price: "$0.99" },
      { label: "Essay",              words: "500 – 1,500 words",    price: "$1.99" },
      { label: "Research Paper",     words: "1,500 – 3,500 words",  price: "$3.99" },
      { label: "Proposal / Report",  words: "3,500 – 6,000 words",  price: "$5.99" },
      { label: "Dissertation",       words: "6,000 – 15,000 words", price: "$9.99" },
    ],
  },
  {
    tool: "Ghost Writer (Humanizer)", color: "indigo", Icon: Sparkles,
    tiers: [
      { label: "Discussion",         words: "≤ 500 words",          price: "$0.99" },
      { label: "Essay",              words: "500 – 1,500 words",    price: "$1.99" },
      { label: "Research Paper",     words: "1,500 – 3,500 words",  price: "$3.99" },
      { label: "Proposal / Report",  words: "3,500 – 6,000 words",  price: "$5.99" },
      { label: "Dissertation",       words: "6,000 – 15,000 words", price: "$9.99" },
    ],
  },
];

const paygFlatTools = [
  {
    tool: "STEM Solver", Icon: FlaskConical, color: "cyan",
    price: "$0.99", unit: "per problem",
    note: "Math, Physics, Chemistry, Biology, CS — step-by-step with formulas",
  },
  {
    tool: "Study Assistant", Icon: GraduationCap, color: "amber",
    price: "$1.99", unit: "/ day pass",
    note: "Unlimited Q&A turns for 24 hours. Flashcards, summaries, quiz mode.",
  },
  {
    tool: "Plagiarism + AI Check", Icon: ShieldCheck, color: "emerald",
    price: "$0.99", unit: "per submission",
    note: "Scribbr charges $19.95 for the same check. You pay $0.99.",
    callout: true,
  },
  {
    tool: "Outline Generator", Icon: BookOpen, color: "orange",
    price: "$0.49", unit: "per outline",
    note: "Full hierarchical outline for any document type. APA / MLA ready.",
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
        {open
          ? <ChevronUp size={18} className="text-blue-400 shrink-0" />
          : <ChevronDown size={18} className="text-white/40 group-hover:text-blue-400 shrink-0 transition-colors" />}
      </button>
      {open && <p className="pb-5 text-white/60 leading-relaxed text-sm">{a}</p>}
    </div>
  );
}

const previewNavItems = ["Dashboard", "Write Paper", "Outline", "Revision", "AI & Plagiarism", "STEM Solver", "Study Assistant"];
const previewUrls = ["write", "outline", "revision", "plagiarism", "stem", "study"];

export default function Landing() {
  const scrolled = useScrolled();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [billingAnnual, setBillingAnnual] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setPreviewIdx(i => (i + 1) % 6);
        setFading(false);
      }, 350);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  const navLinks = [
    { label: "Tools", href: "#tools" },
    { label: "How it Works", href: "#howitworks" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased overflow-x-hidden">

      {/* ─── NAV ─── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#04080f]/95 backdrop-blur-md border-b border-white/5 shadow-lg" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          <Link href="/">
            <Logo size={30} textSize="text-base" className="cursor-pointer select-none shrink-0" />
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="px-3.5 py-2 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap"
              >
                {item.label}
              </a>
            ))}
            <Link href="/about">
              <span className="px-3.5 py-2 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap">About</span>
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-2.5">
            <Link href="/auth">
              <span className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors cursor-pointer">Sign In</span>
            </Link>
            <Link href="/auth">
              <span className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors cursor-pointer shadow-md shadow-blue-600/20 whitespace-nowrap">
                Get Started Free
              </span>
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[#04080f]/98 border-t border-white/8 px-4 py-4 space-y-1">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                {item.label}
              </a>
            ))}
            <Link href="/about">
              <span onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                About
              </span>
            </Link>
            <div className="pt-3 flex flex-col gap-2.5 border-t border-white/5 mt-2">
              <Link href="/auth">
                <span className="block text-center px-4 py-2.5 text-sm border border-white/15 text-white rounded-lg cursor-pointer hover:bg-white/5 transition-colors">Sign In</span>
              </Link>
              <Link href="/auth">
                <span className="block text-center px-4 py-2.5 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg cursor-pointer transition-colors">Get Started Free</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-20 pb-12 sm:pt-24 sm:pb-16 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[700px] h-[400px] sm:h-[500px] bg-blue-600/12 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 left-1/3 w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] bg-violet-600/8 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium mb-6 sm:mb-8">
            <Zap size={11} className="text-blue-400" />
            6 AI tools. One platform. Actually works.
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-5 sm:mb-6">
            Your deadline is{" "}
            <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
              tonight.
            </span>
            <br />
            Your notes are chaos.
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-white/55 max-w-2xl mx-auto leading-relaxed mb-8 sm:mb-10">
            Light Speed Ghost handles the writing, revision, plagiarism checking, and STEM problems — so you can stop staring at a blank page and actually sleep.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/auth">
              <span className="inline-flex items-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-xl shadow-blue-600/25 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-100 text-sm sm:text-base">
                Start Free — No Card Needed
                <ArrowRight size={16} />
              </span>
            </Link>
            <a href="#tools" className="inline-flex items-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 border border-white/15 hover:border-white/30 text-white/70 hover:text-white rounded-xl transition-all hover:bg-white/5 text-sm sm:text-base">
              See What It Does
            </a>
          </div>

          <p className="mt-4 text-xs text-white/30">Free forever plan · No credit card · Works in any browser</p>
        </div>

        {/* ── Animated product preview ── */}
        <div className="relative mt-12 sm:mt-20 w-full max-w-5xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#04080f] z-10 pointer-events-none" style={{ top: "65%" }} />

          <div className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-blue-900/20 bg-[#0b1120]">
            {/* Browser chrome — URL updates with tool */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5 bg-[#060d1a]">
              <span className="w-3 h-3 rounded-full bg-red-500/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <span className="w-3 h-3 rounded-full bg-green-500/70" />
              <span
                className="ml-3 text-xs text-white/20 font-mono hidden sm:block transition-opacity duration-300"
                style={{ opacity: fading ? 0 : 1 }}
              >
                lightspeedghost.com/{previewUrls[previewIdx]}
              </span>
            </div>

            <div className="flex" style={{ minHeight: "300px" }}>
              {/* Sidebar — highlights active tool */}
              <div className="w-44 bg-[#060d1a] border-r border-white/5 p-3 shrink-0 hidden sm:block">
                <div className="mb-4 px-2">
                  <Logo size={20} textSize="text-[10px]" />
                </div>
                {previewNavItems.map((label, i) => (
                  <div
                    key={label}
                    className={`px-3 py-2 rounded-lg text-xs mb-0.5 font-medium transition-all duration-300 ${
                      i === previewIdx + 1 ? "bg-blue-600 text-white" : "text-white/30"
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Main content — fades between tools */}
              <div
                className="flex-1 p-4 sm:p-5 transition-opacity duration-300"
                style={{ opacity: fading ? 0 : 1 }}
              >
                {previewIdx === 0 && (
                  /* Write Paper */
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 mb-3">
                      <PenLine size={13} className="text-blue-400" />
                      <span className="text-[11px] font-semibold text-white/80">Write Your Paper</span>
                    </div>
                    <div className="h-8 bg-white/5 rounded-lg border border-white/8 flex items-center px-3 gap-2">
                      <div className="h-2 w-3 bg-white/20 rounded" /><div className="h-1.5 w-40 bg-white/8 rounded" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-8 bg-white/5 rounded-lg border border-white/8 flex items-center px-3">
                        <div className="h-1.5 w-16 bg-white/8 rounded" />
                      </div>
                      <div className="h-8 bg-white/5 rounded-lg border border-white/8 flex items-center px-3">
                        <div className="h-1.5 w-12 bg-white/8 rounded" />
                      </div>
                    </div>
                    <div className="h-14 bg-white/5 rounded-lg border border-white/8" />
                    <div className="h-8 bg-blue-600/40 rounded-lg border border-blue-500/30 flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      <div className="h-2 w-28 bg-blue-400/50 rounded" />
                    </div>
                    <div className="text-[9px] text-white/25 mt-1">APA 7th · 1,500 words · Streaming…</div>
                  </div>
                )}

                {previewIdx === 1 && (
                  /* Outline Builder */
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen size={13} className="text-indigo-400" />
                      <span className="text-[11px] font-semibold text-white/80">Outline Builder</span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { depth: 0, marker: "I.", text: "Introduction & Background" },
                        { depth: 1, marker: "A.", text: "Historical context" },
                        { depth: 1, marker: "B.", text: "Problem statement" },
                        { depth: 0, marker: "II.", text: "Literature Review" },
                        { depth: 1, marker: "A.", text: "Prior studies (2018–2024)" },
                        { depth: 1, marker: "B.", text: "Theoretical framework" },
                        { depth: 0, marker: "III.", text: "Methodology" },
                        { depth: 1, marker: "A.", text: "Data collection" },
                        { depth: 0, marker: "IV.", text: "Conclusion & Implications" },
                      ].map(({ depth, marker, text }, i) => (
                        <div key={i} className={`flex items-center gap-2 ${depth === 1 ? "pl-5" : ""}`}>
                          <span className={`font-mono text-[9px] shrink-0 ${depth === 0 ? "text-indigo-400/70" : "text-white/25"}`}>{marker}</span>
                          <span className={`text-[10px] ${depth === 0 ? "text-white/70 font-medium" : "text-white/40"}`}>{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {previewIdx === 2 && (
                  /* Revision */
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText size={13} className="text-violet-400" />
                        <span className="text-[11px] font-semibold text-white/80">Paper Revision</span>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/20">Target: A</span>
                    </div>
                    <p className="text-[10px] text-white/55 leading-relaxed">
                      The results{" "}
                      <span className="line-through text-red-400/60">shows</span>{" "}
                      <span className="text-emerald-400">demonstrate</span>{" "}
                      a significant correlation between{" "}
                      <span className="bg-emerald-500/15 text-emerald-300 px-0.5 rounded">neural pathway activation and cognitive outcomes</span>
                      {" "}across all three cohorts.{" "}
                      <span className="text-emerald-400">Furthermore, the longitudinal data suggests a causal</span>{" "}
                      <span className="line-through text-red-400/60">link</span>{" "}
                      <span className="text-emerald-400">relationship</span>…
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5 text-[9px] text-emerald-400">
                        <div className="w-2 h-2 rounded bg-emerald-500/30" /> 14 improvements
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-red-400/70">
                        <div className="w-2 h-2 rounded bg-red-500/20" /> 3 removed
                      </div>
                    </div>
                  </div>
                )}

                {previewIdx === 3 && (
                  /* AI & Plagiarism */
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck size={13} className="text-emerald-400" />
                      <span className="text-[11px] font-semibold text-white/80">AI & Plagiarism Check</span>
                      <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">PASS</span>
                    </div>
                    {[
                      { label: "AI Content", pct: 6, color: "bg-emerald-500", txt: "text-emerald-400" },
                      { label: "Plagiarism", pct: 3, color: "bg-emerald-500", txt: "text-emerald-400" },
                      { label: "Similarity",  pct: 11, color: "bg-amber-500",  txt: "text-amber-400" },
                    ].map(({ label, pct, color, txt }) => (
                      <div key={label}>
                        <div className="flex justify-between text-[9px] mb-1">
                          <span className="text-white/40">{label}</span>
                          <span className={`font-mono font-semibold ${txt}`}>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct * 4}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="mt-2 text-[9px] text-white/30 flex items-center gap-1.5">
                      <CheckCircle size={10} className="text-emerald-400" />
                      Safe to submit — humanization not required
                    </div>
                  </div>
                )}

                {previewIdx === 4 && (
                  /* STEM Solver */
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 mb-3">
                      <FlaskConical size={13} className="text-cyan-400" />
                      <span className="text-[11px] font-semibold text-white/80">STEM Solver</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {["Math", "Physics", "Chemistry", "Biology", "CS"].map((s, i) => (
                        <span key={s} className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${i === 1 ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" : "bg-white/5 text-white/30 border-white/8"}`}>{s}</span>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {["Identify all forces acting on the body", "Apply Newton's 2nd law: F = ma", "Solve for acceleration: a = 4 m/s²"].map((step, i) => (
                        <div key={step} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-cyan-600/25 border border-cyan-500/25 text-cyan-300 text-[8px] flex items-center justify-center shrink-0">{i + 1}</div>
                          <span className="text-[10px] text-white/50">{step}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-2 bg-cyan-600/5 border border-cyan-500/15 rounded-lg text-[10px] text-cyan-300 font-mono mt-1">
                      F = ma → a = 12/3 = <span className="text-cyan-200 font-bold">4 m/s²</span>
                    </div>
                  </div>
                )}

                {previewIdx === 5 && (
                  /* Study Assistant */
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <GraduationCap size={13} className="text-amber-400" />
                      <span className="text-[11px] font-semibold text-white/80">AI Study Assistant</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-end">
                        <div className="bg-blue-600/30 border border-blue-500/20 rounded-xl rounded-tr-sm px-3 py-1.5 text-[10px] text-white/70 max-w-[78%]">
                          Explain the Krebs cycle simply
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Zap size={9} className="text-amber-400" />
                        </div>
                        <div className="bg-white/5 border border-white/8 rounded-xl rounded-tl-sm px-3 py-1.5 text-[10px] text-white/55 leading-relaxed">
                          The Krebs cycle runs in the mitochondria, breaking down acetyl-CoA to produce ATP, NADH, and CO₂ across 8 enzymatic steps…
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {["Quiz me", "Simplify more", "Key takeaways"].map(s => (
                        <span key={s} className="text-[8px] px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-white/35 cursor-pointer">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mt-5 relative z-20">
            {Array.from({ length: 6 }).map((_, i) => (
              <button
                key={i}
                onClick={() => { setFading(true); setTimeout(() => { setPreviewIdx(i); setFading(false); }, 200); }}
                className={`rounded-full transition-all duration-300 ${
                  i === previewIdx
                    ? "w-6 h-1.5 bg-blue-400"
                    : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="border-y border-white/5 bg-white/[0.02] py-8 sm:py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
          {[
            { value: "52,000+", label: "Papers generated" },
            { value: "3.5 hrs", label: "Average time saved per essay" },
            { value: "94%", label: "Users who passed their deadline" },
            { value: "200+", label: "Universities represented" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{value}</div>
              <div className="text-xs sm:text-sm text-white/40">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── TOOLS ─── */}
      <section id="tools" className="py-14 sm:py-20 md:py-28 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-10 sm:mb-16">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-3 sm:mb-4">What it does</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4 sm:mb-5">
              Six tools.<br />One subscription.
            </h2>
            <p className="text-white/50 text-base sm:text-lg">
              Each tool is built for a specific academic pain point. They work independently or in sequence — run your paper through the writer, then straight into the plagiarism checker.
            </p>
          </div>

          <div id="features" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {tools.map(({ icon: Icon, name, desc, badge, color, href }) => (
              <Link href={href} key={name}>
                <div className="group relative p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-white/15 hover:bg-white/[0.05] transition-all cursor-pointer h-full">
                  {badge && (
                    <span className={`absolute top-4 right-4 sm:top-5 sm:right-5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
                      {badge}
                    </span>
                  )}
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-4 border ${color}`}>
                    <Icon size={18} />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{name}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="howitworks" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-3 sm:mb-4">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold">From brief to submission in three steps</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 sm:gap-10">
            {[
              {
                num: "01",
                title: "Upload or describe your task",
                body: "Drag in your assignment PDF, paste the brief, or describe what you need. The platform reads the rubric and figures out the rest — citation style, length, subject.",
                icon: Upload,
              },
              {
                num: "02",
                title: "Generate, revise, or check",
                body: "Pick your tool. Full paper, outline, revision, plagiarism scan, STEM solution — or all in sequence. Each output feeds cleanly into the next.",
                icon: Sparkles,
              },
              {
                num: "03",
                title: "Review, edit, and submit",
                body: "Everything generated is a starting point, not a finish line. Read it, adjust your voice, and submit something you can genuinely stand behind.",
                icon: CheckCircle,
              },
            ].map(({ num, title, body, icon: Icon }) => (
              <div key={num} className="relative">
                <div className="text-5xl sm:text-6xl font-bold text-white/5 leading-none mb-4 select-none">{num}</div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <Icon size={18} className="text-blue-400" />
                </div>
                <h3 className="font-semibold text-white mb-3 text-base sm:text-lg">{title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURE DEEP DIVE ─── */}
      <section className="py-14 sm:py-20 md:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-16 sm:space-y-24 md:space-y-32">

          {/* Feature 1: Paper Writer */}
          <div className="grid md:grid-cols-2 gap-10 sm:gap-16 items-center">
            <div>
              <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-4 sm:mb-5">Paper Writer</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-5 leading-tight">A draft you can actually submit. Not cringe at.</h2>
              <p className="text-white/55 leading-relaxed mb-6 sm:mb-8 text-sm sm:text-base">
                Type your topic, pick your citation style, choose your length. We pull real academic sources from Semantic Scholar and weave them into the argument — not fake references with broken URLs.
              </p>
              <ul className="space-y-3">
                {["Real citations with working DOI links", "APA, MLA, Chicago, Harvard, IEEE", "STEM mode for equations and technical content", "500 to 2,500+ words on demand"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <CheckCircle size={14} className="text-blue-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-5 sm:p-6 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-white/30 uppercase tracking-widest font-medium">Generated output</div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Writing…
                </div>
              </div>

              {/* Paper title */}
              <p className="text-[11px] font-semibold text-white/90 leading-snug mb-3">
                The Role of Neuroplasticity in Cognitive Recovery Following Traumatic Brain Injury
              </p>

              {/* Abstract label */}
              <p className="text-[9px] text-blue-400 uppercase tracking-widest mb-1.5 font-semibold">Abstract</p>
              <p className="text-[10px] text-white/50 leading-relaxed mb-4">
                Traumatic brain injury (TBI) represents a leading cause of disability worldwide, affecting millions annually{" "}
                <span className="text-blue-300/70">(Maas et al., 2022)</span>. Recent advances in neuroimaging have demonstrated
                that targeted rehabilitation can stimulate cortical reorganisation, challenging prior assumptions about recovery ceilings{" "}
                <span className="text-blue-300/70">(Chen & Park, 2023)</span>.
              </p>

              {/* References preview */}
              <div className="border-t border-white/5 pt-3 space-y-1.5">
                <p className="text-[9px] text-white/30 uppercase tracking-widest font-medium mb-2">References</p>
                <p className="text-[10px] text-white/40 leading-relaxed">
                  Maas, A. I. R., et al. (2022). Traumatic brain injury: integrated approaches.{" "}
                  <span className="italic">Nature Reviews Neurology, 18</span>(4), 207–224.{" "}
                  <span className="text-blue-400/60 text-[9px]">doi:10.1038/s41582-021-00568-6 ↗</span>
                </p>
                <p className="text-[10px] text-white/40 leading-relaxed">
                  Chen, H., &amp; Park, J. (2023). Cortical plasticity post-TBI.{" "}
                  <span className="italic">Brain, 146</span>(2), 489–503.{" "}
                  <span className="text-blue-400/60 text-[9px]">doi:10.1093/brain/awac391 ↗</span>
                </p>
              </div>

              <div className="mt-4 text-xs text-white/25 flex items-center gap-2 border-t border-white/5 pt-3">
                <BarChart3 size={11} />
                1,247 words · 6 citations · APA 7th edition
              </div>
            </div>
          </div>

          {/* Feature 2: STEM Solver */}
          <div className="grid md:grid-cols-2 gap-10 sm:gap-16 items-center">
            <div className="order-2 md:order-1 rounded-2xl border border-white/10 bg-[#0b1120] p-5 sm:p-6 shadow-xl">
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
              <p className="text-cyan-400 text-xs font-semibold uppercase tracking-widest mb-4 sm:mb-5">STEM Solver</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-5 leading-tight">Photograph the problem. Get the full method.</h2>
              <p className="text-white/55 leading-relaxed mb-6 sm:mb-8 text-sm sm:text-base">
                Point your phone at a problem set and upload the image. OCR extracts the text, we identify the subject, and you get a full worked solution with step-by-step reasoning — not just the answer.
              </p>
              <ul className="space-y-3">
                {["Photo upload with browser OCR", "Math, Physics, Chemistry, Biology, CS, Engineering", "KaTeX equation rendering", "Linked research papers per topic"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <CheckCircle size={14} className="text-cyan-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-3 sm:mb-4">Real students</p>
            <h2 className="text-3xl sm:text-4xl font-bold">It's not perfect. But it gets the job done.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
            {testimonials.map(({ name, role, text, stars }) => (
              <div key={name} className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/8">
                <Quote size={18} className="text-blue-500/40 mb-4" />
                <p className="text-white/70 text-sm leading-relaxed mb-5">{text}</p>
                <div className="flex items-center gap-0.5 mb-3">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
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
      <section id="pricing" className="py-14 sm:py-20 md:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">

          {/* Header + toggle */}
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-3 sm:mb-4">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4">Honest pricing. No dark patterns.</h2>
            <p className="text-white/45 text-sm sm:text-base max-w-xl mx-auto">
              Free for casual use. Pro for weekly deadlines. Pay-as-you-go when you just need one thing done.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6 sm:mt-8">
              <span className={`text-sm font-medium transition-colors ${!billingAnnual ? "text-white" : "text-white/35"}`}>Monthly</span>
              <button
                onClick={() => setBillingAnnual(b => !b)}
                className={`relative w-11 h-6 rounded-full transition-colors ${billingAnnual ? "bg-blue-600" : "bg-white/15"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${billingAnnual ? "left-6" : "left-1"}`} />
              </button>
              <span className={`text-sm font-medium transition-colors ${billingAnnual ? "text-white" : "text-white/35"}`}>Annual</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-semibold">Save 45%</span>
            </div>
          </div>

          {/* ── Subscription plan cards ── */}
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 mb-16 sm:mb-24">
            {pricingPlans.map(({ name, priceMonthly, priceAnnual, perMonthly, perAnnual, desc, features, locked, cta, ctaLink, highlight, badge }) => {
              const showAnnual = billingAnnual || priceMonthly === null;
              const price = showAnnual ? priceAnnual : priceMonthly;
              const per   = showAnnual ? perAnnual   : perMonthly;
              const isCampus = name === "Campus";
              return (
                <div key={name} className={`relative p-6 sm:p-7 rounded-2xl border flex flex-col ${highlight ? "bg-blue-600/10 border-blue-500/40 shadow-xl shadow-blue-900/20" : "bg-white/[0.02] border-white/8"}`}>
                  {badge && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${highlight ? "bg-blue-600 text-white" : "bg-white/10 text-white/55 border border-white/15"}`}>
                      {badge}
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="font-semibold text-white mb-2">{name}</h3>
                    <div className="flex items-end gap-1.5">
                      <span className="text-3xl sm:text-4xl font-bold text-white">{price}</span>
                    </div>
                    <p className="text-white/30 text-[11px] mt-1 leading-relaxed">{per}</p>
                    <p className="text-white/50 text-xs mt-3 leading-relaxed">{desc}</p>
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {features.map(feat => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm text-white/65">
                        <CheckCircle size={13} className={`shrink-0 mt-0.5 ${highlight ? "text-blue-400" : "text-emerald-400/70"}`} />
                        {feat}
                      </li>
                    ))}
                    {locked.map(feat => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm text-white/22 line-through decoration-white/15">
                        <div className="w-3 h-3 rounded-full border border-white/12 shrink-0 mt-0.5" />
                        {feat}
                      </li>
                    ))}
                  </ul>

                  {isCampus && !billingAnnual && (
                    <p className="text-[10px] text-white/30 italic mb-3">Campus plan requires annual billing. Toggle above.</p>
                  )}

                  {name === "Pro" ? (
                    <button
                      onClick={() => setCheckoutPlan(billingAnnual ? "pro_annual" : "pro_monthly")}
                      className={`w-full block text-center py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${highlight ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20" : "border border-white/15 hover:border-white/30 text-white/80 hover:text-white hover:bg-white/5"}`}
                    >
                      {cta}
                    </button>
                  ) : name === "Campus" ? (
                    <button
                      onClick={() => billingAnnual ? setCheckoutPlan("campus_annual") : setBillingAnnual(true)}
                      className={`w-full block text-center py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer border border-white/15 hover:border-white/30 text-white/80 hover:text-white hover:bg-white/5`}
                    >
                      {billingAnnual ? "Get Campus" : "Switch to Annual"}
                    </button>
                  ) : (
                    <Link href={ctaLink}>
                      <span className={`block text-center py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${highlight ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20" : "border border-white/15 hover:border-white/30 text-white/80 hover:text-white hover:bg-white/5"}`}>
                        {cta}
                      </span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Pay-As-You-Go ── */}
          <div>
            <div className="text-center mb-8 sm:mb-12">
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">Pay-As-You-Go</h3>
              <p className="text-white/40 text-sm max-w-lg mx-auto">
                No subscription. No expiry. Pay for exactly what you need — one paper, one check, one session.
              </p>
            </div>

            {/* Writing tools — tiered by document type */}
            <div className="grid md:grid-cols-3 gap-4 sm:gap-5 mb-4 sm:mb-5">
              {paygWritingTools.map(({ tool, color, Icon, tiers }) => {
                const iconCls: Record<string,string> = { blue: "text-blue-400", violet: "text-violet-400", indigo: "text-indigo-400" };
                const divCls: Record<string,string>  = { blue: "border-blue-500/15", violet: "border-violet-500/15", indigo: "border-indigo-500/15" };
                return (
                  <div key={tool} className={`bg-white/[0.02] border rounded-2xl p-5 sm:p-6 ${divCls[color] ?? "border-white/8"}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <Icon size={14} className={iconCls[color]} />
                      <span className="text-sm font-semibold text-white">{tool}</span>
                    </div>
                    <div className="space-y-2.5">
                      {tiers.map(({ label, words, price }) => (
                        <div key={label} className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] text-white/60 font-medium leading-tight">{label}</p>
                            <p className="text-[10px] text-white/28">{words}</p>
                          </div>
                          <span className={`text-sm font-bold shrink-0 ${iconCls[color]}`}>{price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Flat-rate tools */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
              {paygFlatTools.map(({ tool, Icon, color, price, unit, note, callout }) => {
                const iconCls: Record<string,string> = { cyan: "text-cyan-400", amber: "text-amber-400", emerald: "text-emerald-400", orange: "text-orange-400" };
                const borderCls = callout ? "border-emerald-500/25 bg-emerald-900/5" : "border-white/8 bg-white/[0.02]";
                return (
                  <div key={tool} className={`border rounded-2xl p-4 sm:p-5 ${borderCls}`}>
                    <Icon size={16} className={`${iconCls[color]} mb-3`} />
                    <p className="text-xs font-semibold text-white mb-1.5">{tool}</p>
                    <div className="flex items-end gap-1 mb-2">
                      <span className={`text-xl font-bold ${iconCls[color]}`}>{price}</span>
                      <span className="text-white/30 text-[10px] mb-0.5">{unit}</span>
                    </div>
                    <p className="text-[10px] text-white/35 leading-relaxed">{note}</p>
                    {callout && (
                      <div className="mt-2.5 text-[9px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 font-semibold text-center">
                        Scribbr charges $19.95 for the same check
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-center text-white/20 text-xs mt-6 sm:mt-8">
              PAYG charges never expire · Billed at time of use · No subscription required
            </p>
          </div>

        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 sm:mb-14">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-3 sm:mb-4">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Questions we actually get asked</h2>
          </div>
          <div>
            {faqs.map(faq => <FAQItem key={faq.q} {...faq} />)}
          </div>
          <div className="mt-10 text-center">
            <p className="text-white/40 text-sm">Still have questions? <a href="mailto:info@lightspeedghost.com" className="text-blue-400 hover:text-blue-300">Email us</a> or <Link href="/contact"><span className="text-blue-400 hover:text-blue-300 cursor-pointer">visit our contact page</span></Link>.</p>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-16 sm:py-24 md:py-28 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[300px] sm:h-[400px] bg-blue-600/10 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-6 sm:mb-8">
            <Logo size={48} showText={false} />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-5 leading-tight">
            Stop staring at midnight.<br />Start with a draft.
          </h2>
          <p className="text-white/50 mb-8 sm:mb-10 text-base sm:text-lg">
            Free forever. Six tools. No card required to start.
          </p>
          <Link href="/auth">
            <span className="inline-flex items-center gap-2 px-7 sm:px-8 py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-xl shadow-blue-600/25 hover:scale-[1.02] active:scale-100 text-base sm:text-lg">
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
      <footer className="border-t border-white/5 py-12 sm:py-14 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 sm:gap-10 mb-10 sm:mb-12">

            <div className="col-span-2">
              <Logo size={30} className="mb-4" />
              <p className="text-white/35 text-sm leading-relaxed max-w-xs mb-4">
                Academic writing tools for students who have deadlines and standards.
              </p>
              <div className="space-y-2 text-xs text-white/30">
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="shrink-0 mt-0.5 text-white/20" />
                  <span>500 Oracle Pkwy, Redwood City, CA 94065</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={12} className="shrink-0 text-white/20" />
                  <a href="mailto:info@lightspeedghost.com" className="hover:text-white/60 transition-colors">info@lightspeedghost.com</a>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <a href="https://twitter.com/lightspeedghost" target="_blank" rel="noreferrer"
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/70 transition-all">
                  <Twitter size={13} />
                </a>
                <a href="https://linkedin.com/company/lightspeedghost" target="_blank" rel="noreferrer"
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/70 transition-all">
                  <Linkedin size={13} />
                </a>
              </div>
            </div>

            {/* Product links */}
            <div>
              <h4 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Paper Writer", href: "/auth" },
                  { label: "Outline Builder", href: "/auth" },
                  { label: "Revision", href: "/auth" },
                  { label: "AI & Plagiarism", href: "/auth" },
                  { label: "STEM Solver", href: "/auth" },
                  { label: "Study Assistant", href: "/auth" },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href}>
                      <span className="text-white/35 hover:text-white/65 text-sm transition-colors cursor-pointer">{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company links */}
            <div>
              <h4 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-4">Company</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "About", href: "/about" },
                  { label: "Blog", href: "/blog" },
                  { label: "Careers", href: "/careers" },
                  { label: "Contact", href: "/contact" },
                  { label: "Pricing", href: "#pricing" },
                ].map(({ label, href }) => (
                  <li key={label}>
                    {href.startsWith("#") ? (
                      <a href={href} className="text-white/35 hover:text-white/65 text-sm transition-colors">{label}</a>
                    ) : (
                      <Link href={href}>
                        <span className="text-white/35 hover:text-white/65 text-sm transition-colors cursor-pointer">{label}</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal links */}
            <div>
              <h4 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Cookie Policy", href: "/cookies" },
                  { label: "Academic Use", href: "/academic-use" },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href}>
                      <span className="text-white/35 hover:text-white/65 text-sm transition-colors cursor-pointer">{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-6 sm:pt-7 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
            <p className="text-white/20 text-xs text-center sm:text-right">Built for students who have too much to do and too little time.</p>
          </div>
        </div>
      </footer>

      {checkoutPlan && (
        <CheckoutModal
          open={!!checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          mode="subscription"
          plan={checkoutPlan}
          onSuccess={() => { setCheckoutPlan(null); setLocation("/app"); }}
        />
      )}
    </div>
  );
}
