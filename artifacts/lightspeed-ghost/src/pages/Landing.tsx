import React, { useState, useEffect, useRef } from "react";
// LazyMotion + `m` ships only the DOM-animation feature set instead of all of
// framer-motion, cutting ~17 KB of JS off the landing's critical path and
// reducing the main-thread work (forced reflows) flagged by PageSpeed.
import { m, LazyMotion, domAnimation, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import { useAuth } from "@/contexts/AuthContext";
import type { PlanId, PaygTool, DocumentTier } from "@/lib/pricing";
import {
  Zap, ArrowRight, CheckCircle, Star, Menu, X,
  PenLine, BookOpen, ShieldCheck, FlaskConical, GraduationCap,
  FileText, ChevronDown, Sparkles, BarChart3,
  Quote, MapPin, Mail, Instagram, Youtube, Wand2,
  Share,
  Database, Layers, Clock, AlertTriangle,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ToolDemosSection } from "@/components/ToolDemos";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

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
    desc: "Writes from real academic papers, never from memory. Every paragraph is grounded in 35+ live databases (10B+ indexed papers) with real, clickable DOI citations. Upload your rubric — or we apply a preset Grade A standard — and cross-check every output against the A-grade criteria, targeting 92%+. Covers 35+ paper types, high school to PhD.",
    badge: "Most used",
    href: "/auth",
    color: "bg-blue-50 text-blue-600 border-blue-200",
  },
  {
    icon: BookOpen,
    name: "Outline Builder",
    desc: "Structure your argument before writing a single sentence. Upload your assignment brief and get a complete hierarchical outline built for your topic in seconds.",
    badge: null,
    href: "/auth",
    color: "bg-indigo-50 text-indigo-600 border-indigo-200",
  },
  {
    icon: FileText,
    name: "Paper Revision",
    desc: "Paste your draft, upload the rubric, set your target grade. We rewrite what needs rewriting and explain every change so you actually learn from it.",
    badge: "Grade booster",
    href: "/auth",
    color: "bg-violet-50 text-violet-600 border-violet-200",
  },
  {
    icon: ShieldCheck,
    name: "AI & Plagiarism Check",
    desc: "Verify your own work for originality and accuracy before you submit. Every similarity match is traced back to its real source so you can check and correct it yourself, with confidence.",
    badge: null,
    href: "/auth",
    color: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
  {
    icon: FlaskConical,
    name: "STEM Solver",
    desc: "Photograph your problem set or upload a dataset. Get full step-by-step solutions with equations, graphs, and linked research papers — Math, Physics, Chemistry, CS, and more. Drop in lab data and it analyses it for you.",
    badge: "Photo upload",
    href: "/auth",
    color: "bg-cyan-50 text-cyan-600 border-cyan-200",
  },
  {
    icon: GraduationCap,
    name: "AI Study Assistant",
    desc: "Reads your own materials or pulls from academic databases, then builds flashcards, quizzes, summaries, study guides, and slides tailored to your content. It identifies your weak points and tells you exactly where to focus — 24/7 tutoring across every subject.",
    badge: "Reads your materials",
    href: "/auth",
    color: "bg-amber-50 text-amber-600 border-amber-200",
  },
  {
    icon: Wand2,
    name: "LightSpeed Humanizer",
    desc: "AI-assisted drafts can read stiff and robotic. The Humanizer rewrites them into natural, authentic academic prose in your own voice — varied rhythm, genuine phrasing — so your writing reads as authentically human, never machine-generated.",
    badge: "Authentic voice",
    href: "/auth",
    color: "bg-purple-50 text-purple-600 border-purple-200",
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
    text: "The plagiarism checker caught overlap I'd completely missed on my own read-through, and traced every match to a real source so I could fix it properly. The humanized draft actually sounds like me on a good day — not a robot trying to sound human.",
    stars: 5,
  },
];

const faqs = [
  {
    q: "What is Light Speed Ghost?",
    a: "Light Speed Ghost is an AI-powered academic toolkit for students from high school through to PhD. Unlike general AI that writes from memory, the research-facing tools write from real academic papers pulled from 35+ live databases (OpenAlex, PubMed, JSTOR, Scopus, arXiv and more) — 10 billion+ indexed sources. One subscription includes seven tools: Paper Writer, Outline Builder, Paper Revision, AI & Plagiarism Checker, LightSpeed Humanizer (for a natural academic voice in your own words), STEM Solver with step-by-step working, and a Study Assistant that reads your own materials.",
  },
  {
    q: "What is the AI Study Assistant and what can it generate?",
    a: "The AI Study Assistant is a dedicated tutor page that generates flashcards, summaries, practice quizzes, mind maps, concept explanations, essays, and more from any topic or uploaded material. Paste your notes, upload a PDF or Word document, attach a screenshot, or upload financial statements for analysis. The assistant remembers your past sessions and adapts to your weakest topics over time.",
  },
  {
    q: "Can I upload my own data or research to the tools?",
    a: "Yes. The Paper Writer, STEM Solver, and Study Assistant all accept dataset uploads — CSV files and spreadsheets. Upload your lab results, survey data, or any tabular data and the AI will analyse it and weave your actual numbers into the output. This is especially useful for data analysis papers, lab reports, and quantitative research questions.",
  },
  {
    q: "Is this actually safe to use? Will my university know?",
    a: "Light Speed Ghost is a writing aid — the same category as Grammarly, tutoring, or study groups. We don't store or share your work with third parties. That said, always review what's generated and make it genuinely yours before submitting. Read our Academic Use Policy for guidance.",
  },
  {
    q: "How is the paper quality? I've tried AI writers before and they're terrible.",
    a: "Fair skepticism. The difference is that we write from real papers, not from memory. Here is exactly what happens on every paper: (1) We simultaneously query 35+ live academic databases — OpenAlex, CrossRef, PubMed, Semantic Scholar, ERIC, Zenodo, arXiv, CORE, DOAJ, Europe PMC, JSTOR, Scopus, SSRN, NBER, BASE, PhilPapers, EconPapers, WHO IRIS, MEDLINE, ClinicalTrials.gov, Cochrane Library, bioRxiv, medRxiv, PsycINFO, ProQuest and more — pulling over 10 billion papers worth of real abstracts, ranked by citation count. Every source is indexed, peer-reviewed, and clickable. No fabricated citations with broken URLs. (2) If you upload a grading rubric, we extract only the A-grade / Distinction criteria and lock them as requirements before writing starts. No rubric? We apply a preset Grade A standard calibrated from Harvard, Oxford, Yale, Princeton, MIT, and Cambridge. (3) After the paper is written, we cross-check it against those criteria and run a targeted improvement pass if any gaps are found, targeting a minimum 92% grade. (4) A plagiarism gate measures similarity and rephrases any section above 8% before we send it to you. (5) The Humanizer refines anything that reads robotic into a natural, authentic academic voice in your own words. That is the pipeline on every single output.",
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
    q: "What's the cheapest plan?",
    a: "The Starter plan is $9.99/month. It includes 3 papers, 1 revision, 5 outline generations, 5 plagiarism + AI checks, 15 STEM solves, and 20 study messages per month. The LightSpeed Humanizer is not included in Starter — upgrade to Pro or use Pay-As-You-Go. There is no free plan — but PAYG means you can use just one tool for as little as $1.99 without any commitment.",
  },
  {
    q: "What's the difference between Pro monthly and annual?",
    a: "Same features, different price. Monthly is $29.99/month. Annual is $269/year — that works out to $22.42/month, saving you 25%. Most students buy annual at the start of a semester. You can cancel anytime and keep access until the billing period ends.",
  },
  {
    q: "How does Pay-As-You-Go work?",
    a: "No subscription needed. You pay per job at the time of use. Paper generation is priced by document type — from $3.99 for a short discussion post up to $59.99 for a full dissertation. Plagiarism checks are $1.99 per submission (Scribbr charges $19.95 for the same thing). Credits never expire.",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    priceMonthly: "$9.99",
    priceAnnual: "$9.99",
    perMonthly: "/ month",
    perAnnual: "/ month",
    desc: "All core tools. Low commitment. No hidden gotchas.",
    features: [
      "3 paper generations / month (any type)",
      "5 plagiarism + AI detection checks / month",
      "15 STEM solver queries / month",
      "20 study messages / month",
      "1 revision / month",
      "5 outline generations / month",
      "7-day document history",
    ],
    locked: ["LightSpeed Humanizer", "Priority AI processing", "Citation export (BibTeX / RIS)"],
    cta: "Start for $9.99",
    ctaLink: "/auth",
    highlight: false,
    badge: null,
  },
  {
    name: "Student Pro",
    priceMonthly: "$19.99",
    priceAnnual: "$14.99",
    perMonthly: "/ month",
    perAnnual: "/ month  ·  billed annually",
    desc: "Everything in Starter, plus the Humanizer and priority processing.",
    features: [
      "8 papers / month (up to 3,500 words each)",
      "4 revisions / month",
      "10 outline generations / month",
      "10 plagiarism + AI checks / month",
      "40 STEM solver problems / month",
      "75 study messages / month",
      "LightSpeed Humanizer — 6 jobs / month",
      "Priority AI processing",
      "Citation export (BibTeX / RIS)",
    ],
    locked: [],
    cta: "Start for $19.99",
    ctaLink: "/auth",
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Pro",
    priceMonthly: "$29.99",
    priceAnnual: "$22.42",
    perMonthly: "/ month",
    perAnnual: "/ month  ·  billed $269 / year",
    desc: "Every cap lifted. Every tool unlocked. One flat price.",
    features: [
      "15 papers / month (up to 3,500 words each)",
      "20 revisions / month",
      "60 STEM solver problems / month",
      "150 study messages / month",
      "20 plagiarism + AI detection checks / month",
      "LightSpeed Humanizer — 20 jobs / month",
      "20 outline generations / month",
      "90-day history + BibTeX / RIS / Zotero export",
      "Priority AI processing",
    ],
    locked: [],
    cta: "Get Pro",
    ctaLink: "/auth",
    highlight: false,
    badge: null,
  },
  {
    name: "Institution",
    priceMonthly: null,
    priceAnnual: "Custom",
    perMonthly: "",
    perAnnual: "pricing · contact us for a quote",
    desc: "For universities, tutoring centers, and study groups. Custom seats, custom pricing, one invoice.",
    features: [
      "All Pro tools for every seat",
      "Flexible seat count — no minimums imposed",
      "Shared document library + admin dashboard",
      "Bulk billing — single invoice per period",
      "Academic integrity reporting + audit logs",
      "Priority SLA support + onboarding",
      "Custom branding available",
    ],
    locked: [],
    cta: "Contact Us",
    ctaLink: "/contact",
    highlight: false,
    badge: "Custom pricing",
  },
];

const paygWritingTools = [
  {
    tool: "Paper Writer", toolId: "paper" as PaygTool, color: "blue", Icon: PenLine,
    tiers: [
      { label: "Discussion / Short response", words: "≤ 500 words",          price: "$3.99",  tier: "discussion" as DocumentTier },
      { label: "Essay",                        words: "500 – 1,500 words",    price: "$7.99",  tier: "essay" as DocumentTier },
      { label: "Research Paper",               words: "1,500 – 3,500 words",  price: "$14.99", tier: "research" as DocumentTier },
      { label: "Proposal / Report",            words: "3,500 – 6,000 words",  price: "$24.99", tier: "proposal" as DocumentTier },
      { label: "Dissertation / Thesis",        words: "6,000 – 15,000 words", price: "$59.99", tier: "dissertation" as DocumentTier },
    ],
  },
  {
    tool: "Revision", toolId: "revision" as PaygTool, color: "violet", Icon: FileText,
    tiers: [
      { label: "Discussion",         words: "≤ 500 words",          price: "$1.99",  tier: "discussion" as DocumentTier },
      { label: "Essay",              words: "500 – 1,500 words",    price: "$3.99",  tier: "essay" as DocumentTier },
      { label: "Research Paper",     words: "1,500 – 3,500 words",  price: "$7.99",  tier: "research" as DocumentTier },
      { label: "Proposal / Report",  words: "3,500 – 6,000 words",  price: "$12.99", tier: "proposal" as DocumentTier },
      { label: "Dissertation",       words: "6,000 – 15,000 words", price: "$24.99", tier: "dissertation" as DocumentTier },
    ],
  },
  {
    tool: "LightSpeed Humanizer", toolId: "humanizer" as PaygTool, color: "indigo", Icon: Sparkles,
    tiers: [
      { label: "Discussion",         words: "≤ 500 words",          price: "$1.99",  tier: "discussion" as DocumentTier },
      { label: "Essay",              words: "500 – 1,500 words",    price: "$3.99",  tier: "essay" as DocumentTier },
      { label: "Research Paper",     words: "1,500 – 3,500 words",  price: "$7.99",  tier: "research" as DocumentTier },
      { label: "Proposal / Report",  words: "3,500 – 6,000 words",  price: "$12.99", tier: "proposal" as DocumentTier },
      { label: "Dissertation",       words: "6,000 – 15,000 words", price: "$24.99", tier: "dissertation" as DocumentTier },
    ],
  },
];

const paygFlatTools = [
  {
    tool: "STEM Solver", toolId: "stem" as PaygTool, Icon: FlaskConical, color: "cyan",
    price: "$1.99", unit: "per problem",
    note: "Math, Physics, Chemistry, Biology, CS — step-by-step with formulas",
  },
  {
    tool: "Study Assistant", toolId: "study" as PaygTool, Icon: GraduationCap, color: "amber",
    price: "$2.99", unit: "/ day pass",
    note: "Unlimited Q&A turns for 24 hours. Flashcards, summaries, quiz mode.",
  },
  {
    tool: "Plagiarism + AI Check", toolId: "plagiarism" as PaygTool, Icon: ShieldCheck, color: "emerald",
    price: "$1.99", unit: "per submission",
    note: "Similarity detection across 99B+ academic sources. Includes AI-generated content scoring.",
  },
  {
    tool: "Outline Generator", toolId: "outline" as PaygTool, Icon: BookOpen, color: "orange",
    price: "$1.99", unit: "per outline",
    note: "Full hierarchical outline for any document type. APA / MLA ready.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-[#e0e3e5] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 sm:p-6 text-left gap-4 group"
      >
        <span className="text-[#191c1e] font-bold group-hover:text-[#6b38d4] transition-colors">{q}</span>
        <m.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown size={18} className={`${open ? "text-[#6b38d4]" : "text-[#76777d] group-hover:text-[#6b38d4]"} shrink-0 transition-colors`} />
        </m.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <p className="px-5 sm:px-6 pb-5 sm:pb-6 text-[#45464d] leading-relaxed text-sm">{a}</p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const previewNavItems = ["Dashboard", "Write Paper", "Outline", "Revision", "Humanizer", "AI & Plagiarism", "STEM Solver", "Study Assistant"];
const previewUrls = ["write", "outline", "revision", "humanizer", "plagiarism", "stem", "study"];

// ── Scroll-triggered reveal (CSS + IntersectionObserver, no framer-motion) ─────
// The reveal class is added in an effect (not in render), so content is always
// visible if JS fails, and the styles only hide-then-reveal once observed.
// Pure CSS transitions are GPU-composited — no forced reflow (which is what
// PageSpeed flagged when these used framer-motion).
function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("lsg-reveal");
    if (delay) el.style.transitionDelay = `${delay}s`;
    const io = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (e.isIntersecting) { el.classList.add("lsg-in"); obs.disconnect(); }
      }
    }, { rootMargin: "0px 0px -60px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <div ref={ref} className={className}>{children}</div>;
}

function StaggerGrid({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    kids.forEach((k, i) => { k.classList.add("lsg-reveal"); k.style.transitionDelay = `${i * 0.08}s`; });
    const io = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (e.isIntersecting) { kids.forEach((k) => k.classList.add("lsg-in")); obs.disconnect(); }
      }
    }, { rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} id={id} className={className}>{children}</div>;
}

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
  const { state: installState } = useInstallPrompt();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);
  const [showExitIntent, setShowExitIntent] = useState(false);
  const exitIntentFiredRef = useRef(false);
  const [liveStats, setLiveStats] = useState<{ documentsThisWeek: number; signupsThisWeek: number } | null>(null);
  // Admin-editable hero/footer copy. Defaults to "" so the built-in marketing
  // copy below renders unchanged (and the build-time prerender is unaffected);
  // an override only applies once an admin saves one in Settings → Site Content.
  const [siteContent, setSiteContent] = useState<{ heroHeadline: string; heroSubtext: string; footerTagline: string; socialX: string; socialInstagram: string; socialYoutube: string }>({
    heroHeadline: "",
    heroSubtext: "",
    footerTagline: "",
    socialX: "",
    socialInstagram: "",
    socialYoutube: "",
  });

  useEffect(() => {
    const apiBase = (import.meta.env.VITE_API_URL ?? "") + "/api";
    fetch(`${apiBase}/public-stats`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: { documentsThisWeek?: number; signupsThisWeek?: number } | null) => {
        if (d && (d.documentsThisWeek || d.signupsThisWeek)) {
          setLiveStats({ documentsThisWeek: d.documentsThisWeek ?? 0, signupsThisWeek: d.signupsThisWeek ?? 0 });
        }
      })
      .catch(() => {});
    fetch(`${apiBase}/site-content`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: { heroHeadline?: string; heroSubtext?: string; footerTagline?: string; socialX?: string; socialInstagram?: string; socialYoutube?: string } | null) => {
        if (d) {
          setSiteContent({
            heroHeadline: d.heroHeadline ?? "",
            heroSubtext: d.heroSubtext ?? "",
            footerTagline: d.footerTagline ?? "",
            socialX: d.socialX ?? "",
            socialInstagram: d.socialInstagram ?? "",
            socialYoutube: d.socialYoutube ?? "",
          });
        }
      })
      .catch(() => {});
  }, []);

  // Influencer link tracking — when someone arrives via ?ref=CODE, register one
  // view for that creator (self-throttled to once per code per day via
  // localStorage).
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("ref");
      if (!code) return;
      const clean = code.toUpperCase().trim().slice(0, 32);
      const key = `lsg_ref_view_${clean}_${new Date().toISOString().slice(0, 10)}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
      const apiBase = (import.meta.env.VITE_API_URL ?? "") + "/api";
      fetch(`${apiBase}/influencer/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: clean }),
      }).catch(() => {});
    } catch { /* non-fatal */ }
  }, []);

  function handleIOSInstall() { setShowIOSModal(true); }
  function handleAndroidInstall() {
    if (installState.type === "android") {
      installState.prompt();
    } else {
      setShowAndroidModal(true);
    }
  }

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

  // Exit intent — fires once per session when mouse leaves top of viewport
  useEffect(() => {
    if (sessionStorage.getItem("lsg_exit_shown")) {
      exitIntentFiredRef.current = true;
    }
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !exitIntentFiredRef.current) {
        exitIntentFiredRef.current = true;
        sessionStorage.setItem("lsg_exit_shown", "1");
        setShowExitIntent(true);
      }
    };
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, []);

  const navLinks = [
    { label: "Tools", href: "#tools" },
    { label: "Ebooks", href: "#ebooks" },
    { label: "How it Works", href: "#howitworks" },
    { label: "Pricing", href: "#pricing" },
    { label: "Institutions", href: "/enterprise" },
    { label: "Africa", href: "/africa" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <LazyMotion features={domAnimation}>
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] antialiased overflow-x-hidden selection:bg-[#6b38d4]/20">

      {/* ── iOS Install Modal ──────────────────────────────────────────── */}
      {showIOSModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 bg-[#131b2e]/50 backdrop-blur-sm" onClick={() => setShowIOSModal(false)}>
          <div className="bg-white border border-[#e0e3e5] rounded-2xl p-6 max-w-xs w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <img src="/icon-192.png" alt="Light Speed" className="w-16 h-16 rounded-2xl mx-auto mb-3" />
            <p className="text-base font-bold text-[#191c1e] mb-1">Install Light Speed</p>
            <p className="text-xs text-[#45464d] mb-5">Add to your home screen for the full app experience</p>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-xl transition-colors text-sm"
            >
              <Share size={15} />
              Tap Share then "Add to Home Screen"
            </button>
            <button onClick={() => setShowIOSModal(false)} className="mt-3 text-xs text-[#76777d] hover:text-[#45464d] transition-colors">
              Not now
            </button>
          </div>
        </div>
      )}

      {/* ── Android Install Modal (shown when native prompt not ready) ─── */}
      {showAndroidModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 bg-[#131b2e]/50 backdrop-blur-sm" onClick={() => setShowAndroidModal(false)}>
          <div className="bg-white border border-[#e0e3e5] rounded-2xl p-6 max-w-xs w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <img src="/icon-192.png" alt="Light Speed" className="w-16 h-16 rounded-2xl mx-auto mb-3" />
            <p className="text-base font-bold text-[#191c1e] mb-1">Install Light Speed</p>
            <p className="text-xs text-[#45464d] mb-5">Add to your home screen for the full app experience</p>
            <button
              onClick={() => {
                if (installState.type === "android") { installState.prompt(); }
                setShowAndroidModal(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              Install App
            </button>
            <p className="mt-3 text-[10px] text-[#76777d]">Tap ⋮ menu → "Add to Home Screen" if the button above doesn't work</p>
            <button onClick={() => setShowAndroidModal(false)} className="mt-2 text-xs text-[#76777d] hover:text-[#45464d] transition-colors">
              Not now
            </button>
          </div>
        </div>
      )}


      {/* ─── NAV ─── */}
      <header className={`fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#e0e3e5] transition-all duration-300 ${scrolled ? "shadow-md bg-white/95 backdrop-blur-md" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          <Link href="/">
            <Logo size={30} textSize="text-base" variant="light" className="cursor-pointer select-none shrink-0" />
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="px-3.5 py-2 text-sm text-[#45464d] hover:text-[#6b38d4] rounded-lg hover:bg-[#f2f4f6] transition-colors whitespace-nowrap"
              >
                {item.label}
              </a>
            ))}
            <Link href="/about">
              <span className="px-3.5 py-2 text-sm text-[#45464d] hover:text-[#6b38d4] rounded-lg hover:bg-[#f2f4f6] transition-colors cursor-pointer whitespace-nowrap">About</span>
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-2.5">
            <Link href="/auth">
              <span className="px-4 py-2 text-sm text-[#45464d] hover:text-[#6b38d4] transition-colors cursor-pointer">Sign In</span>
            </Link>
            <Link href="/auth">
              <span className="px-5 py-2.5 text-sm bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-lg transition-all cursor-pointer shadow-md shadow-[#6b38d4]/20 active:scale-95 whitespace-nowrap">
                Get Started
              </span>
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-[#45464d] hover:text-[#191c1e] rounded-lg hover:bg-[#f2f4f6] transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <m.div
              className="md:hidden bg-white border-t border-[#e0e3e5] px-4 py-4 space-y-1 shadow-lg"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {navLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center px-3 py-3 text-sm text-[#45464d] hover:text-[#6b38d4] rounded-lg hover:bg-[#f2f4f6] transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <Link href="/about">
                <span onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-3 text-sm text-[#45464d] hover:text-[#6b38d4] rounded-lg hover:bg-[#f2f4f6] transition-colors cursor-pointer">
                  About
                </span>
              </Link>
              <div className="pt-3 flex flex-col gap-2.5 border-t border-[#e0e3e5] mt-2">
                <Link href="/auth">
                  <span className="block text-center px-4 py-2.5 text-sm border border-[#c6c6cd] text-[#191c1e] rounded-lg cursor-pointer hover:bg-[#f2f4f6] transition-colors">Sign In</span>
                </Link>
                <Link href="/auth">
                  <span className="block text-center px-4 py-2.5 text-sm bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-lg cursor-pointer transition-colors">Get Started</span>
                </Link>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </header>

      <main>
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden pt-28 pb-14 sm:pt-32 sm:pb-20 px-4 sm:px-6">
        {/* Soft mesh background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(at 0% 0%, rgba(107, 56, 212, 0.06) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(0, 144, 169, 0.06) 0px, transparent 50%)",
          }}
        />
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#4cd7f6]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -left-32 w-80 h-80 bg-[#6b38d4]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left — copy */}
          <m.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 mb-6 sm:mb-8">
              <m.div
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#e9ddff] text-[#5516be] text-[10px] sm:text-[11px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                <Zap size={11} className="text-[#6b38d4] shrink-0" />
                Writes from real academic papers — not from memory
              </m.div>
              <m.div
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] sm:text-[11px] font-medium whitespace-nowrap shrink-0"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                4M+ students worldwide
              </m.div>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-bold leading-[1.12] tracking-tight mb-4 sm:mb-5 text-[#131b2e]" style={{ letterSpacing: "-0.02em" }}>
              {siteContent.heroHeadline ? (
                siteContent.heroHeadline
              ) : (
                <>
                  Every other AI writes from memory.{" "}
                  <span className="text-[#6b38d4]">Light Speed Ghost writes from real academic papers.</span>
                </>
              )}
            </h1>

            <p className="text-base sm:text-lg text-[#45464d] max-w-xl leading-relaxed mb-5">
              {siteContent.heroSubtext ||
                "35+ databases, 10 billion+ indexed papers. Upload your rubric, your notes, your materials — your paper is built on actual research, cross-checked against your A-grade criteria, targeting 92% and above. High school to PhD. One subscription."}
            </p>

            {/* Real-sources proof strip */}
            <div className="flex flex-wrap items-center gap-2 mb-7">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#76777d] uppercase tracking-wider mr-1">
                <Database size={12} className="text-[#6b38d4]" /> Indexed sources
              </span>
              {["OpenAlex", "PubMed", "JSTOR", "Scopus", "arXiv"].map((s) => (
                <span key={s} className="text-[11px] font-semibold text-[#45464d] bg-white border border-[#e0e3e5] rounded-full px-2.5 py-1 shadow-sm">{s}</span>
              ))}
              <span className="text-[11px] font-bold text-[#6b38d4]">+30 more</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link href="/auth">
                <span className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-lg transition-all cursor-pointer shadow-md shadow-[#6b38d4]/25 hover:-translate-y-0.5 text-sm">
                  Write From Real Research — $9.99
                  <ArrowRight size={15} />
                </span>
              </Link>
              <a href="#payg" className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-[#c6c6cd] hover:border-[#6b38d4] text-[#191c1e] hover:text-[#6b38d4] font-semibold rounded-lg transition-all hover:bg-[#eceef0] text-sm">
                <Zap size={14} className="text-orange-500" />
                No subscription — pay once
              </a>
            </div>

            <p className="mt-4 text-xs text-[#76777d]">Starter $9.99/mo · Pay per use from $1.99 · 7-day money-back guarantee</p>
          </m.div>

          {/* Right — animated product preview */}
          <div className="relative">
            <div className="absolute -top-12 -left-12 w-64 h-64 bg-[#4cd7f6]/25 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 rounded-2xl border border-[#e0e3e5] overflow-hidden shadow-2xl bg-white">
              {/* Browser chrome — URL updates with tool */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[#e0e3e5] bg-[#f2f4f6]">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
                <span
                  className="ml-3 text-xs text-[#45464d] font-mono hidden sm:block transition-opacity duration-300"
                  style={{ opacity: fading ? 0 : 1 }}
                >
                  lightspeedghost.com/{previewUrls[previewIdx]}
                </span>
              </div>

              <div className="flex" style={{ minHeight: "300px" }}>
                {/* Sidebar — highlights active tool */}
                <div className="w-44 bg-[#f7f9fb] border-r border-[#e0e3e5] p-3 shrink-0 hidden sm:block">
                  <div className="mb-4 px-2">
                    <Logo size={20} textSize="text-[10px]" variant="light" />
                  </div>
                  {previewNavItems.map((label, i) => (
                    <div
                      key={label}
                      className={`px-3 py-2 rounded-lg text-xs mb-0.5 font-medium transition-all duration-300 ${
                        i === previewIdx + 1 ? "bg-[#6b38d4] text-white" : "text-[#45464d]"
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
                    /* Write Paper — grounded in real papers, cited inline */
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 mb-3">
                        <PenLine size={13} className="text-blue-600" />
                        <span className="text-[11px] font-semibold text-[#191c1e]">Write Your Paper</span>
                        <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Streaming
                        </span>
                      </div>
                      {/* Draft text with a live inline citation */}
                      <p className="text-[10px] text-[#45464d] leading-relaxed">
                        Sustained attention degrades measurably after prolonged screen exposure, with reaction times
                        slowing by up to 14%{" "}
                        <span className="bg-[#e9ddff] text-[#6b38d4] px-1 rounded font-medium">(Okafor &amp; Lin, 2023)</span>.
                        This effect is amplified in adolescents{" "}
                        <span className="bg-[#e9ddff] text-[#6b38d4] px-1 rounded font-medium">(Mensah et al., 2024)</span>,
                        suggesting developmental
                        <span className="inline-block w-1 h-3 align-middle bg-[#6b38d4] ml-0.5 animate-pulse" />
                      </p>
                      {/* Source it's pulling from right now */}
                      <div className="p-2 rounded-lg border border-[#e0e3e5] bg-[#f7f9fb] space-y-1">
                        <div className="flex items-center gap-1.5">
                          <BookOpen size={10} className="text-[#6b38d4]" />
                          <span className="text-[9px] font-semibold text-[#191c1e]">Grounded in 2 indexed sources</span>
                          <CheckCircle size={10} className="text-emerald-600 ml-auto" />
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-[#45464d]">
                          <span className="font-mono text-[#76777d] shrink-0">DOI</span>
                          <span className="truncate">Okafor &amp; Lin (2023), <span className="italic">J. Cognitive Science</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-[#45464d]">
                          <span className="font-mono text-[#76777d] shrink-0">DOI</span>
                          <span className="truncate">Mensah et al. (2024), <span className="italic">Dev. Psychology Rev.</span></span>
                        </div>
                      </div>
                      <div className="text-[9px] text-[#76777d]">APA 7th · 1,500 words · every claim traceable to a real paper</div>
                    </div>
                  )}

                  {previewIdx === 1 && (
                    /* Outline Builder */
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen size={13} className="text-indigo-600" />
                        <span className="text-[11px] font-semibold text-[#191c1e]">Outline Builder</span>
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
                            <span className={`font-mono text-[9px] shrink-0 ${depth === 0 ? "text-indigo-600" : "text-[#76777d]"}`}>{marker}</span>
                            <span className={`text-[10px] ${depth === 0 ? "text-[#191c1e] font-medium" : "text-[#45464d]"}`}>{text}</span>
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
                          <FileText size={13} className="text-violet-600" />
                          <span className="text-[11px] font-semibold text-[#191c1e]">Paper Revision</span>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200">Target: A</span>
                      </div>
                      <p className="text-[10px] text-[#45464d] leading-relaxed">
                        The results{" "}
                        <span className="line-through text-red-500/70">shows</span>{" "}
                        <span className="text-emerald-600">demonstrate</span>{" "}
                        a significant correlation between{" "}
                        <span className="bg-emerald-100 text-emerald-700 px-0.5 rounded">neural pathway activation and cognitive outcomes</span>
                        {" "}across all three cohorts.{" "}
                        <span className="text-emerald-600">Furthermore, the longitudinal data suggests a causal</span>{" "}
                        <span className="line-through text-red-500/70">link</span>{" "}
                        <span className="text-emerald-600">relationship</span>…
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5 text-[9px] text-emerald-600">
                          <div className="w-2 h-2 rounded bg-emerald-200" /> 14 improvements
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-red-500/80">
                          <div className="w-2 h-2 rounded bg-red-200" /> 3 removed
                        </div>
                      </div>
                    </div>
                  )}

                  {previewIdx === 3 && (
                    /* LightSpeed Humanizer */
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 mb-3">
                        <Wand2 size={13} className="text-purple-600" />
                        <span className="text-[11px] font-semibold text-[#191c1e]">LightSpeed Humanizer</span>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-[#76777d]">Reads robotic</span>
                        <span className="text-[9px] font-mono font-bold text-red-500">Stiff</span>
                      </div>
                      <div className="h-1.5 bg-[#eceef0] rounded-full overflow-hidden mb-3">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: "73%" }} />
                      </div>
                      <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg text-[9px] text-purple-700 leading-relaxed italic">
                        "The findings demonstrate…" →{" "}
                        <span className="text-emerald-600 not-italic font-medium">"What emerges from this data is…"</span>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-[#76777d]">Natural academic voice</span>
                        <span className="text-[9px] font-mono font-bold text-emerald-600">Authentic</span>
                      </div>
                      <div className="h-1.5 bg-[#eceef0] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: "96%" }} />
                      </div>
                      <div className="mt-1.5 text-[9px] text-[#45464d] flex items-center gap-1.5">
                        <CheckCircle size={10} className="text-emerald-600" />
                        Reads naturally in your own voice
                      </div>
                    </div>
                  )}

                  {previewIdx === 4 && (
                    /* AI & Plagiarism */
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck size={13} className="text-emerald-600" />
                        <span className="text-[11px] font-semibold text-[#191c1e]">AI & Plagiarism Check</span>
                        <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">PASS</span>
                      </div>
                      {[
                        { label: "AI Content", pct: 6, color: "bg-emerald-500", txt: "text-emerald-600" },
                        { label: "Plagiarism", pct: 3, color: "bg-emerald-500", txt: "text-emerald-600" },
                        { label: "Similarity",  pct: 11, color: "bg-amber-500",  txt: "text-amber-600" },
                      ].map(({ label, pct, color, txt }) => (
                        <div key={label}>
                          <div className="flex justify-between text-[9px] mb-1">
                            <span className="text-[#76777d]">{label}</span>
                            <span className={`font-mono font-semibold ${txt}`}>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-[#eceef0] rounded-full overflow-hidden">
                            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct * 4}%` }} />
                          </div>
                        </div>
                      ))}
                      <div className="mt-2 text-[9px] text-[#45464d] flex items-center gap-1.5">
                        <CheckCircle size={10} className="text-emerald-600" />
                        Safe to submit — humanization not required
                      </div>
                    </div>
                  )}

                  {previewIdx === 5 && (
                    /* STEM Solver */
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 mb-3">
                        <FlaskConical size={13} className="text-cyan-600" />
                        <span className="text-[11px] font-semibold text-[#191c1e]">STEM Solver</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap mb-3">
                        {["Math", "Physics", "Chemistry", "Biology", "CS"].map((s, i) => (
                          <span key={s} className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${i === 1 ? "bg-cyan-50 text-cyan-700 border-cyan-300" : "bg-[#f2f4f6] text-[#45464d] border-[#e0e3e5]"}`}>{s}</span>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        {["Identify all forces acting on the body", "Apply Newton's 2nd law: F = ma", "Solve for acceleration: a = 4 m/s²"].map((step, i) => (
                          <div key={step} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-700 text-[8px] flex items-center justify-center shrink-0">{i + 1}</div>
                            <span className="text-[10px] text-[#45464d]">{step}</span>
                          </div>
                        ))}
                      </div>
                      <div className="p-2 bg-cyan-50 border border-cyan-200 rounded-lg text-[10px] text-cyan-700 font-mono mt-1">
                        F = ma → a = 12/3 = <span className="text-cyan-800 font-bold">4 m/s²</span>
                      </div>
                    </div>
                  )}

                  {previewIdx === 6 && (
                    /* Study Assistant */
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-3">
                        <GraduationCap size={13} className="text-amber-600" />
                        <span className="text-[11px] font-semibold text-[#191c1e]">AI Study Assistant</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-end">
                          <div className="bg-[#e9ddff] border border-[#d0bcff] rounded-xl rounded-tr-sm px-3 py-1.5 text-[10px] text-[#45464d] max-w-[78%]">
                            Explain the Krebs cycle simply
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="w-5 h-5 rounded-full bg-[#6b38d4] flex items-center justify-center shrink-0 mt-0.5">
                            <Zap size={9} className="text-white" />
                          </div>
                          <div className="bg-white border border-[#e0e3e5] rounded-xl rounded-tl-sm px-3 py-1.5 text-[10px] text-[#45464d] leading-relaxed shadow-sm">
                            The Krebs cycle runs in the mitochondria, breaking down acetyl-CoA to produce ATP, NADH, and CO₂ across 8 enzymatic steps…
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {["Quiz me", "Simplify more", "Key takeaways"].map(s => (
                          <span key={s} className="text-[8px] px-2 py-0.5 rounded-full bg-[#f2f4f6] border border-[#e0e3e5] text-[#45464d] cursor-pointer">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Floating live stat card */}
            <div className="absolute -bottom-6 -right-2 sm:-right-6 bg-[#6b38d4] text-white p-4 rounded-lg shadow-xl z-20 hidden md:block">
              <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Live Processing</p>
              <p className="text-xl font-bold">
                {liveStats ? `${liveStats.documentsThisWeek.toLocaleString()} papers this week` : "35+ databases live"}
              </p>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2 mt-5 relative z-20">
              {Array.from({ length: 7 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Show ${previewNavItems[i + 1]} preview`}
                  aria-current={i === previewIdx ? "true" : undefined}
                  onClick={() => { setFading(true); setTimeout(() => { setPreviewIdx(i); setFading(false); }, 200); }}
                  className="flex items-center justify-center p-2 group"
                >
                  <span
                    className={`block rounded-full transition-all duration-300 ${
                      i === previewIdx
                        ? "w-6 h-1.5 bg-[#6b38d4]"
                        : "w-1.5 h-1.5 bg-[#c6c6cd] group-hover:bg-[#76777d]"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── UNIVERSITY TRUST STRIP + SCALE SOCIAL PROOF ─── */}
      <section className="border-y border-[#e0e3e5] bg-[#f2f4f6] py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-center text-[11px] font-semibold text-[#76777d] uppercase tracking-[0.2em] mb-8">Used by students and researchers at</p>
          <div className="flex flex-wrap justify-center items-center gap-x-8 sm:gap-x-12 gap-y-4 opacity-70">
            {["MIT","UCL","Georgia Tech","Edinburgh","Columbia","Nairobi","Witwatersrand","Makerere","Lagos","Melbourne","Toronto"].map(uni => (
              <span key={uni} className="font-bold text-sm sm:text-lg text-[#45464d] uppercase tracking-wide">{uni}</span>
            ))}
            <span className="text-xs font-semibold text-[#6b38d4] whitespace-nowrap">+ 200 more</span>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-4 sm:gap-8 border-t border-[#d8dadc] pt-12 text-center">
            {[
              { value: "6.5M+", label: "Total users", sub: "Students & professionals globally" },
              { value: "4M+",   label: "Active students", sub: "From 200+ universities worldwide" },
              { value: "2.5M+", label: "Ebook publishers", sub: "Selling on Amazon, Apple Books & more" },
            ].map(({ value, label, sub }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#6b38d4]">{value}</div>
                <div className="text-xs sm:text-sm font-semibold text-[#191c1e] mt-1">{label}</div>
                <div className="text-[10px] sm:text-xs text-[#76777d] leading-snug max-w-[160px]">{sub}</div>
              </div>
            ))}
          </div>

          {/* Live platform activity — real numbers from the API, hidden until loaded */}
          {liveStats && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs text-[#45464d]">
                  <span className="font-bold text-[#191c1e] tabular-nums">{liveStats.documentsThisWeek.toLocaleString()}</span> papers &amp; documents generated this week
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6b38d4] opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6b38d4]" />
                </span>
                <span className="text-xs text-[#45464d]">
                  <span className="font-bold text-[#191c1e] tabular-nums">{liveStats.signupsThisWeek.toLocaleString()}</span> new students joined this week
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── QUALITY COMMITMENT STRIP ─── */}
      <section className="py-10 sm:py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-center text-[11px] font-semibold text-[#76777d] uppercase tracking-widest mb-6 sm:mb-8">Quality guarantees — enforced on every output</p>
          <StaggerGrid className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                value: "10B+",
                label: "Real indexed papers",
                sub: "Every output traces to a real source you can click through and verify — OpenAlex, PubMed, JSTOR, Scopus, arXiv + 30 more",
                color: "text-blue-600",
              },
              {
                value: "92%+",
                label: "Grade target",
                sub: "Cross-checked against your rubric — or a preset Grade A standard from Harvard, Oxford, Yale, Princeton, MIT & Cambridge",
                color: "text-[#6b38d4]",
              },
              {
                value: "< 8%",
                label: "Plagiarism ceiling",
                sub: "Similarity measured and reduced before delivery so you can verify your own work with confidence",
                color: "text-emerald-600",
              },
              {
                value: "HS→PhD",
                label: "Every academic level",
                sub: "Academic-level guardrails enforced across every subject, from high school assignments to PhD dissertations",
                color: "text-amber-600",
              },
            ].map(({ value, label, sub, color }) => (
              <m.div key={label} className="rounded-xl border border-[#e0e3e5] bg-white p-4 sm:p-5 text-center shadow-sm">
                <div className={`text-2xl sm:text-3xl font-bold mb-1 ${color}`}>{value}</div>
                <div className="text-xs sm:text-sm font-semibold text-[#191c1e] mb-1.5">{label}</div>
                <div className="text-[10px] sm:text-[11px] text-[#76777d] leading-relaxed">{sub}</div>
              </m.div>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ─── INTEREST · THE VILLAIN ─── */}
      <section className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 bg-[#131b2e] text-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <p className="text-[#a78bfa] text-sm font-bold uppercase tracking-widest mb-3 sm:mb-4">The problem with every other AI</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight" style={{ letterSpacing: "-0.01em" }}>
              Here is what writing from memory actually costs you.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {[
              {
                icon: AlertTriangle,
                title: "Work you can't defend",
                body: "When an AI writes from memory it produces content that sounds like research but cites nothing real, draws from nothing verified, and falls apart the moment it's challenged. That is not a writing tool. It is a liability with your name on it — from a high-school assignment to a PhD dissertation.",
              },
              {
                icon: Layers,
                title: "Five tools, five logins, still not solved",
                body: "To patch the problem, students stack tools — one to write, one to check citations, one to tutor, one for STEM, one to revise. Five subscriptions. Five logins. And the problem still isn't solved, because none of them write from actual papers, cross-check against a rubric, show STEM working, or target a grade outcome.",
              },
              {
                icon: Clock,
                title: "Hours you never get back",
                body: "Manual research burns hours per assignment, across 35+ paper types, compounding every semester and every subject. Hunting sources, formatting citations by hand, wrestling datasets into the right section — the old way is never neutral. It costs you the time you don't have.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
                <div className="w-11 h-11 rounded-xl bg-[#6b38d4]/25 flex items-center justify-center mb-5">
                  <Icon size={22} className="text-[#c4b5fd]" />
                </div>
                <h3 className="font-bold text-white text-lg mb-3">{title}</h3>
                <p className="text-sm text-[#9aa3bd] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 sm:mt-14 text-center">
            <p className="text-white/70 text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
              Light Speed Ghost defeats this at the source. It reads real papers first, cross-checks against your rubric, shows its working, and studies with you — <span className="text-white font-semibold">then it delivers.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ─── WATCH THEM WORK — every tool: full info + live demo ─── */}
      <ToolDemosSection />

      {/* ─── COMPETITOR COMPARISON ─── */}
      <section className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 bg-[#f7f9fb]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3 sm:mb-4">Why choose it</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 text-[#131b2e]">Every alternative has one gap. We close it.</h2>
            <p className="text-[#45464d] text-sm max-w-xl mx-auto">The villain is the same everywhere: AI that writes from nothing. Here is exactly where each alternative falls short — and what we do instead.</p>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 rounded-xl">
            <table className="w-full min-w-[620px] text-sm bg-white rounded-xl border border-[#e0e3e5] border-separate border-spacing-0 overflow-hidden">
              <thead>
                <tr>
                  <th className="text-left py-4 px-4 text-[#45464d] font-semibold text-xs uppercase tracking-wider w-40 border-b-2 border-[#c6c6cd]">Instead of</th>
                  <th className="text-left py-4 px-4 text-[#45464d] font-semibold text-xs uppercase tracking-wider border-b-2 border-[#c6c6cd]">Their gap</th>
                  <th className="text-left py-4 px-4 bg-[#e9ddff]/40 text-[#6b38d4] font-bold text-xs uppercase tracking-wider border-b-2 border-[#6b38d4]">Light Speed Ghost's edge</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { vs: "ChatGPT", gap: "Writes from memory, fabricates citations", edge: "Writes from real papers — real DOIs, 10B+ indexed sources you can click and verify" },
                  { vs: "QuillBot / Grammarly", gap: "Rewriting only, no research", edge: "Research, writing, STEM, and tutoring — one subscription" },
                  { vs: "Chegg / tutors", gap: "Priced per subject", edge: "One price, every subject, every academic level — instant, 24/7" },
                  { vs: "Manual research", gap: "Hours per paper, manual formatting", edge: "Minutes, auto-formatted across 10 citation and formatting methods" },
                  { vs: "Any AI tool", gap: "No rubric cross-checking, unknown grade outcome", edge: "Targets 92%+ against your rubric or a preset Grade A standard from Harvard, Oxford, Yale, Princeton, MIT & Cambridge" },
                  { vs: "STEM tools", gap: "Answers only, no working shown", edge: "Full step-by-step working across every technical subject" },
                  { vs: "Study apps", gap: "Generic content, no personalization", edge: "Reads your materials, builds your study tools, identifies your weak points" },
                ].map(({ vs, gap, edge }, i) => (
                  <tr key={vs} className={i % 2 === 0 ? "" : "bg-[#f7f9fb]"}>
                    <td className="py-3.5 px-4 text-[#191c1e] font-semibold text-xs leading-snug border-b border-[#eceef0] align-top">{vs}</td>
                    <td className="py-3.5 px-4 text-[#76777d] text-xs leading-snug border-b border-[#eceef0] align-top">{gap}</td>
                    <td className="py-3.5 px-4 text-[#191c1e] text-xs leading-snug border-b border-[#eceef0] bg-[#e9ddff]/20 align-top">
                      <span className="inline-flex items-start gap-1.5">
                        <CheckCircle size={13} className="text-[#6b38d4] shrink-0 mt-0.5" />
                        {edge}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 text-center">
            <a href="#payg">
              <span className="inline-flex items-center gap-2 px-6 py-3 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-lg transition-all cursor-pointer shadow-lg shadow-[#6b38d4]/20 hover:-translate-y-0.5 text-sm">
                Try it for $3.99 — no subscription needed
                <ArrowRight size={15} />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS + PRICING + PAY-AS-YOU-GO (combined) ─── */}
      <section id="pricing" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 relative bg-white border-t border-[#e0e3e5]">
        <div className="max-w-6xl mx-auto">

          {/* Header + toggle */}
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3 sm:mb-4">How it works · Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4 text-[#131b2e]">Two ways to get started — priced for students</h2>
            <p className="text-[#45464d] text-sm sm:text-base max-w-xl mx-auto">
              Starter at $9.99/mo. Pro for weekly deadlines. Pay-as-you-go when you just need one thing done. Honest pricing. No dark patterns.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6 sm:mt-8">
              <span className={`text-sm font-medium transition-colors ${!billingAnnual ? "text-[#191c1e]" : "text-[#76777d]"}`}>Monthly</span>
              <button
                type="button"
                role="switch"
                aria-checked={billingAnnual}
                aria-label="Bill annually"
                onClick={() => setBillingAnnual(b => !b)}
                className={`relative w-11 h-6 rounded-full transition-colors ${billingAnnual ? "bg-[#6b38d4]" : "bg-[#c6c6cd]"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow ${billingAnnual ? "left-6" : "left-1"}`} />
              </button>
              <span className={`text-sm font-medium transition-colors ${billingAnnual ? "text-[#191c1e]" : "text-[#76777d]"}`}>Annual</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Save 25%</span>
            </div>
            <p className="text-[11px] text-[#76777d] mt-2 max-w-sm mx-auto">
              Best value: lock in a full semester at the annual rate — most students upgrade in August or January.
            </p>
          </div>

          {/* How it works — subscribe vs pay-as-you-go (anchor preserved) */}
          <div id="howitworks" className="scroll-mt-24 mb-12 sm:mb-16">
            <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
            {/* Path A — Subscribe */}
            <div className="rounded-2xl border border-[#e0e3e5] bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-[#6b38d4]/10 flex items-center justify-center">
                  <Sparkles size={15} className="text-[#6b38d4]" />
                </div>
                <div>
                  <p className="text-[#191c1e] font-semibold text-sm">Subscribe</p>
                  <p className="text-[#6b38d4] text-[11px] font-medium">From $9.99 / month</p>
                </div>
              </div>
              <div className="space-y-6">
                {[
                  { num: "01", title: "Sign up — takes 30 seconds", body: "Create your account with your email. Starter plan at $9.99/month or Pro at $29.99/month. Or pay per use with no subscription. Cancel any time." },
                  { num: "02", title: "Upload your brief or describe your task", body: "Drag in your assignment PDF, paste the rubric, or just type what you need. The platform detects citation style, length, and subject automatically." },
                  { num: "03", title: "Generate, revise, humanize, and submit", body: "Run any tool in sequence — paper → plagiarism check → LightSpeed Humanizer → revision. Each output feeds cleanly into the next. Review, add your voice, submit." },
                ].map(({ num, title, body }) => (
                  <div key={num} className="flex gap-4">
                    <div className="text-3xl font-bold text-[#d8dadc] leading-none shrink-0 w-10 select-none">{num}</div>
                    <div>
                      <h3 className="font-semibold text-[#191c1e] mb-1.5 text-sm">{title}</h3>
                      <p className="text-[#45464d] text-xs leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/auth">
                <span className="mt-7 block text-center py-3 rounded-lg text-sm font-bold bg-[#6b38d4] hover:bg-[#5b2fc0] text-white transition-colors cursor-pointer shadow-md shadow-[#6b38d4]/20">
                  Start for $9.99 / month
                </span>
              </Link>
            </div>

            {/* Path B — Pay once */}
            <div className="rounded-2xl border border-orange-200 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Zap size={15} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-[#191c1e] font-semibold text-sm">Pay as you go</p>
                  <p className="text-orange-600 text-[11px] font-medium">From $1.99 per use · no subscription</p>
                </div>
              </div>
              <div className="space-y-6">
                {[
                  { num: "01", title: "Pick exactly what you need", body: "One paper, one plagiarism check, one STEM problem. Browse the pricing table below and choose the tool and tier that matches your task." },
                  { num: "02", title: "Pay once — instant access", body: "Checkout takes under a minute. Pay by card or mobile money (M-Pesa, MTN, Airtel). Your access unlocks immediately after payment." },
                  { num: "03", title: "Use it, download it, done", body: "No account required beyond signup. Your PAYG purchase never expires — come back whenever you need it. No recurring charge, ever." },
                ].map(({ num, title, body }) => (
                  <div key={num} className="flex gap-4">
                    <div className="text-3xl font-bold text-[#d8dadc] leading-none shrink-0 w-10 select-none">{num}</div>
                    <div>
                      <h3 className="font-semibold text-[#191c1e] mb-1.5 text-sm">{title}</h3>
                      <p className="text-[#45464d] text-xs leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <a href="#payg">
                <span className="mt-7 block text-center py-3 rounded-lg text-sm font-bold border border-orange-300 hover:border-orange-400 text-orange-600 hover:text-orange-700 hover:bg-orange-50 transition-all cursor-pointer">
                  See PAYG pricing below
                </span>
              </a>
            </div>
          </div>
          </div>

          {/* ── Subscription plan cards ── */}
          <StaggerGrid className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-16 sm:mb-24">
            {pricingPlans.map(({ name, priceMonthly, priceAnnual, perMonthly, perAnnual, desc, features, locked, cta, highlight, badge }) => {
              const showAnnual = billingAnnual || priceMonthly === null;
              const price = showAnnual ? priceAnnual : priceMonthly;
              const per   = showAnnual ? perAnnual   : perMonthly;
              const isInstitution = name === "Institution";
              return (
                <m.div
                  key={name}
                  className={`relative p-6 sm:p-7 rounded-xl flex flex-col hover:-translate-y-1 transition-all duration-300 ${
                    isInstitution
                      ? "bg-[#131b2e] text-white border border-[#131b2e]"
                      : highlight
                      ? "bg-white border-2 border-[#6b38d4] shadow-xl shadow-[#6b38d4]/10"
                      : "bg-white border border-[#e0e3e5] shadow-sm hover:shadow-md"
                  }`}
                >
                  {badge && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap uppercase tracking-wide ${highlight ? "bg-[#6b38d4] text-white" : isInstitution ? "bg-white text-[#131b2e]" : "bg-[#eceef0] text-[#45464d] border border-[#d8dadc]"}`}>
                      {badge}
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className={`font-bold mb-2 ${isInstitution ? "text-white" : "text-[#191c1e]"}`}>{name}</h3>
                    <div className="flex items-end gap-1.5">
                      <span className={`text-3xl sm:text-4xl font-bold ${isInstitution ? "text-white" : "text-[#131b2e]"}`}>{price}</span>
                    </div>
                    <p className={`text-[11px] mt-1 leading-relaxed ${isInstitution ? "text-white/60" : "text-[#76777d]"}`}>{per}</p>
                    <p className={`text-xs mt-3 leading-relaxed ${isInstitution ? "text-white/70" : "text-[#45464d]"}`}>{desc}</p>
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {features.map(feat => (
                      <li key={feat} className={`flex items-start gap-2.5 text-sm ${isInstitution ? "text-white/85" : "text-[#45464d]"}`}>
                        <CheckCircle size={13} className={`shrink-0 mt-0.5 ${isInstitution ? "text-[#a78bfa]" : highlight ? "text-[#6b38d4]" : "text-emerald-600"}`} />
                        {feat}
                      </li>
                    ))}
                    {locked.map(feat => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm text-[#9aa0a6] line-through decoration-[#c6c6cd]">
                        <div className="w-3 h-3 rounded-full border border-[#d8dadc] shrink-0 mt-0.5" />
                        {feat}
                      </li>
                    ))}
                  </ul>

                  {isInstitution && (
                    <p className="text-[10px] text-white/60 italic mb-3">Custom pricing — we'll get back to you within 1 business day.</p>
                  )}

                  {name === "Pro" ? (
                    <button
                      onClick={() => setCheckoutPlan(billingAnnual ? "pro_annual" : "pro_monthly")}
                      className="w-full block text-center py-3 rounded-lg text-sm font-bold transition-colors cursor-pointer border border-[#6b38d4] text-[#6b38d4] hover:bg-[#6b38d4]/5"
                    >
                      {cta}
                    </button>
                  ) : name === "Student Pro" ? (
                    <Link href="/auth">
                      <span className="block text-center py-3 rounded-lg text-sm font-bold transition-colors cursor-pointer bg-[#6b38d4] hover:bg-[#5b2fc0] text-white shadow-md shadow-[#6b38d4]/20">
                        {cta}
                      </span>
                    </Link>
                  ) : isInstitution ? (
                    <a href="/enterprise#contact">
                      <span className="w-full block text-center py-3 rounded-lg text-sm font-bold transition-colors cursor-pointer bg-white text-[#131b2e] hover:bg-[#eceef0]">
                        Contact Sales
                      </span>
                    </a>
                  ) : (
                    <Link href="/auth">
                      <span className="block text-center py-3 rounded-lg text-sm font-bold transition-colors cursor-pointer border border-[#6b38d4] text-[#6b38d4] hover:bg-[#6b38d4]/5">
                        {cta}
                      </span>
                    </Link>
                  )}
                </m.div>
              );
            })}
          </StaggerGrid>

          {/* ── Pay-As-You-Go ── */}
          <div id="payg">
            <div className="text-center mb-8 sm:mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-xs font-semibold mb-4">
                <Zap size={11} className="text-orange-500" />
                No subscription required
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#131b2e] mb-3">Pay-As-You-Go</h3>
              <p className="text-[#45464d] text-sm max-w-lg mx-auto">
                Pick exactly what you need. Pay once. No expiry. Ideal for a one-off deadline — paper, check, or STEM problem.
              </p>
            </div>

            {/* Writing tools — tiered by document type */}
            <div className="grid md:grid-cols-3 gap-4 sm:gap-5 mb-4 sm:mb-5">
              {paygWritingTools.map(({ tool, toolId, color, Icon, tiers }) => {
                const iconCls: Record<string,string> = { blue: "text-blue-600", violet: "text-violet-600", indigo: "text-indigo-600" };
                const btnCls: Record<string,string>  = { blue: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100", violet: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100", indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" };
                return (
                  <div key={tool} className="bg-white border border-[#e0e3e5] rounded-xl overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-5 py-3.5 bg-[#f2f4f6] border-b border-[#e0e3e5]">
                      <Icon size={14} className={iconCls[color]} />
                      <span className="text-sm font-bold text-[#191c1e]">{tool}</span>
                    </div>
                    <div className="space-y-2 p-5">
                      {tiers.map(({ label, words, price, tier }) => (
                        <div key={label} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-[#191c1e] font-medium leading-tight truncate">{label}</p>
                            <p className="text-[10px] text-[#76777d]">{words}</p>
                          </div>
                          <span className={`text-xs font-bold shrink-0 ${iconCls[color]}`}>{price}</span>
                          <button
                            onClick={() => handleBuyPayg(toolId, tier)}
                            className={`shrink-0 px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition-all ${btnCls[color] ?? "bg-[#f2f4f6] text-[#191c1e] border-[#d8dadc] hover:bg-[#eceef0]"}`}
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
                const iconCls: Record<string,string> = { cyan: "text-cyan-600", amber: "text-amber-600", emerald: "text-emerald-600", orange: "text-orange-600" };
                const btnBg: Record<string,string>   = { cyan: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100", amber: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100", emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100", orange: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" };
                return (
                  <div key={tool} className="border border-[#e0e3e5] bg-white rounded-xl p-4 sm:p-5 flex flex-col shadow-sm">
                    <Icon size={16} className={`${iconCls[color]} mb-3`} />
                    <p className="text-xs font-bold text-[#191c1e] mb-1.5">{tool}</p>
                    <div className="flex items-end gap-1 mb-2">
                      <span className={`text-xl font-bold ${iconCls[color]}`}>{price}</span>
                      <span className="text-[#76777d] text-[10px] mb-0.5">{unit}</span>
                    </div>
                    <p className="text-[10px] text-[#76777d] leading-relaxed flex-1">{note}</p>
                    <button
                      onClick={() => handleBuyPayg(toolId)}
                      className={`mt-3 w-full py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${btnBg[color] ?? "bg-[#f2f4f6] text-[#191c1e] border-[#d8dadc]"}`}
                    >
                      Buy — {price}
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-[#76777d] text-xs mt-6 sm:mt-8">
              PAYG charges never expire · Billed at time of use · No subscription required
            </p>
          </div>

        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 bg-[#f7f9fb]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3 sm:mb-4">Real students</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#131b2e]">Tested by the best.</h2>
            <p className="text-[#45464d] text-sm mt-3">It's not perfect. But it gets the job done.</p>
          </div>

          {/* Grade-proof strip */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-emerald-200 text-xs shadow-sm">
              <span className="font-mono text-[#76777d] line-through">61%</span>
              <span className="text-emerald-600 font-bold">→ 94%</span>
              <span className="text-[#45464d]">Priya · UCL Biochemistry</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-emerald-200 text-xs shadow-sm">
              <span className="font-mono text-[#76777d] line-through">D</span>
              <span className="text-emerald-600 font-bold">→ 93%</span>
              <span className="text-[#45464d]">Marcus · Georgia Tech CS</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#eceef0] border border-[#e0e3e5] text-xs text-[#45464d]">
              92%+ average grade across all papers
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
            {testimonials.map(({ name, role, text, stars }, idx) => {
              const avatarColors = [
                "bg-[#e9ddff] text-[#5516be]",
                "bg-[#acedff] text-[#004e5c]",
                "bg-[#dae2fd] text-[#131b2e]",
              ];
              const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2);
              return (
              <div key={name} className="p-6 sm:p-8 rounded-xl bg-white border border-[#e0e3e5] shadow-sm hover:shadow-md transition-all flex flex-col">
                <div className="flex items-center gap-0.5 mb-4">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <Quote size={16} className="text-[#6b38d4]/30 mb-3" />
                <p className="text-[#45464d] text-sm leading-relaxed flex-1 mb-5 italic">"{text}"</p>
                <div className="flex items-center gap-3 mt-auto pt-4 border-t border-[#eceef0]">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColors[idx % 3]}`}>
                    {initials}
                  </div>
                  <div>
                    <div className="font-bold text-[#191c1e] text-sm">{name}</div>
                    <div className="text-[#76777d] text-xs mt-0.5">{role}</div>
                  </div>
                </div>
              </div>
            );})}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 bg-[#f2f4f6] border-t border-[#e0e3e5]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3 sm:mb-4">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#131b2e]">Questions we actually get asked</h2>
          </div>
          <div className="space-y-4">
            {faqs.map(faq => <FAQItem key={faq.q} {...faq} />)}
          </div>
          <div className="mt-10 text-center">
            <p className="text-[#45464d] text-sm">Still have questions? <a href="mailto:info@lightspeedghost.com" className="text-[#6b38d4] hover:text-[#5b2fc0] font-medium">Email us</a> or <Link href="/contact"><span className="text-[#6b38d4] hover:text-[#5b2fc0] font-medium cursor-pointer">visit our contact page</span></Link>.</p>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-16 sm:py-24 md:py-28 px-4 sm:px-6 relative overflow-hidden bg-[#131b2e] text-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[300px] sm:h-[400px] bg-[#6b38d4]/20 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-6 sm:mb-8">
            <Logo size={48} showText={false} />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-5 leading-tight" style={{ letterSpacing: "-0.02em" }}>
            Stop writing from nothing.<br />Write from real research.
          </h2>
          <p className="text-[#9aa3bd] mb-8 sm:mb-10 text-base sm:text-lg">
            Real papers, real citations, cross-checked against your A-grade criteria. High school to PhD, every subject, one subscription — or pay once per task. Backed by a 7-day money-back guarantee.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/auth">
              <span className="inline-flex items-center gap-2 px-8 sm:px-10 py-4 sm:py-5 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-bold rounded-lg transition-all cursor-pointer shadow-2xl hover:-translate-y-1 text-base sm:text-lg">
                Write From Real Research — From $9.99
                <ArrowRight size={18} />
              </span>
            </Link>
            <a href="#payg" className="inline-flex items-center gap-2 px-8 sm:px-10 py-4 sm:py-5 bg-white text-[#131b2e] hover:bg-[#eceef0] rounded-lg transition-all text-base sm:text-lg font-bold">
              <Zap size={18} className="text-orange-500" />
              Buy per task
            </a>
          </div>
          <div className="mt-5 flex flex-col items-center gap-2">
            <p className="text-xs text-white/50">
              Trusted by 4M+ students at UCL, Georgia Tech, Edinburgh, UT Austin, and 200+ universities worldwide
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/45">
              <span className="flex items-center gap-1"><ShieldCheck size={10} className="text-emerald-400/70" /> 7-day money-back guarantee</span>
              <span>·</span>
              <span>Cancel anytime</span>
              <span>·</span>
              <span>No expiry on PAYG</span>
            </div>
          </div>
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

      </main>

      {/* ─── FOOTER ─── */}
      <footer className="bg-[#eceef0] border-t border-[#e0e3e5] py-12 sm:py-14 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 sm:gap-10 mb-10 sm:mb-12">

            <div className="col-span-2">
              <Logo size={30} variant="light" className="mb-4" />
              <p className="text-[#45464d] text-sm leading-relaxed max-w-xs mb-4">
                Academic writing tools for students who have deadlines and standards.
              </p>
              <div className="space-y-2 text-xs text-[#45464d]">
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="shrink-0 mt-0.5 text-[#76777d]" />
                  <span>500 Oracle Pkwy, Redwood City, CA 94065</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={12} className="shrink-0 text-[#76777d]" />
                  <a href="mailto:info@lightspeedghost.com" className="hover:text-[#6b38d4] transition-colors">info@lightspeedghost.com</a>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <a href={siteContent.socialX || "https://x.com/lightspeedghost"} target="_blank" rel="noreferrer" aria-label="Light Speed Ghost on X"
                  className="w-7 h-7 rounded-lg bg-white border border-[#d8dadc] hover:border-[#6b38d4] flex items-center justify-center text-[#45464d] hover:text-[#6b38d4] transition-all">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href={siteContent.socialInstagram || "https://instagram.com/lightspeedghost"} target="_blank" rel="noreferrer" aria-label="Light Speed Ghost on Instagram"
                  className="w-7 h-7 rounded-lg bg-white border border-[#d8dadc] hover:border-[#6b38d4] flex items-center justify-center text-[#45464d] hover:text-[#6b38d4] transition-all">
                  <Instagram size={13} aria-hidden="true" />
                </a>
                <a href={siteContent.socialYoutube || "https://youtube.com/@lightspeedghost"} target="_blank" rel="noreferrer" aria-label="Light Speed Ghost on YouTube"
                  className="w-7 h-7 rounded-lg bg-white border border-[#d8dadc] hover:border-[#6b38d4] flex items-center justify-center text-[#45464d] hover:text-[#6b38d4] transition-all">
                  <Youtube size={13} aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Product links */}
            <div>
              <h3 className="text-[#45464d] text-xs font-bold uppercase tracking-widest mb-4">Product</h3>
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
                      <span className="text-[#45464d] hover:text-[#6b38d4] text-sm transition-colors cursor-pointer">{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company links */}
            <div>
              <h3 className="text-[#45464d] text-xs font-bold uppercase tracking-widest mb-4">Company</h3>
              <ul className="space-y-2.5">
                {[
                  { label: "About", href: "/about" },
                  { label: "Blog", href: "/blog" },
                  { label: "Careers", href: "/careers" },
                  { label: "Contact", href: "/contact" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Influencer Program", href: "/influencer" },
                  { label: "For African Students", href: "/africa" },
                  { label: "For Institutions", href: "/enterprise" },
                ].map(({ label, href }) => (
                  <li key={label}>
                    {href.startsWith("#") ? (
                      <a href={href} className="text-[#45464d] hover:text-[#6b38d4] text-sm transition-colors">{label}</a>
                    ) : (
                      <Link href={href}>
                        <span className="text-[#45464d] hover:text-[#6b38d4] text-sm transition-colors cursor-pointer">{label}</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal links */}
            <div>
              <h3 className="text-[#45464d] text-xs font-bold uppercase tracking-widest mb-4">Legal</h3>
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
                      <span className="text-[#45464d] hover:text-[#6b38d4] text-sm transition-colors cursor-pointer">{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Payments + Apps ── */}
          <div className="border-t border-[#d8dadc] pt-7 pb-6 flex flex-col sm:flex-row items-center justify-between gap-5">

            {/* Payments — Stripe + mobile money, marks only */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <div className="h-8 px-3.5 rounded-lg flex items-center shadow-sm" style={{ backgroundColor: "#635bff" }}>
                <span className="text-white font-bold text-[14px] tracking-tight">stripe</span>
              </div>
              <div className="h-8 px-3 rounded-lg border bg-white flex items-center" style={{ borderColor: "#00a65166" }}>
                <span className="font-bold" style={{ fontSize: "11px", color: "#00a651", letterSpacing: "0.03em" }}>M-PESA</span>
              </div>
              <div className="h-8 px-3 rounded-lg flex items-center" style={{ backgroundColor: "#ffcb05" }}>
                <span className="font-bold" style={{ fontSize: "10px", color: "#17120e" }}>MTN MoMo</span>
              </div>
              <div className="h-8 px-3 rounded-lg border bg-white flex items-center" style={{ borderColor: "#ff000055" }}>
                <span className="font-bold" style={{ fontSize: "10px", color: "#e11900" }}>Airtel Money</span>
              </div>
            </div>

            {/* Get the app — small badges */}
            <div className="flex items-center gap-2.5">
              <button onClick={handleIOSInstall} aria-label="Download on the App Store" className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 bg-white border border-[#d8dadc] hover:border-[#6b38d4] rounded-lg transition-all">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#191c1e] shrink-0" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
                <span className="text-xs font-semibold text-[#191c1e]">App Store</span>
              </button>
              <button onClick={handleAndroidInstall} aria-label="Get it on Google Play" className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 bg-white border border-[#d8dadc] hover:border-[#6b38d4] rounded-lg transition-all">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true"><path d="M3.18 23.76c.33.18.71.24 1.08.15L16.5 12 4.26.09C3.89 0 3.51.06 3.18.24 2.65.54 2.29 1.1 2.29 1.8v20.4c0 .7.36 1.26.89 1.56z" fill="#4285F4"/><path d="M20.94 10.78 18.5 9.38 16.5 12l2 2.62 2.44-1.4c.83-.45.83-1.99 0-2.44z" fill="#FBBC04"/><path d="M16.5 9.38 4.26.09c-.33-.18-.69-.27-1.08-.15l13.32 11.44L16.5 9.38z" fill="#34A853"/><path d="M16.5 14.62l-13.32 9.14c.39.12.75.21 1.08.15L16.5 14.62z" fill="#EA4335"/></svg>
                <span className="text-xs font-semibold text-[#191c1e]">Google Play</span>
              </button>
            </div>

          </div>

          <div className="border-t border-[#d8dadc] pt-6 sm:pt-7 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[#76777d] text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved. A product of <span className="text-[#45464d] font-medium">Zawadi Technologies LLC</span>.</p>
            <p className="text-[#76777d] text-xs text-center sm:text-right">{siteContent.footerTagline || "Built for students who have too much to do and too little time."}</p>
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

      {/* ─── EXIT INTENT MODAL ─── */}
      <AnimatePresence>
        {showExitIntent && (
          <m.div
            className="fixed inset-0 z-[400] flex items-center justify-center px-4 bg-[#131b2e]/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowExitIntent(false)}
          >
            <m.div
              className="bg-white border border-[#e0e3e5] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowExitIntent(false)}
                className="absolute top-4 right-4 p-1.5 text-[#76777d] hover:text-[#191c1e] rounded-lg hover:bg-[#f2f4f6] transition-all"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-xs font-semibold w-fit mb-4">
                <Zap size={11} className="text-orange-500" />
                Before you go
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-[#191c1e] mb-2 leading-tight">
                Try one paper for <span className="text-orange-500">$3.99</span>.<br />No subscription. Ever.
              </h3>
              <p className="text-[#45464d] text-sm leading-relaxed mb-5">
                Real citations. Plagiarism-gated below 8%. Grade-targeted. If it's not better than what you'd write yourself, we'll refund you — no questions.
              </p>

              <div className="space-y-2 mb-6">
                {[
                  "35+ live academic databases — 10B+ real papers",
                  "A-grade rubric extraction from your brief",
                  "Plagiarism checked below 8% before delivery",
                  "7-day money-back guarantee",
                ].map(item => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-[#45464d]">
                    <CheckCircle size={13} className="text-emerald-600 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              <a
                href="#payg"
                onClick={() => setShowExitIntent(false)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/20 hover:scale-[1.01] active:scale-100 text-sm"
              >
                <Zap size={15} />
                Try one paper — from $3.99
              </a>
              <Link href="/auth">
                <span
                  onClick={() => setShowExitIntent(false)}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 border border-[#d8dadc] hover:border-[#6b38d4] text-[#45464d] hover:text-[#6b38d4] rounded-xl transition-all text-sm cursor-pointer"
                >
                  Or subscribe from $9.99/mo
                </span>
              </Link>
              <p className="text-center text-[#76777d] text-xs mt-3">No credit card required to create an account</p>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
    </LazyMotion>
  );
}
