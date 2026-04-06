import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import { useAuth } from "@/contexts/AuthContext";
import type { PlanId, PaygTool, DocumentTier } from "@/lib/pricing";
import {
  Zap, ArrowRight, CheckCircle, Star, Menu, X,
  PenLine, BookOpen, ShieldCheck, FlaskConical, GraduationCap,
  FileText, ChevronDown, ChevronUp, Sparkles, Upload, BarChart3,
  Users, Award, Clock, Quote, MapPin, Mail, Twitter, Linkedin, Wand2,
  Lock, Building2,
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
    desc: "Papers grounded in 50,000+ peer-reviewed databases. Upload your rubric and we target the A-grade criteria only. Plagiarism checked below 8% before delivery. Real DOI citations, no Wikipedia.",
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
    desc: "Ask anything, upload lecture notes, quiz yourself with flashcards. LightSpeed AI builds a personal memory of everything you've studied — so it recalls your past struggles, past topics, and past sessions to tutor you better every single time.",
    badge: "Long-term memory",
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
    a: "Light Speed Ghost is an AI-powered academic writing platform built for students. It includes seven tools: an AI paper writer with real citations, an outline builder, a paper revision tool, LightSpeed Humanizer for bypassing AI detectors, an AI and plagiarism checker, a STEM step-by-step solver, and an AI study assistant with session memory.",
  },
  {
    q: "Is this actually safe to use? Will my university know?",
    a: "Light Speed Ghost is a writing aid — the same category as Grammarly, tutoring, or study groups. We don't store or share your work with third parties. That said, always review what's generated and make it genuinely yours before submitting. Read our Academic Use Policy for guidance.",
  },
  {
    q: "How is the paper quality? I've tried AI writers before and they're terrible.",
    a: "Fair skepticism. Here is exactly what happens on every paper: (1) We search 50,000+ peer-reviewed databases for real abstracts — not fake citations with broken URLs. (2) If you upload a grading rubric, we extract only the A-grade / Distinction criteria and lock them as requirements before writing starts. (3) After the paper is written, we cross-check it against those criteria and run a targeted improvement pass if any gaps are found. (4) A plagiarism gate measures cosine similarity and rephrases any section above 8% before we send it to you. (5) The humanizer runs a real detect → rewrite → re-detect loop until the AI score is below 5%. That is the pipeline on every single output.",
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
    a: "The entry plan is Starter at $1.50/month — lower than a cup of coffee and still the cheapest academic writing platform you'll find. It includes 3 paper generations per month, 5 outline generations, 5 plagiarism + AI checks, 10 STEM queries per day, 10 study messages per day, and 1 revision. No tricks, just a minimal charge to keep the lights on.",
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
    name: "Starter",
    priceMonthly: "$1.50",
    priceAnnual: "$1.50",
    perMonthly: "/ month",
    perAnnual: "/ month",
    desc: "All core tools. Low commitment. No hidden gotchas.",
    features: [
      "3 paper generations / month (any type)",
      "5 plagiarism + AI detection checks / mo",
      "10 STEM solver queries / day",
      "10 study messages / day",
      "1 revision / month",
      "5 outline generations / month",
      "7-day document history",
    ],
    locked: ["LightSpeed Humanizer", "Priority AI processing", "Citation export (BibTeX / RIS)"],
    cta: "Start for $1.50",
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
    desc: "Every cap lifted. Every tool unlocked. One flat price.",
    features: [
      "50 papers / month (all types)",
      "50 revisions / month",
      "30 STEM solver problems / day",
      "Unlimited study sessions",
      "Unlimited plagiarism + AI detection",
      "LightSpeed Humanizer — 50 jobs / month",
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
    perAnnual: "/ seat / month  ·  min 5 seats  ·  annual",
    desc: "For study groups, tutoring centers, and institutions. Annual billing only.",
    features: [
      "Pro features, per seat",
      "15 papers / seat / month",
      "30 STEM problems / seat / day",
      "Minimum 5 seats — single invoice",
      "Shared document library + admin dashboard",
      "Academic integrity reporting + SLA support",
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
    tool: "Paper Writer", toolId: "paper" as PaygTool, color: "blue", Icon: PenLine,
    tiers: [
      { label: "Discussion / Short response", words: "≤ 500 words",          price: "$1.99", tier: "discussion" as DocumentTier },
      { label: "Essay",                        words: "500 – 1,500 words",    price: "$3.99", tier: "essay" as DocumentTier },
      { label: "Research Paper",               words: "1,500 – 3,500 words",  price: "$7.99", tier: "research" as DocumentTier },
      { label: "Proposal / Report",            words: "3,500 – 6,000 words",  price: "$12.99", tier: "proposal" as DocumentTier },
      { label: "Dissertation / Thesis",        words: "6,000 – 15,000 words", price: "$24.99", tier: "dissertation" as DocumentTier },
    ],
  },
  {
    tool: "Revision", toolId: "revision" as PaygTool, color: "violet", Icon: FileText,
    tiers: [
      { label: "Discussion",         words: "≤ 500 words",          price: "$0.99",  tier: "discussion" as DocumentTier },
      { label: "Essay",              words: "500 – 1,500 words",    price: "$1.99",  tier: "essay" as DocumentTier },
      { label: "Research Paper",     words: "1,500 – 3,500 words",  price: "$3.99",  tier: "research" as DocumentTier },
      { label: "Proposal / Report",  words: "3,500 – 6,000 words",  price: "$5.99",  tier: "proposal" as DocumentTier },
      { label: "Dissertation",       words: "6,000 – 15,000 words", price: "$9.99",  tier: "dissertation" as DocumentTier },
    ],
  },
  {
    tool: "LightSpeed Humanizer", toolId: "humanizer" as PaygTool, color: "indigo", Icon: Sparkles,
    tiers: [
      { label: "Discussion",         words: "≤ 500 words",          price: "$0.99",  tier: "discussion" as DocumentTier },
      { label: "Essay",              words: "500 – 1,500 words",    price: "$1.99",  tier: "essay" as DocumentTier },
      { label: "Research Paper",     words: "1,500 – 3,500 words",  price: "$3.99",  tier: "research" as DocumentTier },
      { label: "Proposal / Report",  words: "3,500 – 6,000 words",  price: "$5.99",  tier: "proposal" as DocumentTier },
      { label: "Dissertation",       words: "6,000 – 15,000 words", price: "$9.99",  tier: "dissertation" as DocumentTier },
    ],
  },
];

const paygFlatTools = [
  {
    tool: "STEM Solver", toolId: "stem" as PaygTool, Icon: FlaskConical, color: "cyan",
    price: "$0.99", unit: "per problem",
    note: "Math, Physics, Chemistry, Biology, CS — step-by-step with formulas",
  },
  {
    tool: "Study Assistant", toolId: "study" as PaygTool, Icon: GraduationCap, color: "amber",
    price: "$1.99", unit: "/ day pass",
    note: "Unlimited Q&A turns for 24 hours. Flashcards, summaries, quiz mode.",
  },
  {
    tool: "Plagiarism + AI Check", toolId: "plagiarism" as PaygTool, Icon: ShieldCheck, color: "emerald",
    price: "$0.99", unit: "per submission",
    note: "Similarity detection across 99B+ academic sources. Includes AI-generated content scoring.",
  },
  {
    tool: "Outline Generator", toolId: "outline" as PaygTool, Icon: BookOpen, color: "orange",
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

const previewNavItems = ["Dashboard", "Write Paper", "Outline", "Revision", "Humanizer", "AI & Plagiarism", "STEM Solver", "Study Assistant"];
const previewUrls = ["write", "outline", "revision", "humanizer", "plagiarism", "stem", "study"];

export default function Landing() {
  const scrolled = useScrolled();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [billingAnnual, setBillingAnnual] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);
  const [paygCheckout, setPaygCheckout] = useState<{ tool: PaygTool; tier?: DocumentTier } | null>(null);
  const [, setLocation] = useLocation();

  function handleBuyPayg(tool: PaygTool, tier?: DocumentTier) {
    if (!user) { setLocation("/auth"); return; }
    setPaygCheckout({ tool, tier });
  }

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setPreviewIdx(i => (i + 1) % 7);
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
                Get Started
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
                <span className="block text-center px-4 py-2.5 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg cursor-pointer transition-colors">Get Started</span>
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
            7 AI tools. One platform. Actually works.
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
                Try for $1.50 / month
                <ArrowRight size={16} />
              </span>
            </Link>
            <a href="#payg" className="inline-flex items-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 border border-orange-500/30 hover:border-orange-400/50 text-orange-400/80 hover:text-orange-300 rounded-xl transition-all hover:bg-orange-500/8 text-sm sm:text-base">
              <Zap size={15} className="text-orange-400" />
              No subscription — pay once
            </a>
          </div>

          <p className="mt-4 text-xs text-white/30">Starter at $1.50/mo · Or pay per use · No expiry on PAYG charges</p>
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
                  /* LightSpeed Humanizer */
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 mb-3">
                      <Wand2 size={13} className="text-purple-400" />
                      <span className="text-[11px] font-semibold text-white/80">LightSpeed Humanizer</span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-white/40">AI score before</span>
                      <span className="text-[9px] font-mono font-bold text-red-400">73%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: "73%" }} />
                    </div>
                    <div className="p-2 bg-purple-600/10 border border-purple-500/15 rounded-lg text-[9px] text-purple-300/70 leading-relaxed italic">
                      "The findings demonstrate…" →{" "}
                      <span className="text-emerald-300 not-italic font-medium">"What emerges from this data is…"</span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-white/40">AI score after</span>
                      <span className="text-[9px] font-mono font-bold text-emerald-400">8%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: "8%" }} />
                    </div>
                    <div className="mt-1.5 text-[9px] text-white/30 flex items-center gap-1.5">
                      <CheckCircle size={10} className="text-emerald-400" />
                      Passes Turnitin · GPTZero · Originality.ai
                    </div>
                  </div>
                )}

                {previewIdx === 4 && (
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

                {previewIdx === 5 && (
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

                {previewIdx === 6 && (
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
            {Array.from({ length: 7 }).map((_, i) => (
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

      {/* ─── QUALITY COMMITMENT STRIP ─── */}
      <section className="border-y border-white/5 bg-white/[0.02] py-8 sm:py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-center text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-6 sm:mb-8">Quality guarantees — enforced on every output</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                value: "92%+",
                label: "Grade accuracy target",
                sub: "A-grade rubric cross-check on every paper",
                color: "text-blue-400",
                border: "border-blue-500/20 bg-blue-500/5",
              },
              {
                value: "< 8%",
                label: "Plagiarism ceiling",
                sub: "Cosine similarity gate — enforced before delivery",
                color: "text-emerald-400",
                border: "border-emerald-500/20 bg-emerald-500/5",
              },
              {
                value: "< 5%",
                label: "AI detection score",
                sub: "Multi-pass humanization loop — real detector, not self-reported",
                color: "text-violet-400",
                border: "border-violet-500/20 bg-violet-500/5",
              },
              {
                value: "50,000+",
                label: "Academic databases",
                sub: "OpenAlex · CrossRef · Semantic Scholar · arXiv · Europe PMC",
                color: "text-amber-400",
                border: "border-amber-500/20 bg-amber-500/5",
              },
            ].map(({ value, label, sub, color, border }) => (
              <div key={label} className={`rounded-xl border p-4 sm:p-5 text-center ${border}`}>
                <div className={`text-2xl sm:text-3xl font-bold mb-1 ${color}`}>{value}</div>
                <div className="text-xs sm:text-sm font-semibold text-white mb-1.5">{label}</div>
                <div className="text-[10px] sm:text-[11px] text-white/35 leading-relaxed">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TOOLS ─── */}
      <section id="tools" className="py-14 sm:py-20 md:py-28 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-10 sm:mb-16">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-3 sm:mb-4">What it does</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4 sm:mb-5">
              Seven tools.<br />One subscription.
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

      {/* ─── AI CAPABILITIES ─── */}
      <section className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 border-y border-white/5 bg-gradient-to-b from-[#04080f] to-[#060d1a]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-3 sm:mb-4">Under the hood</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">LightSpeed AI Capabilities</h2>
            <p className="text-white/45 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              Every tool on this platform is powered by a set of purpose-built AI capabilities — not a generic chatbot wrapper. Here's what makes the difference.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {[
              {
                icon: "🧠",
                title: "Persistent Student Memory",
                desc: "Every study session you have is silently indexed into your personal AI memory. Next time you ask a question, the AI already knows what topics you've covered, where you've struggled, and how you like to learn — across every session, forever.",
                color: "border-amber-500/20 bg-amber-500/5",
                tag: "Study Assistant",
              },
              {
                icon: "🔍",
                title: "Semantic Recall",
                desc: "LightSpeed AI doesn't search your history by keyword — it understands meaning. Ask about 'Newton's laws' and it surfaces relevant past context even if you originally asked about 'force and acceleration.' Recall that actually makes sense.",
                color: "border-blue-500/20 bg-blue-500/5",
                tag: "Study Assistant",
              },
              {
                icon: "📚",
                title: "50,000+ Database Knowledge Base",
                desc: "Every paper searches OpenAlex (250M+ papers), CrossRef (145M+ DOIs), Semantic Scholar, arXiv, and Europe PMC in parallel. Real abstracts are fed as grounding context — so the AI answers from verified peer-reviewed content, not guesswork. No Wikipedia.",
                color: "border-violet-500/20 bg-violet-500/5",
                tag: "Paper Writer · Study Assistant",
              },
              {
                icon: "⚗️",
                title: "Multi-Step STEM Reasoning",
                desc: "STEM problems run through a structured reasoning loop: the AI thinks, acts, observes, and reflects before giving you an answer. A second critic layer then checks for math and logic errors — so you don't get confidently wrong results.",
                color: "border-cyan-500/20 bg-cyan-500/5",
                tag: "STEM Solver",
              },
              {
                icon: "🔬",
                title: "Chemistry & Molecule Intelligence",
                desc: "Chemistry problems unlock molecule lookup — SMILES notation, CAS registry numbers, molecular weight, LogP, H-bond data, and GHS safety classifications. Backed by PubChem's database of 100M+ compounds.",
                color: "border-emerald-500/20 bg-emerald-500/5",
                tag: "STEM Solver · Chemistry",
              },
              {
                icon: "🛡️",
                title: "Structural Code Plagiarism Detection",
                desc: "Code similarity detection uses a fingerprinting algorithm — the same approach used by Stanford's MOSS system. It catches plagiarism even when variable names are changed, code is reformatted, or logic is reshuffled.",
                color: "border-rose-500/20 bg-rose-500/5",
                tag: "AI & Plagiarism Checker",
              },
              {
                icon: "✍️",
                title: "AI Humanization Engine",
                desc: "The humanizer runs a real detect → rewrite → re-detect loop using an actual AI detection model between each pass — not self-reporting. Up to three passes until the score drops below 5%. Each pass targets the specific patterns the detector flagged.",
                color: "border-indigo-500/20 bg-indigo-500/5",
                tag: "LightSpeed Humanizer",
              },
              {
                icon: "🌍",
                title: "Smart Payment Routing",
                desc: "Payments are routed to the right gateway based on your location — card processors for international users, mobile money (M-Pesa, MTN MoMo, Airtel Money) for East and West Africa. One checkout, every country.",
                color: "border-green-500/20 bg-green-500/5",
                tag: "Payments",
              },
              {
                icon: "🎯",
                title: "Adaptive Tutoring Modes",
                desc: "The Study Assistant has four distinct modes: Tutor (guided, Socratic), Explain (fast, example-driven), Quiz (test-and-reveal), and Summarize (structured key points). Switch mid-session — the AI tracks context across every mode change.",
                color: "border-orange-500/20 bg-orange-500/5",
                tag: "Study Assistant",
              },
            ].map(({ icon, title, desc, color, tag }) => (
              <div key={title} className={`p-5 sm:p-6 rounded-2xl border ${color} hover:bg-white/[0.04] transition-all`}>
                <div className="text-2xl mb-3">{icon}</div>
                <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">{tag}</div>
                <h3 className="font-semibold text-white text-sm mb-2">{title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="howitworks" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-3 sm:mb-4">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Two ways to get started</h2>
            <p className="text-white/40 text-sm mt-3 max-w-xl mx-auto">Subscribe for ongoing use, or pay once for exactly what you need right now. No lock-in either way.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 sm:gap-12">
            {/* Path A — Subscribe */}
            <div className="rounded-2xl border border-blue-500/15 bg-blue-900/5 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                  <Sparkles size={15} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Subscribe</p>
                  <p className="text-blue-400/70 text-[11px]">From $1.50 / month</p>
                </div>
              </div>
              <div className="space-y-6">
                {[
                  { num: "01", title: "Sign up — takes 30 seconds", body: "Create your account with your email. Starter plan at $1.50/month or Pro at $14.99/month. Cancel any time." },
                  { num: "02", title: "Upload your brief or describe your task", body: "Drag in your assignment PDF, paste the rubric, or just type what you need. The platform detects citation style, length, and subject automatically." },
                  { num: "03", title: "Generate, revise, humanize, and submit", body: "Run any tool in sequence — paper → plagiarism check → LightSpeed Humanizer → revision. Each output feeds cleanly into the next. Review, add your voice, submit." },
                ].map(({ num, title, body }) => (
                  <div key={num} className="flex gap-4">
                    <div className="text-3xl font-bold text-white/6 leading-none shrink-0 w-10 select-none">{num}</div>
                    <div>
                      <h3 className="font-semibold text-white mb-1.5 text-sm">{title}</h3>
                      <p className="text-white/45 text-xs leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/auth">
                <span className="mt-7 block text-center py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer">
                  Start for $1.50 / month
                </span>
              </Link>
            </div>

            {/* Path B — Pay once */}
            <div className="rounded-2xl border border-orange-500/15 bg-orange-900/5 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center">
                  <Zap size={15} className="text-orange-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Pay as you go</p>
                  <p className="text-orange-400/70 text-[11px]">From $0.49 per use · no subscription</p>
                </div>
              </div>
              <div className="space-y-6">
                {[
                  { num: "01", title: "Pick exactly what you need", body: "One paper, one plagiarism check, one STEM problem. Browse the pricing table below and choose the tool and tier that matches your task." },
                  { num: "02", title: "Pay once — instant access", body: "Checkout takes under a minute. Pay by card or mobile money (M-Pesa, MTN, Airtel). Your access unlocks immediately after payment." },
                  { num: "03", title: "Use it, download it, done", body: "No account required beyond signup. Your PAYG purchase never expires — come back whenever you need it. No recurring charge, ever." },
                ].map(({ num, title, body }) => (
                  <div key={num} className="flex gap-4">
                    <div className="text-3xl font-bold text-white/6 leading-none shrink-0 w-10 select-none">{num}</div>
                    <div>
                      <h3 className="font-semibold text-white mb-1.5 text-sm">{title}</h3>
                      <p className="text-white/45 text-xs leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <a href="#payg">
                <span className="mt-7 block text-center py-2.5 rounded-xl text-sm font-semibold border border-orange-500/30 hover:border-orange-400/50 text-orange-400 hover:text-orange-300 hover:bg-orange-500/8 transition-all cursor-pointer">
                  See PAYG pricing below
                </span>
              </a>
            </div>
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
                Upload your rubric and we extract the A-grade criteria first — before writing a single word. The paper is then grounded in 50,000+ peer-reviewed databases, plagiarism-gated below 8%, and cross-checked against your rubric before delivery.
              </p>
              <ul className="space-y-3">
                {[
                  "50,000+ peer-reviewed databases searched per paper",
                  "A-grade rubric extraction + cross-check on every output",
                  "Plagiarism enforced below 8% — not estimated, measured",
                  "STEM mode: equations mapped to the right section (Methods, Results, etc.)",
                  "APA 7th, MLA 9th, Chicago 17th, Harvard, IEEE — latest editions",
                  "500 to 15,000 words — essays, research papers, dissertations, and theses",
                ].map(item => (
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
              Starter at $1.50/mo. Pro for weekly deadlines. Pay-as-you-go when you just need one thing done.
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
          <div id="payg">
            <div className="text-center mb-8 sm:mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs font-medium mb-4">
                <Zap size={11} className="text-orange-400" />
                No subscription required
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">Pay-As-You-Go</h3>
              <p className="text-white/40 text-sm max-w-lg mx-auto">
                Pick exactly what you need. Pay once. No expiry. Ideal for a one-off deadline — paper, check, or STEM problem.
              </p>
            </div>

            {/* Writing tools — tiered by document type */}
            <div className="grid md:grid-cols-3 gap-4 sm:gap-5 mb-4 sm:mb-5">
              {paygWritingTools.map(({ tool, toolId, color, Icon, tiers }) => {
                const iconCls: Record<string,string> = { blue: "text-blue-400", violet: "text-violet-400", indigo: "text-indigo-400" };
                const divCls: Record<string,string>  = { blue: "border-blue-500/15", violet: "border-violet-500/15", indigo: "border-indigo-500/15" };
                const btnCls: Record<string,string>  = { blue: "bg-blue-500/15 text-blue-300 border-blue-500/20 hover:bg-blue-500/25", violet: "bg-violet-500/15 text-violet-300 border-violet-500/20 hover:bg-violet-500/25", indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/25" };
                return (
                  <div key={tool} className={`bg-white/[0.02] border rounded-2xl p-5 sm:p-6 ${divCls[color] ?? "border-white/8"}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <Icon size={14} className={iconCls[color]} />
                      <span className="text-sm font-semibold text-white">{tool}</span>
                    </div>
                    <div className="space-y-2">
                      {tiers.map(({ label, words, price, tier }) => (
                        <div key={label} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-white/60 font-medium leading-tight truncate">{label}</p>
                            <p className="text-[10px] text-white/28">{words}</p>
                          </div>
                          <span className={`text-xs font-bold shrink-0 ${iconCls[color]}`}>{price}</span>
                          <button
                            onClick={() => handleBuyPayg(toolId, tier)}
                            className={`shrink-0 px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition-all ${btnCls[color] ?? "bg-white/10 text-white border-white/15 hover:bg-white/15"}`}
                          >
                            Buy
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Flat-rate tools */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
              {paygFlatTools.map(({ tool, toolId, Icon, color, price, unit, note }) => {
                const iconCls: Record<string,string> = { cyan: "text-cyan-400", amber: "text-amber-400", emerald: "text-emerald-400", orange: "text-orange-400" };
                const btnBg: Record<string,string>   = { cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/25", amber: "bg-amber-500/15 text-amber-300 border-amber-500/20 hover:bg-amber-500/25", emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/25", orange: "bg-orange-500/15 text-orange-300 border-orange-500/20 hover:bg-orange-500/25" };
                return (
                  <div key={tool} className="border border-white/8 bg-white/[0.02] rounded-2xl p-4 sm:p-5 flex flex-col">
                    <Icon size={16} className={`${iconCls[color]} mb-3`} />
                    <p className="text-xs font-semibold text-white mb-1.5">{tool}</p>
                    <div className="flex items-end gap-1 mb-2">
                      <span className={`text-xl font-bold ${iconCls[color]}`}>{price}</span>
                      <span className="text-white/30 text-[10px] mb-0.5">{unit}</span>
                    </div>
                    <p className="text-[10px] text-white/35 leading-relaxed flex-1">{note}</p>
                    <button
                      onClick={() => handleBuyPayg(toolId)}
                      className={`mt-3 w-full py-1.5 text-[11px] font-semibold rounded-xl border transition-all ${btnBg[color] ?? "bg-white/10 text-white border-white/15"}`}
                    >
                      Buy — {price}
                    </button>
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
            Subscribe from $1.50/month — or pay once per task. No lock-in.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/auth">
              <span className="inline-flex items-center gap-2 px-7 sm:px-8 py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-xl shadow-blue-600/25 hover:scale-[1.02] active:scale-100 text-base sm:text-lg">
                Subscribe — from $1.50/mo
                <ArrowRight size={18} />
              </span>
            </Link>
            <a href="#payg" className="inline-flex items-center gap-2 px-7 sm:px-8 py-3.5 sm:py-4 border border-orange-500/30 hover:border-orange-400/50 text-orange-400 hover:text-orange-300 rounded-xl transition-all hover:bg-orange-500/8 text-base sm:text-lg font-semibold">
              <Zap size={18} />
              Buy per task
            </a>
          </div>
          <p className="mt-5 text-xs text-white/25">
            Trusted by students at UCL, Georgia Tech, Edinburgh, UT Austin, and 197 other universities
          </p>
        </div>
      </section>

      {/* ─── PAYG checkout modal (direct purchase from landing page) ─── */}
      {paygCheckout && (
        <CheckoutModal
          open={!!paygCheckout}
          onClose={() => setPaygCheckout(null)}
          mode="payg"
          tool={paygCheckout.tool}
          tier={paygCheckout.tier}
        />
      )}

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
                  { label: "LightSpeed Humanizer", href: "/auth" },
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
                  { label: "Refund Policy", href: "/refunds" },
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

          {/* ── Payment Methods + Security Trust Strip ── */}
          <div className="border-t border-white/5 pt-8 pb-6 space-y-5">

            {/* Payment method logos row */}
            <div className="text-center">
              <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest mb-3">Accepted payment methods</p>
              <div className="flex flex-wrap gap-2 items-center justify-center">

                {/* Visa */}
                <div className="h-8 px-3 rounded-md flex items-center" style={{ backgroundColor: "#1a1f71" }}>
                  <span className="text-white font-extrabold italic text-sm" style={{ letterSpacing: "0.12em" }}>VISA</span>
                </div>

                {/* Mastercard */}
                <div className="h-8 px-2.5 rounded-md bg-[#1a1a1a] border border-white/10 flex items-center gap-2">
                  <div className="relative flex items-center" style={{ width: "30px", height: "20px" }}>
                    <div className="absolute rounded-full" style={{ width: "20px", height: "20px", background: "#eb001b", left: 0 }} />
                    <div className="absolute rounded-full" style={{ width: "20px", height: "20px", background: "#f79e1b", left: "10px", opacity: 0.9 }} />
                  </div>
                  <span className="text-white/75 font-semibold" style={{ fontSize: "10px" }}>Mastercard</span>
                </div>

                {/* American Express */}
                <div className="h-8 px-3 rounded-md flex items-center" style={{ backgroundColor: "#2557a7" }}>
                  <span className="text-white font-bold" style={{ fontSize: "10px", letterSpacing: "0.05em" }}>AMEX</span>
                </div>

                {/* Discover */}
                <div className="h-8 px-3 rounded-md border flex items-center gap-1.5" style={{ borderColor: "#f7971e55", backgroundColor: "#f7971e12" }}>
                  <div className="w-4 h-4 rounded-full" style={{ background: "#f7971e" }} />
                  <span className="font-bold" style={{ fontSize: "10px", color: "#f7971e" }}>Discover</span>
                </div>

                {/* UnionPay */}
                <div className="h-8 px-3 rounded-md flex items-center gap-1" style={{ background: "linear-gradient(135deg,#c0392b,#8b0000)" }}>
                  <span className="text-white font-bold" style={{ fontSize: "10px", letterSpacing: "0.05em" }}>UnionPay</span>
                </div>

                {/* Verve */}
                <div className="h-8 px-3 rounded-md border flex items-center" style={{ borderColor: "#d4712a55", backgroundColor: "#d4712a18" }}>
                  <span className="font-bold" style={{ fontSize: "11px", color: "#e8863a" }}>Verve</span>
                </div>

                {/* PayPal */}
                <div className="h-8 px-3 rounded-md border border-white/10 bg-white/5 flex items-center gap-0.5">
                  <span className="font-bold text-sm" style={{ color: "#009cde" }}>Pay</span>
                  <span className="font-bold text-sm" style={{ color: "#003087" }}>Pal</span>
                </div>

                {/* Apple Pay */}
                <div className="h-8 px-3 rounded-md border border-white/10 bg-white/5 flex items-center gap-1.5">
                  <svg width="13" height="16" viewBox="0 0 814 1000" fill="white">
                    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 391.8 0 263.1 0 140.8c0-94.3 32.6-181.5 92.4-245.7 50.4-55.5 127.8-91.8 212.6-91.8 81.1 0 153.2 56.8 205.6 56.8 50 0 128.2-60.8 217.7-60.8 35.3 0 130.9 3.2 197.9 115.3zm-170.1-175.5c30.3-32.5 50.7-81.3 50.7-130.1 0-6.5-.6-13-1.9-18.3-48.1 1.9-104.9 33.8-140.8 71.1-27.6 30.3-51.9 78.1-51.9 127.6 0 7.1 1.3 14.3 1.9 16.5 3.2.6 8.4 1.3 13.6 1.3 43.4 0 98.1-29 128.4-68.1z" />
                  </svg>
                  <span className="text-white font-semibold" style={{ fontSize: "11px" }}>Pay</span>
                </div>

                {/* Google Pay */}
                <div className="h-8 px-3 rounded-md border border-white/10 bg-white/5 flex items-center gap-1">
                  <span className="font-bold" style={{ fontSize: "12px", background: "linear-gradient(135deg,#4285f4,#34a853,#fbbc05,#ea4335)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>G</span>
                  <span className="text-white/80 font-semibold" style={{ fontSize: "11px" }}>Pay</span>
                </div>

                {/* Klarna */}
                <div className="h-8 px-3 rounded-md flex items-center" style={{ backgroundColor: "#ffb3c7" }}>
                  <span className="font-black" style={{ fontSize: "11px", color: "#17120e", letterSpacing: "0.02em" }}>klarna</span>
                </div>

                {/* Afterpay */}
                <div className="h-8 px-3 rounded-md flex items-center gap-1" style={{ backgroundColor: "#b2fce4" }}>
                  <span className="font-black" style={{ fontSize: "10px", color: "#000", letterSpacing: "0.01em" }}>Afterpay</span>
                </div>

                {/* Alipay */}
                <div className="h-8 px-3 rounded-md border flex items-center gap-1.5" style={{ borderColor: "#1677ff55", backgroundColor: "#1677ff15" }}>
                  <span className="font-bold" style={{ fontSize: "10px", color: "#1677ff" }}>Alipay</span>
                </div>

                {/* WeChat Pay */}
                <div className="h-8 px-3 rounded-md border flex items-center gap-1.5" style={{ borderColor: "#07c16055", backgroundColor: "#07c16015" }}>
                  <span className="font-bold" style={{ fontSize: "10px", color: "#07c160" }}>WeChat Pay</span>
                </div>

                {/* M-Pesa */}
                <div className="h-8 px-3 rounded-md border flex items-center" style={{ borderColor: "#00a65155", backgroundColor: "#00a65118" }}>
                  <span className="font-bold" style={{ fontSize: "11px", color: "#00a651", letterSpacing: "0.03em" }}>M-PESA</span>
                </div>

                {/* Airtel Money */}
                <div className="h-8 px-3 rounded-md border flex items-center" style={{ borderColor: "#ff000040", backgroundColor: "#ff000012" }}>
                  <span className="font-bold" style={{ fontSize: "10px", color: "#f87171", letterSpacing: "0.02em" }}>Airtel Money</span>
                </div>

                {/* MTN MoMo */}
                <div className="h-8 px-3 rounded-md border flex items-center gap-1.5" style={{ borderColor: "#ffd70040", backgroundColor: "#ffd70010" }}>
                  <span className="font-bold" style={{ fontSize: "10px", color: "#fcd34d", letterSpacing: "0.02em" }}>MTN MoMo</span>
                </div>

                {/* Bank Transfer */}
                <div className="h-8 px-3 rounded-md border border-white/8 bg-white/4 flex items-center gap-1.5">
                  <Building2 size={11} className="text-white/35" />
                  <span className="text-white/40 font-medium" style={{ fontSize: "10px" }}>Bank Transfer</span>
                </div>

              </div>
            </div>

            {/* Security trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-1.5 text-white/25">
                <Lock size={11} />
                <span style={{ fontSize: "10px" }} className="font-medium">256-bit SSL Encrypted</span>
              </div>
              <div className="hidden sm:block w-px h-3 bg-white/10" />
              <div className="flex items-center gap-1.5 text-white/25">
                <ShieldCheck size={11} />
                <span style={{ fontSize: "10px" }} className="font-medium">PCI DSS Level 1 Compliant</span>
              </div>
              <div className="hidden sm:block w-px h-3 bg-white/10" />
              <div className="flex items-center gap-1.5 text-white/25">
                <CheckCircle size={11} />
                <span style={{ fontSize: "10px" }} className="font-medium">Secure Checkout</span>
              </div>
              <div className="hidden sm:block w-px h-3 bg-white/10" />
              <div className="flex items-center gap-1.5 text-white/25">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                <span style={{ fontSize: "10px" }} className="font-medium">Fraud Protection</span>
              </div>
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
