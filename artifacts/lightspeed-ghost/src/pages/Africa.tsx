import React, { useState, useRef } from "react";
import { m, LazyMotion, domAnimation, useInView, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  Zap, ArrowRight, CheckCircle, Star, Menu, X,
  PenLine, BookOpen, ShieldCheck, FlaskConical, GraduationCap,
  FileText, Wand2, MapPin, Quote,
  CreditCard, Smartphone, Globe,
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
  { icon: PenLine, name: "AI Paper Writer", desc: "Papers grounded in 25+ live academic databases. Upload your rubric, get real DOI citations, plagiarism-checked below 8%.", badge: "Most used" },
  { icon: BookOpen, name: "Outline Builder", desc: "Full hierarchical outline for any assignment. Upload your brief and structure your argument in seconds.", badge: null },
  { icon: FileText, name: "Paper Revision", desc: "Paste your draft, upload the rubric, set your target grade. We rewrite and explain every change.", badge: "Grade booster" },
  { icon: ShieldCheck, name: "AI & Plagiarism Check", desc: "Detect AI patterns and similarity before your lecturer does. One click humanizes flagged sections.", badge: null },
  { icon: FlaskConical, name: "STEM Solver", desc: "Photograph your problem set or upload a dataset. Full step-by-step solutions — Maths, Physics, Chemistry, CS.", badge: "Photo upload" },
  { icon: GraduationCap, name: "AI Study Assistant", desc: "Reads your notes or pulls from academic databases, then builds flashcards, quizzes, summaries, and study guides tailored to your content — and flags exactly where to focus. Remembers every session.", badge: "Reads your materials" },
  { icon: Wand2, name: "LightSpeed Humanizer", desc: "Rewrites stiff AI-assisted drafts into natural, authentic academic prose in your own voice — so your writing reads as genuinely human.", badge: "Authentic voice" },
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
    name: "Free",
    price: "$0",
    per: "forever · no card, no mobile money needed",
    desc: "Check your work without spending a shilling.",
    features: [
      "Instant Writing Analyzer — AI detector, readability, grammar & tone",
      "Unlimited — runs in your browser, even on 3G",
      "3 plagiarism + AI checks / month (local detection)",
      "Your text never touches an AI model",
      "Add Pay-As-You-Go credits via M-Pesa anytime",
    ],
    cta: "Start Free",
    highlight: false,
    badge: null,
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
    highlight: true,
    badge: "Most popular",
  },
];

const africanAdvantages = [
  {
    title: "No foreign card required",
    desc: "Pay directly with M-Pesa, MTN MoMo, or Airtel Money. No Visa, no Mastercard, no bank transfer fees, no VPN needed.",
    icon: "💳",
  },
  {
    title: "Works on mobile data",
    desc: "Built light. The entire platform loads fast on 3G and works smoothly on mobile — because most students here study on their phones.",
    icon: "📱",
  },
  {
    title: "African research databases included",
    desc: "We query African Journals OnLine (AJOL), African Index Medicus, and regional academic repositories — not just Western databases.",
    icon: "📚",
  },
  {
    title: "Local currency pricing coming",
    desc: "We're rolling out KES, NGN, GHS, UGX, and TZS pricing so you pay in your own currency without conversion losses.",
    icon: "💰",
  },
  {
    title: "Western tools weren't built for you",
    desc: "Tools like Grammarly Premium and Chegg cost $30–$40/month and require a foreign card. LightSpeed Ghost starts free and accepts mobile money for everything else.",
    icon: "🌍",
  },
  {
    title: "Academic integrity you control",
    desc: "You see the citations, you review the output, you submit what you believe in. We're a writing aid — not a shortcut. Use responsibly.",
    icon: "🎓",
  },
];

export default function Africa() {
  const scrolled = useScrolled();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: "Ecosystem", href: "#tools" },
    { label: "Why Africa?", href: "#why" },
    { label: "Pricing", href: "#pricing" },
    { label: "Testimonials", href: "#testimonials" },
  ];

  return (
    <LazyMotion features={domAnimation}>
    <div className="min-h-screen bg-[#eef7f1] text-[#191c1e] antialiased overflow-x-hidden selection:bg-[#10b981]/20">

      {/* ─── NAV ─── */}
      <header className={`fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#e0e3e5] transition-all duration-300 ${scrolled ? "shadow-md bg-white/95 backdrop-blur-md" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/">
            <Logo size={30} textSize="text-base" variant="light" className="cursor-pointer select-none shrink-0" />
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="px-3.5 py-2 text-sm text-[#45464d] hover:text-[#10b981] rounded-lg hover:bg-[#e8f3ed] transition-colors whitespace-nowrap">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2.5">
            <Link href="/auth">
              <span className="px-4 py-2 text-sm text-[#45464d] hover:text-[#10b981] transition-colors cursor-pointer">Sign In</span>
            </Link>
            <Link href="/auth">
              <span className="px-5 py-2.5 text-sm bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-lg transition-colors cursor-pointer shadow-md shadow-[#10b981]/20 whitespace-nowrap">
                Get Started
              </span>
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-[#45464d] hover:text-[#191c1e] rounded-lg hover:bg-[#e8f3ed] transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <m.div
              className="md:hidden bg-white border-t border-[#e0e3e5] px-4 py-4 space-y-1 shadow-lg"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {navItems.map((item) => (
                <a key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-3 text-sm text-[#45464d] hover:text-[#10b981] rounded-lg hover:bg-[#e8f3ed] transition-colors">
                  {item.label}
                </a>
              ))}
              <div className="pt-3 flex flex-col gap-2.5 border-t border-[#e0e3e5] mt-2">
                <Link href="/auth">
                  <span className="block text-center px-4 py-2.5 text-sm border border-[#c6c6cd] text-[#191c1e] rounded-lg cursor-pointer hover:bg-[#e8f3ed] transition-colors">Sign In</span>
                </Link>
                <Link href="/auth">
                  <span className="block text-center px-4 py-2.5 text-sm bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-lg cursor-pointer transition-colors">Get Started</span>
                </Link>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </header>

      <main>
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden pt-28 pb-14 sm:pt-32 sm:pb-20 px-4 sm:px-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(at 0% 0%, rgba(107, 56, 212, 0.06) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(0, 144, 169, 0.06) 0px, transparent 50%)",
          }}
        />
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center relative">
          {/* Left — copy */}
          <m.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#d1fae5] text-[#047857] text-xs font-bold uppercase tracking-wider mb-6">
              <CheckCircle size={14} />
              Built for African Students
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-bold leading-[1.05] tracking-tight mb-4 text-[#131b2e]" style={{ letterSpacing: "-0.02em" }}>
              Built for African academic excellence.
            </h1>

            <p className="text-lg font-semibold text-[#45464d] mb-4">
              M-Pesa · MTN MoMo · Airtel Money accepted.<br className="hidden sm:block" />
              Priced for African realities. Start free — pay per task from $1.99.
            </p>

            <p className="text-base text-[#45464d] max-w-xl leading-relaxed mb-8">
              Seven AI tools that write from real academic papers — African journals (AJOL) plus 35+ global databases, not from memory. Paper writing, STEM step-by-step, self-checking, a natural academic voice, and more — all via mobile money. No foreign card. No VPN. Works on mobile data.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-8">
              <Link href="/auth">
                <span className="inline-flex items-center gap-2 px-7 py-4 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-lg transition-all shadow-lg shadow-[#10b981]/25 hover:-translate-y-0.5 text-sm sm:text-base cursor-pointer">
                  Get started — from $9.99/mo
                  <ArrowRight size={16} />
                </span>
              </Link>
              <a href="#pricing" className="inline-flex items-center gap-2 px-7 py-4 border border-[#76777d] hover:border-[#10b981] text-[#191c1e] hover:text-[#10b981] font-bold rounded-lg transition-all hover:bg-[#eceef0] text-sm sm:text-base">
                See pricing
              </a>
            </div>

            {/* Grade proof strip */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#e0e3e5] text-xs shadow-sm">
                <span>🇰🇪</span>
                <span className="text-[#45464d]">Amina · Nairobi — C → A</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#e0e3e5] text-xs shadow-sm">
                <span>🇳🇬</span>
                <span className="text-[#45464d]">Chukwuemeka · Lagos — MTN MoMo</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#e0e3e5] text-xs shadow-sm">
                <span>🇺🇬</span>
                <span className="text-[#45464d]">Ronald · Kampala — mobile data</span>
              </div>
            </div>
          </m.div>

          {/* Right — mockup */}
          <m.div
            className="relative"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="absolute -inset-4 bg-[#d1fae5]/40 rounded-[2rem] blur-2xl pointer-events-none" />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-[#e0e3e5] overflow-hidden">
              <div className="h-12 border-b border-[#e0e3e5] px-4 flex items-center justify-between bg-[#e8f3ed]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="text-xs text-[#45464d] font-mono">AI Paper Writer — v4.2</div>
              </div>
              <div className="p-5 space-y-4">
                <div className="h-3 bg-[#eceef0] w-3/4 rounded animate-pulse" />
                <div className="h-3 bg-[#eceef0] w-full rounded animate-pulse" />
                <div className="h-3 bg-[#eceef0] w-5/6 rounded animate-pulse" />
                <div className="pt-4 border-t border-[#e0e3e5]">
                  <div className="text-[#10b981] font-bold mb-2 text-sm">Generating Outline…</div>
                  <div className="pl-2 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-[#45464d]"><CheckCircle size={16} className="text-emerald-600 shrink-0" /> 1. Socio-economic impact of tech in Kenya</div>
                    <div className="flex items-center gap-2 text-sm text-[#45464d]"><CheckCircle size={16} className="text-emerald-600 shrink-0" /> 2. Mobile money revolution 2010–2024</div>
                    <div className="flex items-center gap-2 text-sm text-[#76777d]"><div className="w-4 h-4 rounded-full border-2 border-[#c6c6cd] border-t-[#10b981] animate-spin shrink-0" /> 3. Future of regional digital trade</div>
                  </div>
                </div>
              </div>
            </div>
          </m.div>
        </div>
      </section>

      {/* ─── STATS — dark navy ─── */}
      <section className="bg-[#131b2e] py-14 sm:py-16 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-[11px] uppercase tracking-widest text-white/50 mb-8 font-semibold">Trusted across the continent</p>
          <div className="grid grid-cols-3 gap-4 sm:gap-8 items-start">
            {[
              { value: "200+", label: "African Universities" },
              { value: "4M+", label: "Students worldwide" },
              { value: "3", label: "Local Money Networks" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#6ee7b7] mb-1">{value}</div>
                <p className="text-xs sm:text-sm text-white/70">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-white/45">
              {["Nairobi","Lagos","Cape Town","Makerere","Ghana","Dar es Salaam","Witwatersrand","Cairo","Addis Ababa","Ibadan","KNUST"].map(city => (
                <span key={city}>{city}</span>
              ))}
              <span className="text-[#6ee7b7]">+ 200 more</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PAYMENT METHODS ─── */}
      <section className="border-b border-[#e0e3e5] bg-white py-10 sm:py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <FadeUp>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#131b2e] mb-2">Pay with the money in your phone</h2>
            <div className="flex flex-wrap gap-2.5 items-center justify-center mt-6">
              {/* M-Pesa */}
              <div className="h-9 px-4 rounded-lg border bg-white flex items-center shadow-sm" style={{ borderColor: "#00a65155" }}>
                <span className="font-bold" style={{ fontSize: "13px", color: "#00a651", letterSpacing: "0.03em" }}>M-PESA</span>
              </div>
              {/* MTN MoMo */}
              <div className="h-9 px-4 rounded-lg flex items-center shadow-sm" style={{ backgroundColor: "#ffcb05" }}>
                <span className="font-bold" style={{ fontSize: "12px", color: "#17120e" }}>MTN MoMo</span>
              </div>
              {/* Airtel Money */}
              <div className="h-9 px-4 rounded-lg border bg-white flex items-center shadow-sm" style={{ borderColor: "#ff000055" }}>
                <span className="font-bold" style={{ fontSize: "12px", color: "#e11900" }}>Airtel Money</span>
              </div>
              <div className="hidden sm:block w-px h-7 bg-[#c6c6cd]" />
              {/* VISA */}
              <div className="h-9 px-4 rounded-lg flex items-center shadow-sm" style={{ backgroundColor: "#1a1f71" }}>
                <span className="text-white font-extrabold italic text-sm" style={{ letterSpacing: "0.12em" }}>VISA</span>
              </div>
              {/* Mastercard */}
              <div className="h-9 px-3 rounded-lg bg-[#1a1a1a] flex items-center gap-2 shadow-sm">
                <div className="relative flex items-center" style={{ width: "30px", height: "20px" }}>
                  <div className="absolute rounded-full" style={{ width: "20px", height: "20px", background: "#eb001b", left: 0 }} />
                  <div className="absolute rounded-full" style={{ width: "20px", height: "20px", background: "#f79e1b", left: "10px", opacity: 0.9 }} />
                </div>
                <span className="text-white/90 font-semibold" style={{ fontSize: "10px" }}>Mastercard</span>
              </div>
              {/* PayPal */}
              <div className="h-9 px-4 rounded-lg border border-[#d8dadc] bg-white flex items-center gap-0.5 shadow-sm">
                <span className="font-bold text-sm" style={{ color: "#009cde" }}>Pay</span>
                <span className="font-bold text-sm" style={{ color: "#003087" }}>Pal</span>
              </div>
            </div>

            {/* Assurance cards */}
            <div className="grid sm:grid-cols-3 gap-3 mt-8 max-w-3xl mx-auto text-left">
              {[
                { icon: CreditCard, title: "No foreign card", desc: "Use your local mobile wallet" },
                { icon: Globe, title: "No conversion fees", desc: "Pay exactly what you see" },
                { icon: Smartphone, title: "No VPN required", desc: "Works on local IP addresses" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-center gap-3 rounded-xl border border-[#e0e3e5] bg-[#eef7f1] p-4">
                  <div className="w-9 h-9 rounded-lg bg-[#10b981]/10 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-[#10b981]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#191c1e]">{title}</p>
                    <p className="text-xs text-[#76777d]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ─── TOOLS ─── */}
      <section
        id="tools"
        className="py-14 sm:py-20 md:py-24 px-4 sm:px-6"
      >
        <div className="max-w-7xl mx-auto">
          <FadeUp>
            <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
              <p className="text-[#10b981] text-sm font-bold uppercase tracking-widest mb-3">What you get</p>
              <h2 className="text-3xl sm:text-4xl font-bold leading-tight mb-4 text-[#131b2e]">
                Seven tools. One subscription.
              </h2>
              <p className="text-[#45464d] text-base sm:text-lg">
                Everything from writing full research papers with real African and international citations, to solving STEM problems step-by-step, to an AI tutor that remembers what you studied last week.
              </p>
            </div>
          </FadeUp>

          <StaggerGrid className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {tools.map(({ icon: Icon, name, desc, badge }) => (
              <m.div key={name} variants={cardVariant}>
                <Link href="/auth">
                  <div className="group relative p-6 sm:p-7 rounded-xl bg-white border border-[#e0e3e5] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer h-full">
                    {badge && (
                      <span className="absolute top-4 right-4 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#d1fae5] text-[#047857]">
                        {badge}
                      </span>
                    )}
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-5 bg-[#10b981]/10 text-[#10b981] group-hover:bg-[#10b981] group-hover:text-white transition-colors">
                      <Icon size={20} />
                    </div>
                    <h3 className="font-semibold text-lg text-[#191c1e] mb-2">{name}</h3>
                    <p className="text-sm text-[#45464d] leading-relaxed">{desc}</p>
                    <div className="mt-4 flex items-center gap-1 text-[11px] text-[#10b981] font-semibold">
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
      <section id="why" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 border-y border-[#e0e3e5] bg-[#e8f3ed]">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-[#10b981] text-sm font-bold uppercase tracking-widest mb-3">The honest comparison</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-[#131b2e]">Why LightSpeed Ghost beats Western tools for African students</h2>
              <p className="text-[#45464d] text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                Grammarly, Chegg, and ChatGPT Plus cost $30–$40/month and require a foreign debit or credit card. That's not a viable option for most students at African universities.
              </p>
            </div>
          </FadeUp>

          <StaggerGrid className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-10 sm:mb-14">
            {africanAdvantages.map(({ title, desc, icon }) => (
              <m.div key={title} variants={cardVariant} className="rounded-xl border border-[#e0e3e5] bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-all">
                <div className="text-2xl mb-3">{icon}</div>
                <h3 className="font-semibold text-[#191c1e] mb-2">{title}</h3>
                <p className="text-sm text-[#45464d] leading-relaxed">{desc}</p>
              </m.div>
            ))}
          </StaggerGrid>

          {/* Comparison table */}
          <FadeUp delay={0.1}>
            <div className="rounded-2xl border border-[#e0e3e5] bg-white overflow-hidden shadow-sm overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-4 bg-[#e8f3ed] border-b border-[#e0e3e5] text-xs font-bold text-[#76777d] uppercase tracking-wider">
                  <div className="p-4 col-span-2">Feature</div>
                  <div className="p-4 text-center text-[#10b981]">LightSpeed Ghost</div>
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
                  <div key={feature} className={`grid grid-cols-4 text-sm border-b border-[#eceef0] last:border-0 ${i % 2 === 0 ? "" : "bg-[#eef7f1]"}`}>
                    <div className="p-4 col-span-2 text-[#191c1e] font-medium">{feature}</div>
                    <div className="p-4 text-center text-[#10b981] font-semibold">{lsg}</div>
                    <div className="p-4 text-center text-[#76777d]">{chatgpt}</div>
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-[#10b981] text-sm font-bold uppercase tracking-widest mb-3">Ready to excel?</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-[#131b2e]">Priced for students, not enterprise</h2>
              <p className="text-[#45464d] max-w-xl mx-auto text-sm sm:text-base">
                Choose the plan that fits your semester budget. All plans payable with M-Pesa, MTN MoMo, Airtel Money, or card. Cancel anytime. 7-day money-back guarantee.
              </p>
            </div>
          </FadeUp>

          <StaggerGrid className="grid md:grid-cols-3 gap-5 sm:gap-6 items-start">
            {pricingPlans.map(({ name, price, per, desc, features, cta, highlight, badge }) => (
              <m.div
                key={name}
                variants={cardVariant}
                className={`relative rounded-2xl p-6 sm:p-7 flex flex-col ${highlight ? "bg-[#131b2e] text-white shadow-2xl md:-mt-4 md:mb-4" : "bg-white border border-[#e0e3e5] shadow-sm"}`}
              >
                {badge && (
                  <span className={`absolute -top-3 left-6 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide ${highlight ? "bg-[#10b981] text-white" : "bg-[#eceef0] text-[#45464d] border border-[#d8dadc]"}`}>
                    {badge}
                  </span>
                )}
                <h3 className={`text-lg font-bold mb-1 ${highlight ? "text-white" : "text-[#191c1e]"}`}>{name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-4xl font-bold ${highlight ? "text-white" : "text-[#131b2e]"}`}>{price}</span>
                </div>
                <p className={`text-xs mb-3 ${highlight ? "text-white/50" : "text-[#76777d]"}`}>{per}</p>
                <p className={`text-sm mb-5 leading-relaxed ${highlight ? "text-white/70" : "text-[#45464d]"}`}>{desc}</p>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-sm ${highlight ? "text-white/85" : "text-[#45464d]"}`}>
                      <CheckCircle size={14} className={`shrink-0 mt-0.5 ${highlight ? "text-[#6ee7b7]" : "text-[#10b981]"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth">
                  <span className={`block text-center py-3 rounded-lg font-bold text-sm transition-all cursor-pointer ${highlight ? "bg-[#10b981] hover:bg-[#059669] text-white shadow-lg shadow-[#10b981]/30" : "border border-[#10b981] text-[#10b981] hover:bg-[#10b981]/5"}`}>
                    {cta}
                  </span>
                </Link>
              </m.div>
            ))}
          </StaggerGrid>

          <FadeUp delay={0.1} className="mt-8 text-center">
            <p className="text-sm text-[#45464d]">
              Need just one tool without a subscription?{" "}
              <Link href="/auth">
                <span className="text-[#10b981] hover:text-[#059669] cursor-pointer font-semibold underline underline-offset-2">Pay-as-you-go from $1.99</span>
              </Link>
              {" "}— credits never expire.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section id="testimonials" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 border-t border-[#e0e3e5] bg-[#e8f3ed]">
        <div className="max-w-7xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-[#10b981] text-sm font-bold uppercase tracking-widest mb-3">Student voices</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-[#131b2e]">From Nairobi to Cape Town to Lagos</h2>
              <p className="text-[#45464d] max-w-xl mx-auto text-sm sm:text-base">Real students. Real African universities. Real results.</p>
            </div>
          </FadeUp>

          <StaggerGrid className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {africanTestimonials.map(({ name, role, location, text, stars, flag }) => (
              <m.div key={name} variants={cardVariant} className="p-5 sm:p-6 rounded-xl bg-white border border-[#e0e3e5] shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
                <Quote size={16} className="text-[#10b981]/40 shrink-0" />
                <p className="text-sm text-[#45464d] leading-relaxed flex-1 italic">"{text}"</p>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <div className="border-t border-[#eceef0] pt-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{flag}</div>
                    <div>
                      <p className="text-[#191c1e] font-bold text-sm">{name}</p>
                      <p className="text-[#76777d] text-xs mt-0.5">{role}</p>
                      <div className="flex items-center gap-1 mt-1 text-[#76777d] text-xs">
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

      {/* ─── FINAL CTA — purple ─── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden bg-[#10b981] text-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-white/10 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <FadeUp>
            <h2 className="text-3xl sm:text-4xl md:text-[44px] font-bold mb-4 leading-tight" style={{ letterSpacing: "-0.02em" }}>
              200+ African universities · Mobile money accepted
            </h2>
            <p className="text-white/80 mb-8 text-base sm:text-lg max-w-lg mx-auto">
              Start today. Pay with your phone. Join 4 million+ students. No foreign card needed. Works on mobile data. Cancel anytime.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/auth">
                <span className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#10b981] hover:bg-[#e8f3ed] font-bold rounded-lg transition-all shadow-xl hover:-translate-y-0.5 text-sm sm:text-base cursor-pointer">
                  <Zap size={15} />
                  Create your free account
                </span>
              </Link>
              <a href="#tools" className="inline-flex items-center gap-2 px-8 py-4 border-2 border-white/60 hover:border-white text-white rounded-lg transition-all hover:bg-white/10 text-sm sm:text-base font-bold">
                See all tools
                <ArrowRight size={16} />
              </a>
            </div>
            <p className="text-white/60 text-xs mt-5">7-day money-back guarantee · No credit card required to sign up</p>
          </FadeUp>
        </div>
      </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="bg-[#eceef0] border-t border-[#e0e3e5] py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <Link href="/">
              <Logo size={24} textSize="text-sm" variant="light" className="cursor-pointer opacity-80 hover:opacity-100 transition-opacity" />
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-[#76777d]">
              <Link href="/about"><span className="hover:text-[#10b981] cursor-pointer transition-colors">About</span></Link>
              <Link href="/contact"><span className="hover:text-[#10b981] cursor-pointer transition-colors">Contact</span></Link>
              <Link href="/enterprise"><span className="hover:text-[#10b981] cursor-pointer transition-colors">For Institutions</span></Link>
              <Link href="/privacy"><span className="hover:text-[#10b981] cursor-pointer transition-colors">Privacy</span></Link>
              <Link href="/terms"><span className="hover:text-[#10b981] cursor-pointer transition-colors">Terms</span></Link>
            </div>
          </div>
          <div className="border-t border-[#d8dadc] pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[#76777d] text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
            <p className="text-[#76777d] text-xs">Empowering African academia.</p>
          </div>
        </div>
      </footer>
    </div>
    </LazyMotion>
  );
}
