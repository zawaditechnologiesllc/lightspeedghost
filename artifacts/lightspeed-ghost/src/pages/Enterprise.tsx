import React, { useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  Zap, ArrowRight, CheckCircle, Menu, X,
  Building2, Users, BarChart3, ShieldCheck, Mail,
  Award, Clock, Lock,
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
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function StaggerGrid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{ visible: { transition: { staggerChildren: 0.08 } }, hidden: {} }}
    >
      {children}
    </motion.div>
  );
}

const cardVariant = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const tiers = [
  {
    name: "Department",
    seats: "50 – 200 students",
    price: "$5",
    per: "/ student / month",
    annual: "Billed annually",
    desc: "For academic departments, research groups, and small faculties.",
    features: [
      "All 7 AI tools for every seat",
      "Admin dashboard with usage overview",
      "Monthly usage reports",
      "Custom onboarding session",
      "Email support with 48h SLA",
      "Single invoice per billing period",
    ],
    cta: "Request a quote",
    highlight: false,
    badge: null,
    color: "border-white/8",
  },
  {
    name: "Faculty",
    seats: "200 – 1,000 students",
    price: "$4",
    per: "/ student / month",
    annual: "Billed annually",
    desc: "For faculties, schools, and large departments who want deeper analytics.",
    features: [
      "Everything in Department",
      "Per-student usage analytics",
      "Academic integrity reports + audit logs",
      "Dedicated onboarding + training",
      "Priority support with 24h SLA",
      "Usage-based spend alerts",
      "Custom integration options",
    ],
    cta: "Request a quote",
    highlight: true,
    badge: "Best value",
    color: "border-blue-500/40",
  },
  {
    name: "University",
    seats: "1,000+ students",
    price: "$3",
    per: "/ student / month + custom",
    annual: "Contact us for volume pricing",
    desc: "Enterprise agreement for entire universities, multi-campus institutions, and consortia.",
    features: [
      "Everything in Faculty",
      "Volume discount tiers",
      "Custom SLA and uptime guarantees",
      "Dedicated account manager",
      "Custom branding available",
      "SSO / SAML integration",
      "LMS integration support",
      "Quarterly business reviews",
    ],
    cta: "Contact sales",
    highlight: false,
    badge: "Custom pricing",
    color: "border-white/8",
  },
];

const valueProps = [
  { icon: Building2, title: "One invoice, zero admin", desc: "Stop chasing individual student receipts. We issue a single invoice per period for every seat — accounting-ready from day one.", color: "border-blue-500/20 bg-blue-500/5" },
  { icon: BarChart3, title: "Usage analytics dashboard", desc: "See which tools your students use most, how often, and where engagement drops off. Data to justify the budget every time.", color: "border-violet-500/20 bg-violet-500/5" },
  { icon: Users, title: "Dedicated support & onboarding", desc: "A real human walks your IT team through setup, trains faculty on the platform, and runs orientation sessions for students.", color: "border-emerald-500/20 bg-emerald-500/5" },
  { icon: ShieldCheck, title: "Academic integrity reporting", desc: "Download audit logs showing what was generated, when, and by which seat. Built for institutional compliance requirements.", color: "border-amber-500/20 bg-amber-500/5" },
  { icon: Award, title: "All tools, every seat", desc: "No tiered seat types. Every student in your cohort gets the full suite — paper writer, STEM solver, humanizer, plagiarism checker, everything.", color: "border-cyan-500/20 bg-cyan-500/5" },
  { icon: Clock, title: "SLA-backed uptime", desc: "We commit to uptime SLAs in writing. Enterprise customers get a dedicated status page and real-time incident notifications.", color: "border-orange-500/20 bg-orange-500/5" },
];

const toolList = [
  "AI Paper Writer — 25+ live academic databases, real DOI citations",
  "Outline Builder — structure any assignment in seconds",
  "Paper Revision — grade-targeted rewrites with rubric upload",
  "AI & Plagiarism Check — similarity detection across 99B+ sources",
  "STEM Solver — step-by-step with photo upload, all subjects",
  "AI Study Assistant — long-term memory tutoring",
  "Flashcards & Quizzes — auto-generated from any material",
];

type FormState = "idle" | "submitting" | "success" | "error";

export default function Enterprise() {
  const scrolled = useScrolled();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [form, setForm] = useState({
    institution: "",
    name: "",
    email: "",
    role: "",
    studentCount: "",
    message: "",
  });
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact/enterprise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? `Server error ${res.status}`);
      }
      setFormState("success");
    } catch (err) {
      setFormState("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  const inputClass = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-all";

  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased overflow-x-hidden">

      {/* ─── NAV ─── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#04080f]/95 backdrop-blur-md border-b border-white/5 shadow-lg" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/">
            <Logo size={30} textSize="text-base" className="cursor-pointer select-none shrink-0" />
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {[
              { label: "Why LightSpeed", href: "#why" },
              { label: "Tools", href: "#tools" },
              { label: "Pricing", href: "#pricing" },
              { label: "Contact", href: "#contact" },
            ].map((item) => (
              <a key={item.label} href={item.href} className="px-3.5 py-2 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2.5">
            <a href="#contact" className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors cursor-pointer">Request a quote</a>
            <a href="mailto:enterprise@lightspeedghost.com" className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors cursor-pointer shadow-md shadow-blue-600/20 whitespace-nowrap">
              Talk to sales
            </a>
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
            <motion.div
              className="md:hidden bg-[#04080f]/98 border-t border-white/8 px-4 py-4 space-y-1"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {[
                { label: "Why LightSpeed", href: "#why" },
                { label: "Tools", href: "#tools" },
                { label: "Pricing", href: "#pricing" },
                { label: "Contact", href: "#contact" },
              ].map((item) => (
                <a key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                  {item.label}
                </a>
              ))}
              <div className="pt-3 flex flex-col gap-2.5 border-t border-white/5 mt-2">
                <a href="#contact" onClick={() => setMobileOpen(false)} className="block text-center px-4 py-2.5 text-sm border border-white/15 text-white rounded-lg hover:bg-white/5 transition-colors">Request a quote</a>
                <a href="mailto:enterprise@lightspeedghost.com" className="block text-center px-4 py-2.5 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors">Talk to sales</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-20 pb-12 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[500px] bg-blue-600/15 rounded-full blur-[140px]" />
          <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[110px]" />
          <div className="absolute top-1/3 -right-20 w-[350px] h-[350px] bg-cyan-500/8 rounded-full blur-[100px]" />
        </div>

        <motion.div
          className="relative max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6 sm:mb-8">
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <Building2 size={11} className="text-blue-400" />
              Institutional licensing
            </motion.div>
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              200+ universities already using LightSpeed Ghost
            </motion.div>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-5 sm:mb-6">
            LightSpeed Ghost{" "}
            <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
              for Institutions
            </span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-white/55 max-w-2xl mx-auto leading-relaxed mb-8 sm:mb-10">
            Equip every student with AI tools at a fraction of the cost. Custom pricing from $3/student/month for 500+ seats. One invoice. Dedicated support. Usage analytics dashboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <a href="#contact" className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-xl shadow-blue-600/25 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-100 text-sm sm:text-base">
              <Zap size={15} />
              Request a quote
            </a>
            <a href="mailto:enterprise@lightspeedghost.com" className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/20 hover:border-white/35 text-white/80 hover:text-white rounded-xl transition-all hover:bg-white/5 text-sm sm:text-base">
              <Mail size={15} />
              Talk to sales
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-6">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs">
              <span className="text-blue-400 font-bold">$3/student/mo</span>
              <span className="text-white/40">for 500+ seats</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <span className="text-emerald-400 font-bold">1 invoice</span>
              <span className="text-white/40">per billing period</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs">
              <span className="text-violet-400 font-bold">All 7 tools</span>
              <span className="text-white/40">every seat</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── SOCIAL PROOF STRIP ─── */}
      <section className="border-y border-white/5 bg-white/[0.015] py-4 sm:py-5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-5 text-center">
            <span className="text-[10px] font-semibold text-white/22 uppercase tracking-[0.2em] shrink-0">Trusted by institutions at</span>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
              {["MIT","UCL","Georgia Tech","Edinburgh","Columbia","Nairobi","Witwatersrand","Makerere","Lagos","Melbourne","Toronto"].map(uni => (
                <span key={uni} className="text-[11px] font-medium text-white/38 hover:text-white/60 transition-colors cursor-default">{uni}</span>
              ))}
            </div>
            <span className="text-[10px] font-medium text-blue-400/50 shrink-0 whitespace-nowrap">+ 200 more</span>
          </div>
        </div>
      </section>

      {/* ─── VALUE PROPS ─── */}
      <section id="why" className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-3">Why institutions choose us</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything admins and faculty actually need</h2>
              <p className="text-white/45 text-sm sm:text-base max-w-xl mx-auto">
                From a single invoice to per-student usage analytics, we've designed the platform from the ground up to work at institutional scale.
              </p>
            </div>
          </FadeUp>

          <StaggerGrid className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {valueProps.map(({ icon: Icon, title, desc, color }) => (
              <motion.div key={title} variants={cardVariant} className={`rounded-xl border p-5 sm:p-6 ${color}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 border border-white/10 bg-white/5">
                  <Icon size={18} className="text-white/60" />
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ─── TOOLS ─── */}
      <section id="tools" className="py-14 sm:py-18 px-4 sm:px-6 border-y border-white/5 bg-gradient-to-b from-[#04080f] to-[#060d1a]">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10">
              <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-3">What your students get</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Seven purpose-built academic AI tools</h2>
              <p className="text-white/45 text-sm sm:text-base max-w-xl mx-auto">
                Every seat gets access to the full suite — no tool-level upsells, no per-use charges within the license.
              </p>
            </div>
          </FadeUp>

          <StaggerGrid className="grid sm:grid-cols-2 gap-3">
            {toolList.map((tool) => (
              <motion.div key={tool} variants={cardVariant} className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/8">
                <CheckCircle size={15} className="text-blue-400 shrink-0 mt-0.5" />
                <span className="text-sm text-white/70">{tool}</span>
              </motion.div>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ─── PRICING TIERS ─── */}
      <section id="pricing" className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-3">Institutional pricing</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Volume pricing that scales with your cohort</h2>
              <p className="text-white/45 text-sm sm:text-base max-w-xl mx-auto">
                All tiers billed annually with a single invoice. No per-tool charges. Contact us for custom payment terms.
              </p>
            </div>
          </FadeUp>

          <StaggerGrid className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {tiers.map(({ name, seats, price, per, annual, desc, features, cta, highlight, badge, color }) => (
              <motion.div
                key={name}
                variants={cardVariant}
                className={`relative rounded-2xl border p-6 sm:p-7 flex flex-col ${color} ${highlight ? "bg-blue-500/5 shadow-xl shadow-blue-900/20" : "bg-white/[0.025]"}`}
              >
                {badge && (
                  <span className={`absolute -top-3 left-6 text-xs font-semibold px-3 py-1 rounded-full ${highlight ? "bg-blue-500 text-white" : "bg-white/10 text-white/60 border border-white/10"}`}>
                    {badge}
                  </span>
                )}
                <h3 className="text-lg font-bold text-white mb-1">{name}</h3>
                <p className="text-xs text-blue-400/70 font-medium mb-3">{seats}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-white">{price}</span>
                  <span className="text-white/40 text-sm">{per}</span>
                </div>
                <p className="text-[11px] text-white/30 mb-4">{annual}</p>
                <p className="text-sm text-white/50 mb-5 leading-relaxed">{desc}</p>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/65">
                      <CheckCircle size={14} className="text-blue-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="#contact" className={`block text-center py-2.5 rounded-xl font-semibold text-sm transition-all ${highlight ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20" : "border border-white/15 text-white/70 hover:text-white hover:border-white/30 hover:bg-white/5"}`}>
                  {cta}
                </a>
              </motion.div>
            ))}
          </StaggerGrid>

          <FadeUp delay={0.1} className="mt-10">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 sm:p-8 text-center">
              <p className="text-white/50 text-sm mb-1">Not sure which tier fits? We'll work it out together.</p>
              <p className="text-white font-semibold mb-4">All quotes include a 30-day free pilot for up to 50 students.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href="#contact" className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all text-sm">
                  <Zap size={14} />
                  Request a quote
                </a>
                <a href="mailto:enterprise@lightspeedghost.com" className="inline-flex items-center gap-2 px-6 py-2.5 border border-white/15 text-white/60 hover:text-white hover:border-white/30 rounded-xl transition-all text-sm">
                  <Mail size={14} />
                  enterprise@lightspeedghost.com
                </a>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ─── CONTACT FORM ─── */}
      <section id="contact" className="py-14 sm:py-20 px-4 sm:px-6 border-t border-white/5 bg-gradient-to-b from-[#060d1a] to-[#04080f]">
        <div className="max-w-2xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10">
              <p className="text-blue-400 text-sm font-medium uppercase tracking-widest mb-3">Get in touch</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Request a quote</h2>
              <p className="text-white/45 text-sm sm:text-base">
                Fill in the form and we'll get back to you within one business day with a tailored proposal.
              </p>
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            {formState === "success" ? (
              <motion.div
                className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-10 text-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={24} className="text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Message received</h3>
                <p className="text-white/55 text-sm leading-relaxed max-w-sm mx-auto">
                  We'll review your enquiry and get back to you within one business day with a custom proposal.
                </p>
                <p className="text-white/30 text-xs mt-4">
                  In the meantime, email us directly at{" "}
                  <a href="mailto:enterprise@lightspeedghost.com" className="text-blue-400 hover:underline">enterprise@lightspeedghost.com</a>
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/8 bg-white/[0.025] p-6 sm:p-8">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Institution name <span className="text-blue-400">*</span></label>
                    <input
                      required
                      name="institution"
                      value={form.institution}
                      onChange={handleChange}
                      placeholder="University of..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Your name <span className="text-blue-400">*</span></label>
                    <input
                      required
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Full name"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Email address <span className="text-blue-400">*</span></label>
                    <input
                      required
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="you@university.edu"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Your role <span className="text-blue-400">*</span></label>
                    <select
                      required
                      name="role"
                      value={form.role}
                      onChange={handleChange}
                      className={`${inputClass} appearance-none`}
                    >
                      <option value="" disabled>Select role...</option>
                      <option value="Dean">Dean</option>
                      <option value="Registrar">Registrar</option>
                      <option value="IT">IT / Technology</option>
                      <option value="Faculty">Faculty / Lecturer</option>
                      <option value="Student Union">Student Union</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Estimated student count <span className="text-blue-400">*</span></label>
                  <input
                    required
                    name="studentCount"
                    value={form.studentCount}
                    onChange={handleChange}
                    placeholder="e.g. 500"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Message</label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Tell us about your use case, timeline, or any specific requirements..."
                    className={`${inputClass} resize-none`}
                  />
                </div>

                {formState === "error" && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {errorMsg || "Something went wrong. Please try again or email us directly."}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={formState === "submitting"}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm"
                >
                  {formState === "submitting" ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <ArrowRight size={15} />
                      Send enquiry
                    </>
                  )}
                </button>

                <p className="text-center text-white/20 text-xs">
                  Or email us directly:{" "}
                  <a href="mailto:enterprise@lightspeedghost.com" className="text-blue-400/70 hover:text-blue-300 transition-colors">
                    enterprise@lightspeedghost.com
                  </a>
                </p>
              </form>
            )}
          </FadeUp>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-950/15" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/8 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <FadeUp>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-8 text-sm text-white/40">
              <div className="flex items-center gap-2">
                <Lock size={13} className="text-white/25" />
                <span>SOC 2-ready data practices</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-white/10" />
              <div className="flex items-center gap-2">
                <ShieldCheck size={13} className="text-white/25" />
                <span>Academic integrity reporting</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-white/10" />
              <div className="flex items-center gap-2">
                <Award size={13} className="text-white/25" />
                <span>SLA-backed uptime</span>
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-5 leading-tight">
              Ready to equip your{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                entire student body?
              </span>
            </h2>
            <p className="text-white/50 mb-8 text-base sm:text-lg max-w-lg mx-auto">
              200+ universities already trust LightSpeed Ghost. Start with a free 30-day pilot for up to 50 students.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="#contact" className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-xl shadow-blue-600/25 hover:scale-[1.02] active:scale-100 text-sm sm:text-base">
                <Zap size={15} />
                Request a quote
              </a>
              <a href="mailto:enterprise@lightspeedghost.com" className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/20 hover:border-white/35 text-white/70 hover:text-white rounded-xl transition-all hover:bg-white/5 text-sm sm:text-base">
                <Mail size={15} />
                Contact sales directly
              </a>
            </div>
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
              <Link href="/africa"><span className="hover:text-white/55 cursor-pointer transition-colors">For African Students</span></Link>
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
  );
}
