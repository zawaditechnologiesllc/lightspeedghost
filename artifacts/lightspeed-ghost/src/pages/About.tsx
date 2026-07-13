import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight, Menu, X, GraduationCap, BookOpen, ShieldCheck,
  Database, Users, Globe2, Sparkles,
} from "lucide-react";
import { Logo } from "@/components/Logo";

// ── About — the LightSpeed Ghost story ─────────────────────────────────────────
// Light landing palette throughout: #f7f9fb bg · #131b2e ink · #6b38d4 primary.

const JOURNEY = [
  {
    year: "2023",
    title: "The dorm-room draft",
    body: "Finals week in Cambridge. Two Harvard students watch a generic AI invent citations for a psychology paper — confident, polished, and completely made up. They decide the problem isn't AI. It's AI that writes from memory instead of from research.",
  },
  {
    year: "2024",
    title: "The research engine ships",
    body: "LightSpeed Ghost launches with one hard rule: every claim traces to a real paper. The engine grows to 35+ live academic databases — OpenAlex, PubMed, JSTOR, Scopus, arXiv — with citation verification on every output.",
  },
  {
    year: "2025",
    title: "The full toolkit",
    body: "STEM Solver with step-by-step reasoning, the Study Assistant with persistent memory, revision against real rubrics, and the Humanizer. Four million students across 200+ universities make it their daily workspace.",
  },
  {
    year: "2026",
    title: "Beyond the classroom",
    body: "Ebook publishing brings the same research-grounded writing to 2.5M+ publishers on Amazon and every major platform. The creator program pays students to share the tool. The mission hasn't moved an inch: AI that delivers.",
  },
];

// To use real photos: drop an image at public/team/<slug>.jpg — it replaces
// the illustrated portrait automatically (no code change needed).
const LEADERS = [
  {
    slug: "michael-harrington", name: "Michael Harrington", role: "Co-founder & CEO",
    note: "Started the first draft the night a chatbot invented his bibliography.",
    from: "#6b38d4", to: "#0090a9", skin: "#f1c9a5", hair: "#3d2e26", shirt: "#131b2e", style: "short" as const,
  },
  {
    slug: "tyler-brooks", name: "Tyler Brooks", role: "Co-founder & CTO",
    note: "Built the 35-database research engine that makes every citation real.",
    from: "#0090a9", to: "#6b38d4", skin: "#e8b48c", hair: "#1f1a17", shirt: "#3b3f8f", style: "glasses" as const,
  },
  {
    slug: "james-caldwell", name: "James Caldwell", role: "Head of AI Research",
    note: "Owns the reasoning loop and the critic layer that checks the math.",
    from: "#5516be", to: "#a78bfa", skin: "#8d5a3b", hair: "#14100d", shirt: "#0f4c5c", style: "short" as const,
  },
  {
    slug: "emily-sanders", name: "Emily Sanders", role: "Head of Student Success",
    note: "Makes sure the tool earns its grade with real students, every semester.",
    from: "#a78bfa", to: "#0090a9", skin: "#f5d3b3", hair: "#6b4423", shirt: "#7a1f3d", style: "long" as const,
  },
];

// Flat-illustration portrait (brand-styled) with a real-photo drop-in path.
function Portrait({ slug, name, from, to, skin, hair, shirt, style }: (typeof LEADERS)[number]) {
  const [photoOk, setPhotoOk] = useState(true);
  const gid = `pg-${slug}`;
  return (
    <div className="w-24 h-24 rounded-full mx-auto mb-4 overflow-hidden shadow-md ring-4 ring-white">
      {photoOk ? (
        <img
          src={`/team/${slug}.jpg`}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setPhotoOk(false)}
        />
      ) : (
        <svg viewBox="0 0 96 96" className="w-full h-full block" role="img" aria-label={`Illustrated portrait of ${name}`}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <rect width="96" height="96" fill={`url(#${gid})`} opacity="0.9" />
          {/* shoulders / blazer */}
          <path d="M14 96 C14 74 32 65 48 65 C64 65 82 74 82 96 Z" fill={shirt} />
          <path d="M42 66 L48 78 L54 66 Z" fill="#f7f9fb" />
          {/* neck */}
          <rect x="41" y="50" width="14" height="16" rx="6" fill={skin} />
          {/* head */}
          <ellipse cx="48" cy="37" rx="16.5" ry="18.5" fill={skin} />
          {/* hair variants */}
          {style === "long" ? (
            <>
              <path d="M28 44 C26 18 40 12 48 12 C56 12 70 18 68 44 C70 56 66 62 62 64 L62 40 C62 30 56 24 48 24 C40 24 34 30 34 40 L34 64 C30 62 26 56 28 44 Z" fill={hair} />
              <path d="M34 30 C36 24 42 21 48 21 C54 21 60 24 62 30 C58 26 54 25 48 25 C42 25 38 26 34 30 Z" fill={hair} />
            </>
          ) : (
            <path d="M31 36 C30 20 39 13 48 13 C57 13 66 20 65 36 C64 29 59 24 48 24 C37 24 32 29 31 36 Z" fill={hair} />
          )}
          {style === "glasses" && (
            <g stroke="#131b2e" strokeWidth="1.6" fill="none" opacity="0.85">
              <circle cx="41" cy="38" r="5" />
              <circle cx="55" cy="38" r="5" />
              <line x1="46" y1="38" x2="50" y2="38" />
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

const STATS = [
  { icon: Users, value: "6.5M+", label: "Total users worldwide" },
  { icon: GraduationCap, value: "200+", label: "Universities represented" },
  { icon: Database, value: "10B+", label: "Indexed papers behind every output" },
  { icon: Globe2, value: "35+", label: "Live academic databases" },
];

export default function About() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: "Our story", href: "#story" },
    { label: "Journey", href: "#journey" },
    { label: "Leadership", href: "#leaders" },
    { label: "Contact", href: "/contact" },
  ];

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] antialiased overflow-x-hidden selection:bg-[#6b38d4]/20">
      {/* ─── NAV ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#e0e3e5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/"><Logo size={30} textSize="text-base" variant="light" className="cursor-pointer select-none shrink-0" /></Link>
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((i) => i.href.startsWith("#") ? (
              <a key={i.label} href={i.href} className="px-3.5 py-2 text-sm text-[#45464d] hover:text-[#6b38d4] rounded-lg hover:bg-[#f2f4f6] transition-colors">{i.label}</a>
            ) : (
              <Link key={i.label} href={i.href}><span className="px-3.5 py-2 text-sm text-[#45464d] hover:text-[#6b38d4] rounded-lg hover:bg-[#f2f4f6] transition-colors cursor-pointer">{i.label}</span></Link>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2.5">
            <Link href="/auth"><span className="px-5 py-2.5 text-sm bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-lg transition-colors cursor-pointer shadow-md shadow-[#6b38d4]/20">Get started</span></Link>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-[#45464d] rounded-lg hover:bg-[#f2f4f6]" aria-label="Menu">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-[#e0e3e5] px-4 py-4 space-y-1 shadow-lg">
            {navLinks.map((i) => i.href.startsWith("#") ? (
              <a key={i.label} href={i.href} onClick={() => setMobileOpen(false)} className="block px-3 py-3 text-sm text-[#45464d] hover:text-[#6b38d4] rounded-lg hover:bg-[#f2f4f6]">{i.label}</a>
            ) : (
              <Link key={i.label} href={i.href}><span onClick={() => setMobileOpen(false)} className="block px-3 py-3 text-sm text-[#45464d] hover:text-[#6b38d4] rounded-lg hover:bg-[#f2f4f6] cursor-pointer">{i.label}</span></Link>
            ))}
            <div className="pt-3 border-t border-[#e0e3e5] mt-2">
              <Link href="/auth"><span onClick={() => setMobileOpen(false)} className="block text-center px-4 py-2.5 text-sm bg-[#6b38d4] text-white font-semibold rounded-lg cursor-pointer">Get started</span></Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden pt-28 pb-12 sm:pt-32 sm:pb-16 px-4 sm:px-6">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(at 0% 0%, rgba(107,56,212,0.06) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(0,144,169,0.06) 0px, transparent 50%)" }} />
          <div className="relative max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e9ddff] text-[#5516be] text-xs font-bold uppercase tracking-wider mb-6">
              <Sparkles size={12} className="text-[#6b38d4]" /> Our story
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight mb-5 text-[#131b2e]" style={{ letterSpacing: "-0.02em" }}>
              Built by Harvard students tired of <span className="text-[#6b38d4]">AI that doesn't deliver.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#45464d] leading-relaxed max-w-2xl mx-auto">
              LightSpeed Ghost exists to end a very specific struggle: working with AI that sounds confident and gets you nowhere — invented citations, robotic prose, wrong math. We built the tool we needed and couldn't find.
            </p>
          </div>
        </section>

        {/* ─── THE PICTURE — where it started ─── */}
        <section className="px-4 sm:px-6 pb-14 sm:pb-20">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-[#e0e3e5] bg-white shadow-xl overflow-hidden">
              <svg viewBox="0 0 800 300" className="w-full h-auto block" role="img" aria-label="Illustration of a lit dorm window over Cambridge on the night LightSpeed Ghost was started">
                <defs>
                  <linearGradient id="ab-sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#131b2e" />
                    <stop offset="70%" stopColor="#2a2350" />
                    <stop offset="100%" stopColor="#5516be" />
                  </linearGradient>
                  <linearGradient id="ab-glow" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffd166" />
                    <stop offset="100%" stopColor="#ff9f68" />
                  </linearGradient>
                </defs>
                <rect width="800" height="300" fill="url(#ab-sky)" />
                {[[60, 40], [140, 70], [230, 30], [340, 60], [430, 25], [520, 55], [640, 35], [720, 70], [770, 45], [90, 110], [690, 105]].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2 : 1.3} fill="#ffffff" opacity={0.75} />
                ))}
                <circle cx="700" cy="60" r="22" fill="#f7f9fb" opacity="0.95" />
                <circle cx="692" cy="54" r="20" fill="url(#ab-sky)" opacity="0.55" />
                {/* Cambridge rooftops silhouette */}
                <path d="M0 240 L70 240 L70 190 L110 160 L150 190 L150 240 L230 240 L230 200 L260 200 L260 240 L330 240 L330 170 L370 140 L410 170 L410 240 L480 240 L480 210 L520 210 L520 240 L600 240 L600 185 L640 155 L680 185 L680 240 L800 240 L800 300 L0 300 Z" fill="#0d1322" />
                {/* clock-tower nod */}
                <rect x="362" y="98" width="16" height="46" fill="#0d1322" />
                <polygon points="358,100 382,100 370,78" fill="#0d1322" />
                <circle cx="370" cy="112" r="6" fill="#a78bfa" opacity="0.9" />
                {/* the one lit window */}
                <rect x="612" y="196" width="22" height="18" rx="2" fill="url(#ab-glow)">
                  <animate attributeName="opacity" values="1;0.75;1" dur="3.2s" repeatCount="indefinite" />
                </rect>
                <rect x="616" y="206" width="14" height="2.5" rx="1" fill="#7c2d12" />
                <rect x="618" y="201" width="7" height="5" rx="0.8" fill="#131b2e" />
                <polygon points="612,214 634,214 660,300 586,300" fill="url(#ab-glow)" opacity="0.14" />
              </svg>
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-[#e0e3e5] bg-[#f7f9fb]">
                <p className="text-xs text-[#45464d] font-medium">Cambridge, Massachusetts — finals week, spring 2023. One window stayed lit.</p>
                <p className="text-[11px] text-[#76777d]">The first prototype was finished before sunrise.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── STORY ─── */}
        <section id="story" className="py-14 sm:py-20 px-4 sm:px-6 bg-white border-y border-[#e0e3e5] scroll-mt-20">
          <div className="max-w-3xl mx-auto space-y-10">
            <div>
              <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3">Chapter one</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#131b2e] mb-4">The night it started</h2>
              <p className="text-[#45464d] leading-relaxed mb-4">
                It was finals week at Harvard, and a psychology paper was due in nine hours. The chatbot's draft looked perfect — until the citation check. Of twelve references, five didn't exist. Two more said the opposite of what the paper claimed. The prose read like a machine apologizing for itself, and a plagiarism scan flagged phrasing lifted from a textbook the AI had never actually read.
              </p>
              <p className="text-[#45464d] leading-relaxed">
                That night crystallized the problem: for students, an AI that's <em>almost</em> right is worse than no AI at all. Your grade, your integrity record, and your degree are on the line. "Sounds plausible" is not a standard you can submit.
              </p>
            </div>
            <div>
              <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3">Chapter two</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#131b2e] mb-4">The rule we set</h2>
              <p className="text-[#45464d] leading-relaxed mb-4">
                LightSpeed Ghost was built around one non-negotiable rule: <strong className="text-[#131b2e]">never write from memory.</strong> Every paragraph is grounded in real papers pulled live from 35+ academic databases. Every citation is verified against the actual source before it reaches you. Every STEM solution shows its method and is re-checked by a second critic layer. Every output is measured against your rubric — not a vibe.
              </p>
              <p className="text-[#45464d] leading-relaxed">
                That rule cost us months of engineering that a "chatbot wrapper" would have skipped. It's also the only reason the tool works.
              </p>
            </div>
            <div>
              <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3">Chapter three</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#131b2e] mb-4">What it became</h2>
              <p className="text-[#45464d] leading-relaxed">
                What started as one desperate prototype is now the academic workspace for 6.5 million people — 4M+ students at 200+ universities from MIT to Makerere, and 2.5M+ publishers writing research-grounded ebooks. The team is bigger, the databases are deeper, and the struggle we set out to end is ending: AI that delivers, with receipts.
              </p>
            </div>
          </div>
        </section>

        {/* ─── NUMBERS ─── */}
        <section className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map(({ icon: Icon, value, label }) => (
              <div key={label} className="rounded-2xl border border-[#e0e3e5] bg-white p-5 text-center shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#6b38d4]/10 flex items-center justify-center mx-auto mb-3"><Icon size={18} className="text-[#6b38d4]" /></div>
                <div className="text-2xl font-bold text-[#131b2e]">{value}</div>
                <div className="text-xs text-[#45464d] mt-1">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── JOURNEY ─── */}
        <section id="journey" className="py-14 sm:py-20 px-4 sm:px-6 bg-[#f2f4f6] border-y border-[#e0e3e5] scroll-mt-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3">The journey</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#131b2e]">From one lit window to 6.5M users</h2>
            </div>
            <div className="relative">
              <div className="absolute left-[19px] sm:left-1/2 top-2 bottom-2 w-px bg-[#d0bcff] sm:-translate-x-px" />
              <div className="space-y-8">
                {JOURNEY.map((j, i) => (
                  <div key={j.year} className={`relative flex flex-col sm:flex-row gap-4 sm:gap-10 ${i % 2 === 1 ? "sm:flex-row-reverse" : ""}`}>
                    <div className="absolute left-[11px] sm:left-1/2 sm:-translate-x-1/2 w-4 h-4 rounded-full bg-[#6b38d4] border-4 border-[#f2f4f6] mt-1.5" />
                    <div className="sm:w-1/2" />
                    <div className="sm:w-1/2 pl-10 sm:pl-0">
                      <div className="rounded-2xl border border-[#e0e3e5] bg-white p-5 shadow-sm text-left">
                        <span className="inline-block text-[11px] font-bold text-[#5516be] bg-[#e9ddff] rounded-full px-2.5 py-0.5 mb-2">{j.year}</span>
                        <h3 className="font-bold text-[#191c1e] mb-1.5">{j.title}</h3>
                        <p className="text-sm text-[#45464d] leading-relaxed">{j.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── LEADERSHIP ─── */}
        <section id="leaders" className="py-14 sm:py-20 px-4 sm:px-6 scroll-mt-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3">Leadership</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#131b2e]">The people keeping the rule</h2>
              <p className="text-[#45464d] text-sm mt-3 max-w-xl mx-auto">Students first, builders second. Everyone on this team has submitted a paper at 4 a.m. — that's the standard we build for.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {LEADERS.map((l) => (
                <div key={l.name} className="rounded-2xl border border-[#e0e3e5] bg-white p-5 shadow-sm text-center">
                  <Portrait {...l} />
                  <h3 className="font-bold text-[#191c1e]">{l.name}</h3>
                  <p className="text-[11px] font-semibold text-[#6b38d4] uppercase tracking-wide mb-2">{l.role}</p>
                  <p className="text-xs text-[#45464d] leading-relaxed">{l.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── MISSION STRIP ─── */}
        <section className="py-14 sm:py-20 px-4 sm:px-6 bg-white border-y border-[#e0e3e5]">
          <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-4">
            {[
              { icon: Database, t: "Grounded, always", d: "If we can't trace it to a real source, we don't write it. 10B+ indexed papers, verified citations, clickable DOIs." },
              { icon: ShieldCheck, t: "Your integrity first", d: "Plagiarism measured under 8% before delivery, AI-detection tools you run yourself, and revision that teaches." },
              { icon: BookOpen, t: "Every level, every subject", d: "High school to PhD, essays to dissertations, calculus to corporate finance — guardrails tuned to your level." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-[#e0e3e5] bg-[#f7f9fb] p-5">
                <div className="w-10 h-10 rounded-xl bg-[#6b38d4]/10 flex items-center justify-center mb-3"><Icon size={17} className="text-[#6b38d4]" /></div>
                <h3 className="font-bold text-[#191c1e] mb-1.5 text-sm">{t}</h3>
                <p className="text-xs text-[#45464d] leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden bg-[#131b2e] text-white">
          <div className="absolute inset-0 pointer-events-none"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#6b38d4]/20 rounded-full blur-[100px]" /></div>
          <div className="relative max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight" style={{ letterSpacing: "-0.02em" }}>Join the version of AI that delivers.</h2>
            <p className="text-[#9aa3bd] mb-8 text-base sm:text-lg">Real research. Verified citations. Shown work. The tool we wished existed that night in Cambridge.</p>
            <Link href="/auth">
              <span className="inline-flex items-center gap-2 px-8 py-4 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-bold rounded-lg transition-all cursor-pointer shadow-2xl hover:-translate-y-0.5 text-base">
                Get started free <ArrowRight size={18} />
              </span>
            </Link>
            <p className="text-[#9aa3bd]/70 text-xs mt-6">Questions? We actually respond — <a href="mailto:info@lightspeedghost.com" className="text-[#a78bfa] hover:text-white transition-colors">info@lightspeedghost.com</a>, usually within 24 hours.</p>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="bg-[#eceef0] border-t border-[#e0e3e5] py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/"><Logo size={24} textSize="text-sm" variant="light" className="cursor-pointer opacity-80 hover:opacity-100 transition-opacity" /></Link>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-[#76777d]">
            <Link href="/"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">Home</span></Link>
            <Link href="/careers"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">Careers</span></Link>
            <Link href="/contact"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">Contact</span></Link>
            <Link href="/terms"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">Terms</span></Link>
            <Link href="/privacy"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">Privacy</span></Link>
          </div>
          <p className="text-[#76777d] text-xs">© {new Date().getFullYear()} Light Speed Ghost · 500 Oracle Pkwy, Redwood City, CA 94065</p>
        </div>
      </footer>
    </div>
  );
}
