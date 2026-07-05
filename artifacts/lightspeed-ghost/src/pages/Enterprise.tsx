import React, { useState, useRef } from "react";
import { m, LazyMotion, domAnimation, useInView, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  Zap, ArrowRight, CheckCircle, Menu, X,
  Building2, Users, BarChart3, ShieldCheck, Mail,
  Award, Clock, Lock, TrendingUp, Receipt, Headset,
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
  },
];

const valueProps = [
  { icon: BarChart3, title: "Usage analytics dashboard", desc: "See which tools your students use most, how often, and where engagement drops off. Data to justify the budget every time.", featured: true },
  { icon: Receipt, title: "One invoice, zero admin", desc: "Stop chasing individual student receipts. We issue a single invoice per period for every seat — accounting-ready from day one.", dark: true },
  { icon: Headset, title: "Dedicated support & onboarding", desc: "A real human walks your IT team through setup, trains faculty on the platform, and runs orientation sessions for students." },
  { icon: ShieldCheck, title: "Academic integrity reporting", desc: "Download audit logs showing what was generated, when, and by which seat. Built for institutional compliance requirements." },
  { icon: Award, title: "All tools, every seat", desc: "No tiered seat types. Every student in your cohort gets the full suite — paper writer, STEM solver, humanizer, plagiarism checker, everything." },
  { icon: Clock, title: "SLA-backed uptime", desc: "We commit to uptime SLAs in writing. Enterprise customers get a dedicated status page and real-time incident notifications." },
];

const toolList = [
  { name: "AI Paper Writer", note: "25+ live academic databases, real DOI citations" },
  { name: "Outline Builder", note: "Structure any assignment in seconds" },
  { name: "Paper Revision", note: "Grade-targeted rewrites with rubric upload" },
  { name: "AI & Plagiarism Check", note: "Similarity detection across 99B+ sources" },
  { name: "STEM Solver", note: "Step-by-step with photo upload, all subjects" },
  { name: "AI Study Assistant", note: "Long-term memory tutoring" },
  { name: "Flashcards & Quizzes", note: "Auto-generated from any material" },
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
      const apiBase = (import.meta.env.VITE_API_URL ?? "") + "/api";
      const res = await fetch(`${apiBase}/contact/enterprise`, {
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

  const inputClass = "w-full bg-white border border-[#c6c6cd] rounded-lg px-4 py-3 text-[#191c1e] text-sm placeholder:text-[#76777d] focus:outline-none focus:border-[#6b38d4] focus:ring-1 focus:ring-[#6b38d4] transition-all";

  return (
    <LazyMotion features={domAnimation}>
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] antialiased overflow-x-hidden selection:bg-[#6b38d4]/20">

      {/* ─── NAV ─── */}
      <header className={`fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#e0e3e5] transition-all duration-300 ${scrolled ? "shadow-md bg-white/95 backdrop-blur-md" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/">
            <Logo size={30} textSize="text-base" variant="light" className="cursor-pointer select-none shrink-0" />
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {[
              { label: "Why LightSpeed", href: "#why" },
              { label: "Tools", href: "#tools" },
              { label: "Pricing", href: "#pricing" },
              { label: "Contact", href: "#contact" },
            ].map((item) => (
              <a key={item.label} href={item.href} className="px-3.5 py-2 text-sm text-[#45464d] hover:text-[#6b38d4] rounded-lg hover:bg-[#f2f4f6] transition-colors whitespace-nowrap">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2.5">
            <a href="#contact" className="px-4 py-2 text-sm text-[#45464d] hover:text-[#6b38d4] transition-colors cursor-pointer">Talk to sales</a>
            <a href="#contact" className="px-5 py-2.5 text-sm bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-lg transition-colors cursor-pointer shadow-md shadow-[#6b38d4]/20 whitespace-nowrap">
              Request a quote
            </a>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-[#45464d] hover:text-[#191c1e] rounded-lg hover:bg-[#f2f4f6] transition-colors"
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
              {[
                { label: "Why LightSpeed", href: "#why" },
                { label: "Tools", href: "#tools" },
                { label: "Pricing", href: "#pricing" },
                { label: "Contact", href: "#contact" },
              ].map((item) => (
                <a key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-3 text-sm text-[#45464d] hover:text-[#6b38d4] rounded-lg hover:bg-[#f2f4f6] transition-colors">
                  {item.label}
                </a>
              ))}
              <div className="pt-3 flex flex-col gap-2.5 border-t border-[#e0e3e5] mt-2">
                <a href="#contact" onClick={() => setMobileOpen(false)} className="block text-center px-4 py-2.5 text-sm border border-[#c6c6cd] text-[#191c1e] rounded-lg hover:bg-[#f2f4f6] transition-colors">Talk to sales</a>
                <a href="#contact" onClick={() => setMobileOpen(false)} className="block text-center px-4 py-2.5 text-sm bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-lg transition-colors">Request a quote</a>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden pt-28 pb-14 sm:pt-32 sm:pb-20 px-4 sm:px-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(at 0% 0%, rgba(107, 56, 212, 0.06) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(0, 144, 169, 0.06) 0px, transparent 50%)",
          }}
        />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center relative">
          <m.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e9ddff] text-[#5516be] text-xs font-bold uppercase tracking-wider mb-6">
              <Building2 size={14} />
              Enterprise Grade Academic Intelligence
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-bold leading-[1.05] tracking-tight mb-5 text-[#131b2e]" style={{ letterSpacing: "-0.02em" }}>
              Institutional <span className="text-[#6b38d4]">licensing.</span>
            </h1>

            <p className="text-base sm:text-lg text-[#45464d] max-w-xl leading-relaxed mb-8">
              200+ universities already using LightSpeed Ghost. Equip every student with AI tools at a fraction of the cost. Dedicated support and one invoice for your entire institution.
            </p>

            {/* Stat bars */}
            <div className="flex flex-wrap gap-6 mb-8">
              <div className="flex flex-col border-l-4 border-[#6b38d4] pl-4">
                <span className="text-lg font-bold text-[#131b2e]">$3/student/mo</span>
                <span className="text-xs text-[#76777d]">for 500+ seats</span>
              </div>
              <div className="flex flex-col border-l-4 border-[#c6c6cd] pl-4">
                <span className="text-lg font-bold text-[#131b2e]">1 Invoice</span>
                <span className="text-xs text-[#76777d]">per billing period</span>
              </div>
              <div className="flex flex-col border-l-4 border-[#c6c6cd] pl-4">
                <span className="text-lg font-bold text-[#131b2e]">All 7 Tools</span>
                <span className="text-xs text-[#76777d]">included every seat</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <a href="#contact" className="inline-flex items-center gap-2 px-7 py-4 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-bold rounded-lg transition-all shadow-lg shadow-[#6b38d4]/25 hover:-translate-y-0.5 text-sm sm:text-base">
                <Zap size={15} />
                Start 30-Day Pilot
              </a>
              <a href="#pricing" className="inline-flex items-center gap-2 px-7 py-4 border border-[#76777d] hover:border-[#6b38d4] text-[#191c1e] hover:text-[#6b38d4] font-bold rounded-lg transition-all hover:bg-[#eceef0] text-sm sm:text-base">
                See pricing
              </a>
            </div>
          </m.div>

          {/* Dashboard mockup */}
          <m.div
            className="relative"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="absolute -inset-4 bg-[#e9ddff]/40 rounded-[2rem] blur-2xl pointer-events-none" />
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-[#e0e3e5] bg-white">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[#e0e3e5] bg-[#f2f4f6]">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs text-[#45464d] font-mono">admin.lightspeedghost.com</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-[#76777d] uppercase tracking-wider font-semibold">Institution overview</p>
                    <p className="text-sm font-bold text-[#191c1e]">University of Nairobi · 1,240 seats</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Active</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Active seats", value: "1,182", color: "text-[#6b38d4]" },
                    { label: "Tools used", value: "7 / 7", color: "text-emerald-600" },
                    { label: "Uptime", value: "99.9%", color: "text-blue-600" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-lg border border-[#e0e3e5] bg-[#f7f9fb] p-3">
                      <p className={`text-lg font-bold ${color}`}>{value}</p>
                      <p className="text-[9px] text-[#76777d] uppercase tracking-wide">{label}</p>
                    </div>
                  ))}
                </div>
                {/* Fake bar chart */}
                <div className="rounded-lg border border-[#e0e3e5] bg-[#f7f9fb] p-4">
                  <div className="flex items-end justify-between gap-2 h-24">
                    {[40, 65, 52, 80, 72, 95, 60].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t bg-[#6b38d4]" style={{ height: `${h}%`, opacity: 0.35 + (h / 200) }} />
                    ))}
                  </div>
                  <p className="text-[9px] text-[#76777d] mt-2 text-center">Weekly tool adoption — last 7 weeks</p>
                </div>
              </div>
            </div>
          </m.div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF STRIP ─── */}
      <section className="border-y border-[#e0e3e5] bg-[#f2f4f6] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-[11px] font-semibold text-[#76777d] uppercase tracking-[0.2em] text-center mb-5">Trusted by leading global institutions</p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 sm:gap-x-12 gap-y-3 opacity-70">
            {["MIT","UCL","Georgia Tech","Columbia","Toronto","Melbourne","Makerere","Nairobi"].map(uni => (
              <span key={uni} className="text-sm sm:text-lg font-bold text-[#45464d]">{uni}</span>
            ))}
            <span className="text-xs font-semibold text-[#6b38d4]">+200 more</span>
          </div>
        </div>
      </section>

      {/* ─── VALUE PROPS — bento grid ─── */}
      <section id="why" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-[#131b2e]">Why institutions choose us</h2>
              <p className="text-[#45464d] text-sm sm:text-base max-w-xl mx-auto">
                Everything admins and faculty actually need to deploy AI responsibly at scale.
              </p>
            </div>
          </FadeUp>

          <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {valueProps.map(({ icon: Icon, title, desc, featured, dark }) => {
              if (featured) {
                return (
                  <m.div key={title} variants={cardVariant} className="md:col-span-2 rounded-2xl border border-[#e0e3e5] bg-white p-6 sm:p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      <div className="w-12 h-12 rounded-xl bg-[#6b38d4]/10 flex items-center justify-center mb-5">
                        <Icon size={24} className="text-[#6b38d4]" />
                      </div>
                      <h3 className="text-xl font-bold text-[#191c1e] mb-2">{title}</h3>
                      <p className="text-sm text-[#45464d] leading-relaxed max-w-md">{desc}</p>
                    </div>
                    <div className="mt-8 pt-4 border-t border-[#e0e3e5] flex justify-between items-center">
                      <span className="text-xs font-bold text-[#6b38d4] uppercase tracking-widest">Real-time reporting</span>
                      <TrendingUp size={18} className="text-[#6b38d4]" />
                    </div>
                  </m.div>
                );
              }
              if (dark) {
                return (
                  <m.div key={title} variants={cardVariant} className="rounded-2xl bg-[#131b2e] text-white p-6 sm:p-7 flex flex-col hover:scale-[1.02] transition-transform">
                    <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                      <Icon size={22} className="text-[#a78bfa]" />
                    </div>
                    <h3 className="font-bold mb-2">{title}</h3>
                    <p className="text-sm text-white/70 leading-relaxed">{desc}</p>
                  </m.div>
                );
              }
              return (
                <m.div key={title} variants={cardVariant} className="rounded-2xl border border-[#e0e3e5] bg-white p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-[#6b38d4]/40 transition-all">
                  <div className="w-11 h-11 rounded-xl bg-[#6b38d4]/10 flex items-center justify-center mb-4">
                    <Icon size={22} className="text-[#6b38d4]" />
                  </div>
                  <h3 className="font-bold text-[#191c1e] mb-2">{title}</h3>
                  <p className="text-sm text-[#45464d] leading-relaxed">{desc}</p>
                </m.div>
              );
            })}
          </StaggerGrid>
        </div>
      </section>

      {/* ─── TOOLS ─── */}
      <section id="tools" className="py-14 sm:py-20 px-4 sm:px-6 border-y border-[#e0e3e5] bg-[#f2f4f6]">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-10 sm:mb-12">
              <div className="max-w-xl">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-[#131b2e]">What your students get</h2>
                <p className="text-[#45464d] text-sm sm:text-base">
                  Seven purpose-built academic AI tools designed to enhance learning and research productivity without compromising academic rigor. Every seat gets the full suite — no tool-level upsells.
                </p>
              </div>
              <Link href="/">
                <span className="inline-flex items-center gap-2 px-5 py-3 bg-[#131b2e] text-white rounded-full text-sm font-semibold hover:bg-[#26304a] transition-all cursor-pointer whitespace-nowrap">
                  View Toolset Documentation
                  <ArrowRight size={16} />
                </span>
              </Link>
            </div>
          </FadeUp>

          <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {toolList.map(({ name, note }) => (
              <m.div key={name} variants={cardVariant} className="group bg-white p-5 rounded-xl border border-[#e0e3e5] shadow-sm hover:border-[#6b38d4] hover:shadow-md transition-all flex flex-col gap-3">
                <div className="w-11 h-11 rounded-full bg-[#e9ddff] flex items-center justify-center text-[#6b38d4] group-hover:bg-[#6b38d4] group-hover:text-white transition-all">
                  <CheckCircle size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-[#191c1e] text-sm mb-1">{name}</h3>
                  <p className="text-xs text-[#45464d] leading-relaxed">{note}</p>
                </div>
              </m.div>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ─── PRICING TIERS ─── */}
      <section id="pricing" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3">Institutional pricing</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-[#131b2e]">Volume pricing that scales with your cohort</h2>
              <p className="text-[#45464d] text-sm sm:text-base max-w-xl mx-auto">
                All tiers billed annually with a single invoice. No hidden fees, just transparent academic value. Contact us for custom payment terms.
              </p>
            </div>
          </FadeUp>

          <StaggerGrid className="grid md:grid-cols-3 gap-5 sm:gap-6 items-start">
            {tiers.map(({ name, seats, price, per, annual, desc, features, cta, highlight, badge }) => (
              <m.div
                key={name}
                variants={cardVariant}
                className={`relative rounded-2xl p-6 sm:p-7 flex flex-col ${highlight ? "bg-[#131b2e] text-white shadow-2xl md:-mt-4 md:mb-4" : "bg-white border border-[#e0e3e5] shadow-sm"}`}
              >
                {badge && (
                  <span className={`absolute -top-3 left-6 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide ${highlight ? "bg-[#6b38d4] text-white" : "bg-[#eceef0] text-[#45464d] border border-[#d8dadc]"}`}>
                    {badge}
                  </span>
                )}
                <h3 className={`text-lg font-bold mb-1 ${highlight ? "text-white" : "text-[#191c1e]"}`}>{name}</h3>
                <p className={`text-xs font-medium mb-3 ${highlight ? "text-[#a78bfa]" : "text-[#6b38d4]"}`}>{seats}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-4xl font-bold ${highlight ? "text-white" : "text-[#131b2e]"}`}>{price}</span>
                  <span className={`text-sm ${highlight ? "text-white/60" : "text-[#76777d]"}`}>{per}</span>
                </div>
                <p className={`text-[11px] mb-4 ${highlight ? "text-white/50" : "text-[#76777d]"}`}>{annual}</p>
                <p className={`text-sm mb-5 leading-relaxed ${highlight ? "text-white/70" : "text-[#45464d]"}`}>{desc}</p>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-sm ${highlight ? "text-white/85" : "text-[#45464d]"}`}>
                      <CheckCircle size={14} className={`shrink-0 mt-0.5 ${highlight ? "text-[#a78bfa]" : "text-[#6b38d4]"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="#contact" className={`block text-center py-3 rounded-lg font-bold text-sm transition-all ${highlight ? "bg-[#6b38d4] hover:bg-[#5b2fc0] text-white shadow-lg shadow-[#6b38d4]/30" : "border border-[#6b38d4] text-[#6b38d4] hover:bg-[#6b38d4]/5"}`}>
                  {cta}
                </a>
              </m.div>
            ))}
          </StaggerGrid>

          <FadeUp delay={0.1} className="mt-10">
            <div className="rounded-2xl border border-[#e0e3e5] bg-white p-6 sm:p-8 text-center shadow-sm">
              <p className="text-[#45464d] text-sm mb-1">Not sure which tier fits? We'll work it out together.</p>
              <p className="text-[#191c1e] font-bold mb-4">All quotes include a 30-day free pilot for up to 50 students.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href="#contact" className="inline-flex items-center gap-2 px-6 py-3 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-lg transition-all text-sm shadow-md shadow-[#6b38d4]/20">
                  <Zap size={14} />
                  Request a quote
                </a>
                <a href="mailto:enterprise@lightspeedghost.com" className="inline-flex items-center gap-2 px-6 py-3 border border-[#c6c6cd] text-[#45464d] hover:text-[#6b38d4] hover:border-[#6b38d4] rounded-lg transition-all text-sm">
                  <Mail size={14} />
                  enterprise@lightspeedghost.com
                </a>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ─── CONTACT FORM ─── */}
      <section id="contact" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 border-t border-[#e0e3e5] bg-[#f2f4f6]">
        <div className="max-w-2xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10">
              <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3">Get in touch</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-[#131b2e]">Request a quote</h2>
              <p className="text-[#45464d] text-sm sm:text-base">
                Fill in the form and we'll get back to you within one business day with a tailored proposal for your institution.
              </p>
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            {formState === "success" ? (
              <m.div
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={24} className="text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-[#191c1e] mb-2">Message received</h3>
                <p className="text-[#45464d] text-sm leading-relaxed max-w-sm mx-auto">
                  We'll review your enquiry and get back to you within one business day with a custom proposal.
                </p>
                <p className="text-[#76777d] text-xs mt-4">
                  In the meantime, email us directly at{" "}
                  <a href="mailto:enterprise@lightspeedghost.com" className="text-[#6b38d4] hover:underline">enterprise@lightspeedghost.com</a>
                </p>
              </m.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-[#e0e3e5] bg-white p-6 sm:p-8 shadow-sm">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#45464d] mb-1.5">Institution name <span className="text-[#6b38d4]">*</span></label>
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
                    <label className="block text-xs font-semibold text-[#45464d] mb-1.5">Your name <span className="text-[#6b38d4]">*</span></label>
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
                    <label className="block text-xs font-semibold text-[#45464d] mb-1.5">Email address <span className="text-[#6b38d4]">*</span></label>
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
                    <label className="block text-xs font-semibold text-[#45464d] mb-1.5">Your role <span className="text-[#6b38d4]">*</span></label>
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
                  <label className="block text-xs font-semibold text-[#45464d] mb-1.5">Estimated student count <span className="text-[#6b38d4]">*</span></label>
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
                  <label className="block text-xs font-semibold text-[#45464d] mb-1.5">Message</label>
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
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                    {errorMsg || "Something went wrong. Please try again or email us directly."}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={formState === "submitting"}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#6b38d4] hover:bg-[#5b2fc0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-md shadow-[#6b38d4]/20 text-sm"
                >
                  {formState === "submitting" ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <ArrowRight size={15} />
                      Request Quote
                    </>
                  )}
                </button>

                <p className="text-center text-[#76777d] text-xs">
                  Or email us directly:{" "}
                  <a href="mailto:enterprise@lightspeedghost.com" className="text-[#6b38d4] hover:text-[#5b2fc0] transition-colors">
                    enterprise@lightspeedghost.com
                  </a>
                </p>
              </form>
            )}
          </FadeUp>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden bg-[#131b2e] text-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#6b38d4]/20 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <FadeUp>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-8 text-sm text-white/50">
              <div className="flex items-center gap-2">
                <Lock size={13} className="text-white/40" />
                <span>SOC 2-ready data practices</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-white/15" />
              <div className="flex items-center gap-2">
                <ShieldCheck size={13} className="text-white/40" />
                <span>Academic integrity reporting</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-white/15" />
              <div className="flex items-center gap-2">
                <Award size={13} className="text-white/40" />
                <span>SLA-backed uptime</span>
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5 leading-tight" style={{ letterSpacing: "-0.02em" }}>
              Ready to equip your entire student body?
            </h2>
            <p className="text-white/60 mb-8 text-base sm:text-lg max-w-lg mx-auto">
              Join 200+ universities that already trust LightSpeed Ghost to bridge the gap between traditional learning and AI-assisted excellence. Start with a free 30-day pilot for up to 50 students.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="#contact" className="inline-flex items-center gap-2 px-8 py-4 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-bold rounded-lg transition-all shadow-2xl hover:-translate-y-0.5 text-sm sm:text-base">
                <Zap size={15} />
                Start Free 30-Day Pilot
              </a>
              <a href="mailto:enterprise@lightspeedghost.com" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#131b2e] hover:bg-[#eceef0] rounded-lg transition-all text-sm sm:text-base font-bold">
                <Mail size={15} />
                Talk to Academic Sales
              </a>
            </div>
            <p className="text-white/40 text-xs mt-5">No credit card required for the pilot. Full technical support included.</p>
          </FadeUp>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-[#eceef0] border-t border-[#e0e3e5] py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <Link href="/">
              <Logo size={24} textSize="text-sm" variant="light" className="cursor-pointer opacity-80 hover:opacity-100 transition-opacity" />
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-[#76777d]">
              <Link href="/about"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">About</span></Link>
              <Link href="/contact"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">Contact</span></Link>
              <Link href="/africa"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">For African Students</span></Link>
              <Link href="/privacy"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">Privacy</span></Link>
              <Link href="/terms"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">Terms</span></Link>
            </div>
          </div>
          <div className="border-t border-[#d8dadc] pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[#76777d] text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
            <p className="text-[#76777d] text-xs">Academic Excellence &amp; High-Trust Innovation.</p>
          </div>
        </div>
      </footer>
    </div>
    </LazyMotion>
  );
}
