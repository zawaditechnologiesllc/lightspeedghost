import React, { useState, useRef } from "react";
import { m, LazyMotion, domAnimation, useInView, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  Zap, ArrowRight, CheckCircle, Star, Menu, X,
  PenLine, BookOpen, ShieldCheck, FlaskConical, GraduationCap,
  FileText, BotMessageSquare, MapPin, Quote,
} from "lucide-react";
import { Logo } from "@/components/Logo";

function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <m.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}

function StaggerGrid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <m.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{ visible: { transition: { staggerChildren: 0.08 } }, hidden: {} }}
    >
      {children}
    </m.div>
  );
}

const cardVariant = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const tools = [
  { icon: PenLine, name: "AI Paper Writer", desc: "Papers grounded in 25+ live academic databases. Upload your rubric, get real DOI citations, plagiarism-checked below 8%.", badge: "Most used", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { icon: BookOpen, name: "Outline Builder", desc: "Full hierarchical outline for any assignment. Upload your brief and structure your argument in seconds.", badge: null, color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  { icon: FileText, name: "Paper Revision", desc: "Paste your draft, upload the rubric, set your target grade. We rewrite and explain every change.", badge: "Grade booster", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  { icon: ShieldCheck, name: "AI & Plagiarism Check", desc: "Detect AI patterns and similarity before your lecturer does. One click humanizes flagged sections.", badge: null, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { icon: FlaskConical, name: "STEM Solver", desc: "Photograph your problem set or upload a dataset. Full step-by-step solutions — Maths, Physics, Chemistry, CS.", badge: "Photo upload", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  { icon: GraduationCap, name: "AI Study Assistant", desc: "Upload lecture notes, ask anything, get tutored. Remembers every session and adapts to your weak topics.", badge: "Long-term memory", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { icon: BotMessageSquare, name: "Flashcards & Quizzes", desc: "Generate flashcards, summaries, practice quizzes, and mind maps from any topic or uploaded material.", badge: null, color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
];

const africanTestimonials = [
  {
    name: "Amina W.",
    role: "3rd Year · Business Administration · University of Nairobi",
    location: "Nairobi, Kenya",
    text: "I paid with M-Pesa in 30 seconds. No Visa card, no VPN, no foreign exchange headaches. The paper writer gave me real citations from African journals — exactly what my lecturer wanted. I went from a C to an A on my economics assignment.",
    stars: 5,
    flag: "🇰🇪",
  },
  {
    name: "Chukwuemeka O.",
    role: "Final Year · Computer Engineering · University of Lagos",
    location: "Lagos, Nigeria",
    text: "I tried GPT and it kept giving me citations that don't exist. LightSpeed Ghost pulled real papers, checked plagiarism, and the whole thing worked perfectly on my 2G connection in the evening. Paid with MTN MoMo instantly.",
    stars: 5,
    flag: "🇳🇬",
  },
  {
    name: "Lerato M.",
    role: "Postgrad · Public Health · University of Cape Town",
    location: "Cape Town, South Africa",
    text: "The STEM solver is genuinely different from anything else available here. I photograph my biostatistics problems and it walks through the method. My supervisor actually commented that my assignments had improved significantly.",
    stars: 5,
    flag: "🇿🇦",
  },
  {
    name: "Ronald K.",
    role: "2nd Year · Law · Makerere University",
    location: "Kampala, Uganda",
    text: "Works on mobile data — that alone makes it worth it. I do most of my studying on my phone and every other tool I tried was too heavy to load. This one actually works. The study assistant remembers what I was doing last week.",
    stars: 5,
    flag: "🇺🇬",
  },
  {
    name: "Abena A.",
    role: "3rd Year · Economics · University of Ghana",
    location: "Accra, Ghana",
    text: "I used Airtel Money to subscribe. Within 5 minutes I had a full research paper with real references from academic databases I couldn't even access on my own. It saved me two weeks of library work.",
    stars: 5,
    flag: "🇬🇭",
  },
  {
    name: "Fatima B.",
    role: "Postgrad · Education · University of Dar es Salaam",
    location: "Dar es Salaam, Tanzania",
    text: "The plagiarism checker found similarity in my literature review that I completely missed. The humanizer fixed it and it now reads much better. I submitted confidently for the first time this semester.",
    stars: 5,
    flag: "🇹🇿",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "$9.99",
    per: "/ month",
    desc: "All core tools. Low commitment.",
    features: [
      "3 paper generations / month",
      "5 plagiarism + AI detection checks",
      "15 STEM solver queries",
      "20 study messages / month",
      "1 revision / month",
      "5 outline generations",
      "7-day document history",
    ],
    cta: "Start for $9.99",
    highlight: false,
    badge: null,
  },
  {
    name: "Student Pro",
    price: "$19.99",
    per: "/ month · or $14.99 billed annually",
    desc: "Everything in Starter, plus the Humanizer and priority processing.",
    features: [
      "8 papers / month",
      "4 revisions / month",
      "20 outline generations",
      "20 plagiarism + AI checks",
      "40 STEM solver problems",
      "Unlimited study messages",
      "LightSpeed Humanizer (up to 5,000 words)",
      "Priority AI processing",
      "Citation export (BibTeX / RIS)",
    ],
    cta: "Start for $19.99",
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Pro",
    price: "$29.99",
    per: "/ month · or $22.42/mo billed annually",
    desc: "Every cap lifted. Every tool unlocked.",
    features: [
      "15 papers / month",
      "20 revisions / month",
      "60 STEM solver problems",
      "150 study messages / month",
      "20 plagiarism + AI checks",
      "Humanizer — 20 jobs / month",
      "90-day history + export formats",
      "Priority AI processing",
    ],
    cta: "Get Pro",
    highlight: false,
    badge: null,
  },
];

const africanAdvantages = [
  {
    title: "No foreign card required",
    desc: "Pay directly with M-Pesa, MTN MoMo, or Airtel Money. No Visa, no Mastercard, no bank transfer fees, no VPN needed.",
    color: "border-emerald-500/20 bg-emerald-500/5",
    icon: "💳",
  },
  {
    title: "Works on mobile data",
    desc: "Built light. The entire platform loads fast on 3G and works smoothly on mobile — because most students here study on their phones.",
    color: "border-blue-500/20 bg-blue-500/5",
    icon: "📱",
  },
  {
    title: "African research databases included",
    desc: "We query African Journals OnLine (AJOL), African Index Medicus, and regional academic repositories — not just Western databases.",
    color: "border-amber-500/20 bg-amber-500/5",
    icon: "📚",
  },
  {
    title: "Local currency pricing coming",
    desc: "We're rolling out KES, NGN, GHS, UGX, and TZS pricing so you pay in your own currency without conversion losses.",
    color: "border-violet-500/20 bg-violet-500/5",
    icon: "💰",
  },
  {
    title: "Western tools weren't built for you",
    desc: "Tools like Grammarly Premium and Chegg cost $30–$40/month and require a foreign card. LightSpeed Ghost starts at $9.99 and accepts mobile money.",
    color: "border-cyan-500/20 bg-cyan-500/5",
    icon: "🌍",
  },
  {
    title: "Academic integrity you control",
    desc: "You see the citations, you review the output, you submit what you believe in. We're a writing aid — not a shortcut. Use responsibly.",
    color: "border-orange-500/20 bg-orange-500/5",
    icon: "🎓",
  },
];

export default function Africa() {
  const scrolled = useScrolled();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <LazyMotion features={domAnimation}>
    <div className="min-h-screen bg-[#04080f] text-white antialiased overflow-x-hidden">

      {/* ─── NAV ─── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#04080f]/95 backdrop-blur-md border-b border-white/5 shadow-lg" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/">
            <Logo size={30} textSize="text-base" className="cursor-pointer select-none shrink-0" />
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {[
              { label: "Tools", href: "#tools" },
              { label: "Why Africa?", href: "#why" },
              { label: "Pricing", href: "#pricing" },
              { label: "Testimonials", href: "#testimonials" },
            ].map((item) => (
              <a key={item.label} href={item.href} className="px-3.5 py-2 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2.5">
            <Link href="/auth">
              <span className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors cursor-pointer">Sign In</span>
            </Link>
            <Link href="/auth">
              <span className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors cursor-pointer shadow-md shadow-emerald-600/20 whitespace-nowrap">
                Sign Up Free
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

        <AnimatePresence>
          {mobileOpen && (
            <m.div
              className="md:hidden bg-[#04080f]/98 border-t border-white/8 px-4 py-4 space-y-1"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {[
                { label: "Tools", href: "#tools" },
                { label: "Why Africa?", href: "#why" },
                { label: "Pricing", href: "#pricing" },
                { label: "Testimonials", href: "#testimonials" },
              ].map((item) => (
                <a key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                  {item.label}
                </a>
              ))}
              <div className="pt-3 flex flex-col gap-2.5 border-t border-white/5 mt-2">
                <Link href="/auth">
                  <span className="block text-center px-4 py-2.5 text-sm border border-white/15 text-white rounded-lg cursor-pointer hover:bg-white/5 transition-colors">Sign In</span>
                </Link>
                <Link href="/auth">
                  <span className="block text-center px-4 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg cursor-pointer transition-colors">Sign Up Free</span>
                </Link>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-20 pb-12 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[500px] bg-emerald-600/15 rounded-full blur-[140px]" />
          <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] bg-blue-600/12 rounded-full blur-[110px]" />
          <div className="absolute top-1/3 -right-20 w-[350px] h-[350px] bg-amber-500/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-emerald-900/25 rounded-full blur-[80px]" />
        </div>

        <m.div
          className="relative max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6 sm:mb-8">
            <m.div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Built for African students
            </m.div>
            <m.div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Zap size={11} className="text-amber-400" />
              M-Pesa · MTN MoMo · Airtel Money accepted
            </m.div>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-5 sm:mb-6">
            Built for African students.{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              Priced for African realities.
            </span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-white/55 max-w-2xl mx-auto leading-relaxed mb-8 sm:mb-10">
            Seven AI tools — paper writing, STEM solving, plagiarism checking, humanizing AI text, studying — all accessible via mobile money. No foreign card. No VPN. Works on mobile data. Starting at $9.99/month.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/auth">
              <span className="inline-flex items-center gap-2 px-7 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-xl shadow-emerald-600/25 hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-100 text-sm sm:text-base cursor-pointer">
                <Zap size={15} />
                Get started — from $9.99/mo
              </span>
            </Link>
            <a href="#pricing" className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/20 hover:border-white/35 text-white/80 hover:text-white rounded-xl transition-all hover:bg-white/5 text-sm sm:text-base">
              See pricing
              <ArrowRight size={16} />
            </a>
          </div>

          {/* Grade proof strip */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <span className="text-emerald-400 font-bold">🇰🇪</span>
              <span className="text-white/40">Amina · Nairobi — C → A</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs">
              <span className="text-blue-400 font-bold">🇳🇬</span>
              <span className="text-white/40">Chukwuemeka · Lagos — paid with MTN MoMo</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs">
              <span className="text-violet-400 font-bold">🇺🇬</span>
              <span className="text-white/40">Ronald · Kampala — works on mobile data</span>
            </div>
          </div>
        </m.div>
      </section>

      {/* ─── UNIVERSITY STRIP ─── */}
      <section className="border-y border-white/5 bg-white/[0.015] py-4 sm:py-5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-5 text-center">
            <span className="text-[10px] font-semibold text-white/22 uppercase tracking-[0.2em] shrink-0">Used by students at</span>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
              {["Nairobi","Lagos","Cape Town","Makerere","Ghana","Dar es Salaam","Witwatersrand","Cairo","Addis Ababa","Ibadan","KNUST"].map(uni => (
                <span key={uni} className="text-[11px] font-medium text-white/38 hover:text-white/60 transition-colors cursor-default">{uni}</span>
              ))}
            </div>
            <span className="text-[10px] font-medium text-emerald-400/50 shrink-0 whitespace-nowrap">+ 200 more</span>
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="py-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <StaggerGrid className="grid grid-cols-3 gap-4 sm:gap-8 text-center">
            {[
              { value: "200+", label: "African universities", sub: "From Nairobi to Cape Town to Accra", color: "text-emerald-400" },
              { value: "4M+",  label: "Students worldwide", sub: "Active on the platform right now", color: "text-blue-400" },
              { value: "3",    label: "Mobile money networks", sub: "M-Pesa, MTN MoMo, Airtel Money", color: "text-amber-400" },
            ].map(({ value, label, sub, color }) => (
              <m.div key={label} variants={cardVariant} className="flex flex-col items-center gap-1">
                <div className={`text-3xl sm:text-4xl md:text-5xl font-bold ${color}`}>{value}</div>
                <div className="text-xs sm:text-sm font-semibold text-white/70 mt-1">{label}</div>
                <div className="text-[10px] sm:text-xs text-white/30 leading-snug max-w-[140px]">{sub}</div>
              </m.div>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ─── PAYMENT METHODS ─── */}
      <section className="border-y border-white/5 bg-white/[0.02] py-8 sm:py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <FadeUp>
            <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-5">Pay with the money in your phone</p>
            <div className="flex flex-wrap gap-3 items-center justify-center">
              {/* M-Pesa */}
              <div className="h-8 px-3 rounded-md border flex items-center" style={{ borderColor: "#00a65155", backgroundColor: "#00a65118" }}>
                <span className="font-bold" style={{ fontSize: "11px", color: "#00a651", letterSpacing: "0.03em" }}>M-PESA</span>
              </div>
              {/* MTN MoMo */}
              <div className="h-8 px-3 rounded-md border flex items-center gap-1.5" style={{ borderColor: "#ffd70040", backgroundColor: "#ffd70010" }}>
                <span className="font-bold" style={{ fontSize: "10px", color: "#fcd34d", letterSpacing: "0.02em" }}>MTN MoMo</span>
              </div>
              {/* Airtel Money */}
              <div className="h-8 px-3 rounded-md border flex items-center" style={{ borderColor: "#ff000040", backgroundColor: "#ff000012" }}>
                <span className="font-bold" style={{ fontSize: "10px", color: "#f87171", letterSpacing: "0.02em" }}>Airtel Money</span>
              </div>
              {/* Separator */}
              <div className="hidden sm:block w-px h-6 bg-white/10" />
              {/* Cards too */}
              <div className="h-8 px-3 rounded-md flex items-center" style={{ backgroundColor: "#1a1f71" }}>
                <span className="text-white font-extrabold italic text-sm" style={{ letterSpacing: "0.12em" }}>VISA</span>
              </div>
              <div className="h-8 px-2.5 rounded-md bg-[#1a1a1a] border border-white/10 flex items-center gap-2">
                <div className="relative flex items-center" style={{ width: "30px", height: "20px" }}>
                  <div className="absolute rounded-full" style={{ width: "20px", height: "20px", background: "#eb001b", left: 0 }} />
                  <div className="absolute rounded-full" style={{ width: "20px", height: "20px", background: "#f79e1b", left: "10px", opacity: 0.9 }} />
                </div>
                <span className="text-white/75 font-semibold" style={{ fontSize: "10px" }}>Mastercard</span>
              </div>
              <div className="h-8 px-3 rounded-md border border-white/10 bg-white/5 flex items-center gap-0.5">
                <span className="font-bold text-sm" style={{ color: "#009cde" }}>Pay</span>
                <span className="font-bold text-sm" style={{ color: "#003087" }}>Pal</span>
              </div>
            </div>
            <p className="text-[10px] text-white/25 mt-4">No foreign card needed. No currency conversion fees. No VPN.</p>
          </FadeUp>
        </div>
      </section>

      {/* ─── TOOLS ─── */}
      <section id="tools" className="py-14 sm:py-20 px-4 sm:px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/8 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto">
          <FadeUp>
            <div className="max-w-2xl mb-10 sm:mb-14">
              <p className="text-emerald-400 text-sm font-medium uppercase tracking-widest mb-3">What you get</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4">
                Seven tools.<br />One subscription.
              </h2>
              <p className="text-white/50 text-base sm:text-lg">
                Everything from writing full research papers with real African and international citations, to solving STEM problems step-by-step, to an AI tutor that remembers what you studied last week.
              </p>
            </div>
          </FadeUp>

          <StaggerGrid className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {tools.map(({ icon: Icon, name, desc, badge, color }) => (
              <m.div key={name} variants={cardVariant}>
                <Link href="/auth">
                  <div className="group relative p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-white/18 hover:bg-white/[0.055] transition-all cursor-pointer h-full hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30">
                    {badge && (
                      <span className={`absolute top-4 right-4 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
                        {badge}
                      </span>
                    )}
                    <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-4 border ${color} group-hover:scale-110 transition-transform duration-300`}>
                      <Icon size={18} />
                    </div>
                    <h3 className="font-semibold text-white mb-2">{name}</h3>
                    <p className="text-sm text-white/50 leading-relaxed group-hover:text-white/60 transition-colors">{desc}</p>
                    <div className="mt-4 flex items-center gap-1 text-[11px] text-white/25 group-hover:text-white/40 transition-colors font-medium">
                      Try this tool <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              </m.div>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ─── WHY LightSpeed BEATS WESTERN TOOLS ─── */}
      <section id="why" className="py-14 sm:py-20 px-4 sm:px-6 border-y border-white/5 bg-gradient-to-b from-[#04080f] to-[#060d1a]">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-emerald-400 text-sm font-medium uppercase tracking-widest mb-3">The honest comparison</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why LightSpeed Ghost beats Western tools for African students</h2>
              <p className="text-white/45 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                Grammarly, Chegg, and ChatGPT Plus cost $30–$40/month and require a foreign debit or credit card. That's not a viable option for most students at African universities.
              </p>
            </div>
          </FadeUp>

          <StaggerGrid className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {africanAdvantages.map(({ title, desc, color, icon }) => (
              <m.div key={title} variants={cardVariant} className={`rounded-xl border p-5 sm:p-6 ${color}`}>
                <div className="text-2xl mb-3">{icon}</div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{desc}</p>
              </m.div>
            ))}
          </StaggerGrid>

          {/* Comparison table */}
          <FadeUp delay={0.2} className="mt-10 sm:mt-14">
            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-4 bg-white/[0.04] border-b border-white/8 text-xs font-semibold text-white/40 uppercase tracking-wider">
                <div className="p-4 col-span-2">Feature</div>
                <div className="p-4 text-center text-emerald-400">LightSpeed Ghost</div>
                <div className="p-4 text-center">ChatGPT Plus</div>
              </div>
              {[
                { feature: "Price / month", lsg: "$9.99–$29.99", chatgpt: "$20" },
                { feature: "Mobile money payment", lsg: "✓ M-Pesa, MTN, Airtel", chatgpt: "✗ Card only" },
                { feature: "Works on mobile data", lsg: "✓ Optimised", chatgpt: "⚠ Heavy interface" },
                { feature: "Real academic citations", lsg: "✓ 25+ live databases", chatgpt: "✗ Hallucinated" },
                { feature: "Plagiarism checker", lsg: "✓ Built-in", chatgpt: "✗ Not included" },
                { feature: "African research databases", lsg: "✓ AJOL + regional", chatgpt: "✗ None" },
                { feature: "STEM step-by-step solver", lsg: "✓ With photo upload", chatgpt: "⚠ General only" },
                { feature: "Grade-targeted revision", lsg: "✓ Rubric upload", chatgpt: "✗ No rubric support" },
              ].map(({ feature, lsg, chatgpt }, i) => (
                <div key={feature} className={`grid grid-cols-4 text-sm border-b border-white/5 last:border-0 ${i % 2 === 0 ? "" : "bg-white/[0.015]"}`}>
                  <div className="p-4 col-span-2 text-white/60">{feature}</div>
                  <div className="p-4 text-center text-emerald-400 font-medium">{lsg}</div>
                  <div className="p-4 text-center text-white/30">{chatgpt}</div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-emerald-400 text-sm font-medium uppercase tracking-widest mb-3">Pricing</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Priced for students, not enterprise</h2>
              <p className="text-white/45 max-w-xl mx-auto text-sm sm:text-base">
                All plans payable with M-Pesa, MTN MoMo, Airtel Money, or card. Cancel anytime. 7-day money-back guarantee.
              </p>
            </div>
          </FadeUp>

          <StaggerGrid className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {pricingPlans.map(({ name, price, per, desc, features, cta, highlight, badge }) => (
              <m.div
                key={name}
                variants={cardVariant}
                className={`relative rounded-2xl border p-6 sm:p-7 flex flex-col ${highlight ? "border-emerald-500/40 bg-emerald-500/5 shadow-xl shadow-emerald-900/20" : "border-white/8 bg-white/[0.025]"}`}
              >
                {badge && (
                  <span className={`absolute -top-3 left-6 text-xs font-semibold px-3 py-1 rounded-full ${highlight ? "bg-emerald-500 text-white" : "bg-white/10 text-white/60 border border-white/10"}`}>
                    {badge}
                  </span>
                )}
                <h3 className="text-lg font-bold text-white mb-1">{name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-white">{price}</span>
                </div>
                <p className="text-xs text-white/35 mb-2">{per}</p>
                <p className="text-sm text-white/50 mb-5 leading-relaxed">{desc}</p>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/65">
                      <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth">
                  <span className={`block text-center py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${highlight ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20" : "border border-white/15 text-white/70 hover:text-white hover:border-white/30 hover:bg-white/5"}`}>
                    {cta}
                  </span>
                </Link>
              </m.div>
            ))}
          </StaggerGrid>

          <FadeUp delay={0.1} className="mt-8 text-center">
            <p className="text-sm text-white/35">
              Need just one tool without a subscription?{" "}
              <Link href="/auth">
                <span className="text-emerald-400 hover:text-emerald-300 cursor-pointer underline underline-offset-2">Pay-as-you-go from $1.99</span>
              </Link>
              {" "}— credits never expire.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section id="testimonials" className="py-14 sm:py-20 px-4 sm:px-6 border-t border-white/5 bg-gradient-to-b from-[#060d1a] to-[#04080f]">
        <div className="max-w-7xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-emerald-400 text-sm font-medium uppercase tracking-widest mb-3">Student voices</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">From Nairobi to Cape Town to Lagos</h2>
              <p className="text-white/45 max-w-xl mx-auto text-sm sm:text-base">Real students. Real African universities. Real results.</p>
            </div>
          </FadeUp>

          <StaggerGrid className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {africanTestimonials.map(({ name, role, location, text, stars, flag }) => (
              <m.div key={name} variants={cardVariant} className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/8 flex flex-col gap-4">
                <Quote size={16} className="text-emerald-400/50 shrink-0" />
                <p className="text-sm text-white/65 leading-relaxed flex-1">{text}</p>
                <div className="flex items-center gap-0.5 mb-1">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <div className="border-t border-white/5 pt-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{flag}</div>
                    <div>
                      <p className="text-white font-semibold text-sm">{name}</p>
                      <p className="text-white/40 text-xs mt-0.5">{role}</p>
                      <div className="flex items-center gap-1 mt-1 text-white/30 text-xs">
                        <MapPin size={10} />
                        {location}
                      </div>
                    </div>
                  </div>
                </div>
              </m.div>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-950/15" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-600/10 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <FadeUp>
            <m.div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              200+ African universities · Mobile money accepted
            </m.div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5 leading-tight">
              Start today.<br />
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-300 bg-clip-text text-transparent">
                Pay with your phone.
              </span>
            </h2>
            <p className="text-white/50 mb-8 text-base sm:text-lg max-w-lg mx-auto">
              Join 4 million+ students. No foreign card needed. Works on mobile data. Cancel anytime.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/auth">
                <span className="inline-flex items-center gap-2 px-7 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-xl shadow-emerald-600/25 hover:scale-[1.02] active:scale-100 text-sm sm:text-base cursor-pointer">
                  <Zap size={15} />
                  Create your free account
                </span>
              </Link>
              <a href="#tools" className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/20 hover:border-white/35 text-white/70 hover:text-white rounded-xl transition-all hover:bg-white/5 text-sm sm:text-base">
                See all tools
                <ArrowRight size={16} />
              </a>
            </div>
            <p className="text-white/25 text-xs mt-5">7-day money-back guarantee · No credit card required to sign up</p>
          </FadeUp>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <Link href="/">
              <Logo size={24} textSize="text-sm" className="cursor-pointer opacity-60 hover:opacity-100 transition-opacity" />
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-white/30">
              <Link href="/about"><span className="hover:text-white/55 cursor-pointer transition-colors">About</span></Link>
              <Link href="/contact"><span className="hover:text-white/55 cursor-pointer transition-colors">Contact</span></Link>
              <Link href="/enterprise"><span className="hover:text-white/55 cursor-pointer transition-colors">For Institutions</span></Link>
              <Link href="/privacy"><span className="hover:text-white/55 cursor-pointer transition-colors">Privacy</span></Link>
              <Link href="/terms"><span className="hover:text-white/55 cursor-pointer transition-colors">Terms</span></Link>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-white/20 text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
            <p className="text-white/15 text-xs">Built for students who have too much to do and too little time.</p>
          </div>
        </div>
      </footer>
    </div>
    </LazyMotion>
  );
}
