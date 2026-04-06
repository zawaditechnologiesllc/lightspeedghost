import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Zap, Globe, Users, Shield, Heart, Code2, Lightbulb, Star } from "lucide-react";
import { Logo } from "@/components/Logo";

const VALUES = [
  {
    icon: Zap,
    title: "Move fast, build right",
    body: "We don't ship slowly and we don't ship broken. Speed and quality aren't in conflict if you think carefully before you build.",
  },
  {
    icon: Lightbulb,
    title: "Students are the benchmark",
    body: "Every feature gets judged by one question: does this actually help a student do better work? If the answer is unclear, we go back to the drawing board.",
  },
  {
    icon: Globe,
    title: "Built for everyone",
    body: "Students are in Lagos, Manila, London, and São Paulo. Our platform has to work for all of them — in terms of cost, payment methods, and connectivity.",
  },
  {
    icon: Shield,
    title: "Honest about what AI can and can't do",
    body: "We don't oversell. We tell students clearly what AI is good for and what it isn't. Trust is more valuable than a bigger conversion rate.",
  },
];

const PERKS = [
  { emoji: "🌍", label: "Fully remote", sub: "Work from anywhere. We have people on four continents." },
  { emoji: "📚", label: "Learning budget", sub: "$1,000/year for courses, books, and conferences." },
  { emoji: "🕐", label: "Flexible hours", sub: "Async-first culture. Work when you're most productive." },
  { emoji: "💻", label: "Equipment stipend", sub: "We'll cover the gear you need to do great work." },
  { emoji: "🏥", label: "Health coverage", sub: "Full medical, dental, and vision for full-time team members." },
  { emoji: "✈️", label: "Team meetups", sub: "We get the whole team together twice a year." },
];

const OPEN_ROLES = [
  {
    title: "Senior AI Engineer",
    type: "Full-time · Remote",
    description: "You'll work on the core AI pipelines — paper generation, humanization, STEM solving, and citation retrieval. You should be comfortable working with LLM APIs, prompt engineering at scale, and building systems that are reliable under real user load.",
    requirements: [
      "3+ years working with LLMs or NLP systems in production",
      "Python proficient; TypeScript is a bonus",
      "Experience with retrieval-augmented generation (RAG) or similar systems",
      "Strong opinions about what makes AI outputs actually good",
    ],
  },
  {
    title: "Full-Stack Engineer",
    type: "Full-time · Remote",
    description: "You'll build and maintain the platform — React frontend, Express API, database schema, and the integrations that tie everything together. We work fast and expect you to be comfortable owning features end-to-end.",
    requirements: [
      "4+ years of full-stack experience",
      "Proficient in TypeScript, React, and Node.js",
      "Comfortable with PostgreSQL and API design",
      "Experience with Supabase, Vercel, or similar deployment stacks is a plus",
    ],
  },
  {
    title: "Academic Content Strategist",
    type: "Contract · Remote",
    description: "You'll develop guides, help articles, and sample outputs that help students use the platform effectively. You understand academic writing at a university level and can translate that into content that students actually read.",
    requirements: [
      "Academic background (BA minimum; postgraduate preferred)",
      "Strong writer with the ability to vary register across audiences",
      "Familiarity with AI writing tools from a student perspective",
      "Bonus: experience in educational content, tutoring, or curriculum design",
    ],
  },
];

export default function Careers() {
  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/"><Logo size={28} textSize="text-base" className="cursor-pointer" /></Link>
        <Link href="/"><span className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors cursor-pointer"><ArrowLeft size={14} /> Back to home</span></Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-14 sm:py-20 space-y-20">

        {/* Hero */}
        <div className="max-w-2xl">
          <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-4">Careers</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight">Work on something students actually use and actually need.</h1>
          <p className="text-white/55 text-lg leading-relaxed">
            Light Speed Ghost is a small, focused team building the academic writing tools we wish we'd had as students. We're not trying to be the biggest AI company. We're trying to be the most useful one for students worldwide.
          </p>
        </div>

        {/* Values */}
        <div>
          <h2 className="text-2xl font-bold mb-8">What we care about</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="p-6 rounded-2xl bg-white/[0.03] border border-white/8">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <Icon size={18} className="text-blue-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* What we look for */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div>
            <h2 className="text-2xl font-bold mb-5">Who thrives here</h2>
            <div className="space-y-4">
              {[
                { icon: Code2, text: "You take ownership. If something is broken and it's no one's job to fix it, it becomes your job." },
                { icon: Users, text: "You communicate clearly in writing. We're async-first. If you can't write clearly, decisions slow down." },
                { icon: Star, text: "You care about the user, not just the product. Students are real people with real deadlines. That matters." },
                { icon: Heart, text: "You give honest feedback and receive it the same way. Flattery is the fastest way to ship bad work." },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={13} className="text-white/50" />
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-600/10 to-violet-600/10 border border-blue-500/20">
            <p className="text-white/70 text-sm font-semibold mb-3">Team snapshot</p>
            <div className="space-y-3">
              {[
                ["Team size", "Small and deliberate"],
                ["Time zones", "Americas, Europe, Africa, Asia"],
                ["Stage", "Growing, profitable, self-funded"],
                ["Users", "200+ universities, 40+ countries"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b border-white/6 pb-3 last:border-0 last:pb-0">
                  <span className="text-white/35 text-xs">{label}</span>
                  <span className="text-white/75 text-xs font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Perks */}
        <div>
          <h2 className="text-2xl font-bold mb-8">Benefits &amp; perks</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PERKS.map(({ emoji, label, sub }) => (
              <div key={label} className="flex items-start gap-3.5 p-5 rounded-xl bg-white/[0.03] border border-white/8">
                <span className="text-2xl shrink-0">{emoji}</span>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">{label}</p>
                  <p className="text-white/45 text-xs leading-relaxed">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Open roles */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Open roles</h2>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">{OPEN_ROLES.length} open</span>
          </div>
          <div className="space-y-4">
            {OPEN_ROLES.map((role) => (
              <div key={role.title} className="p-6 rounded-2xl bg-white/[0.03] border border-white/8">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{role.title}</h3>
                    <p className="text-xs text-white/35 mt-0.5">{role.type}</p>
                  </div>
                  <a href={`mailto:info@lightspeedghost.com?subject=Application: ${encodeURIComponent(role.title)}`}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600/15 border border-blue-500/25 text-blue-400 text-xs font-semibold hover:bg-blue-600/25 transition-colors">
                    Apply <ArrowRight size={12} />
                  </a>
                </div>
                <p className="text-white/55 text-sm leading-relaxed mb-4">{role.description}</p>
                <ul className="space-y-1.5">
                  {role.requirements.map((req) => (
                    <li key={req} className="flex items-start gap-2 text-white/45 text-xs leading-relaxed">
                      <span className="text-blue-400 mt-0.5 shrink-0">→</span> {req}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Don't see your role */}
        <div className="p-8 rounded-2xl bg-white/[0.025] border border-white/8 text-center">
          <h2 className="text-xl font-semibold mb-3">Don't see the right role?</h2>
          <p className="text-white/50 text-sm leading-relaxed mb-6 max-w-md mx-auto">
            We're always interested in genuinely exceptional people, especially in AI engineering, educational content, and growth. If that's you, send us a note — tell us what you'd build if you were here.
          </p>
          <a href="mailto:info@lightspeedghost.com?subject=Open application — Light Speed Ghost"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-xl shadow-blue-600/25 hover:scale-[1.02] text-sm">
            Send an open application <ArrowRight size={15} />
          </a>
          <p className="mt-4 text-white/25 text-xs">info@lightspeedghost.com · we respond to every application</p>
        </div>

      </main>

      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost · 500 Oracle Pkwy, Redwood City, CA 94065 · <a href="mailto:info@lightspeedghost.com" className="hover:text-white/50">info@lightspeedghost.com</a></p>
      </footer>
    </div>
  );
}
