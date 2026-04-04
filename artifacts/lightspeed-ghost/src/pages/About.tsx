import { Link } from "wouter";
import { ArrowRight, Zap, Target, Users, Globe } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function About() {
  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/"><Logo size={28} textSize="text-base" className="cursor-pointer" /></Link>
        <div className="flex items-center gap-4">
          <Link href="/auth"><span className="text-sm text-white/50 hover:text-white transition-colors cursor-pointer">Sign In</span></Link>
          <Link href="/auth"><span className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors cursor-pointer">Get Started Free</span></Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 sm:py-24">

        <div className="max-w-2xl mb-16">
          <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-4">About</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight">Built for students who care — and who are running out of time.</h1>
          <p className="text-white/55 text-lg leading-relaxed">
            Light Speed Ghost started from a simple frustration: academic writing tools either didn't exist, were embarrassingly bad, or required you to paste everything into ChatGPT and hope for the best. We built something better.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {[
            {
              icon: Target,
              title: "The mission",
              body: "Give every student access to the kind of support that used to only be available to those who could afford private tutors and writing coaches. If you're smart and working hard but overwhelmed — this is for you.",
            },
            {
              icon: Zap,
              title: "Why it's actually good",
              body: "We pull real citations from Semantic Scholar, not hallucinated references. We use multi-step AI reasoning for STEM problems, not pattern-matching. Everything is built around what students actually need, not what demos well.",
            },
            {
              icon: Users,
              title: "Who uses it",
              body: "Undergraduates writing their first literature review. Postgrads polishing a thesis draft. STEM students stuck on a problem set at midnight. Students at 200+ universities across 40+ countries.",
            },
            {
              icon: Globe,
              title: "Where we are",
              body: "Light Speed Ghost is headquartered in Silicon Valley, CA. Our team is distributed globally, which is why we care about building something that works across time zones and university systems.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="p-6 rounded-2xl bg-white/[0.03] border border-white/8">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                <Icon size={18} className="text-blue-400" />
              </div>
              <h3 className="font-semibold text-white mb-3">{title}</h3>
              <p className="text-white/55 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Questions? We actually respond.</h2>
          <p className="text-white/50 mb-8">Email us at <a href="mailto:info@lightspeedghost.com" className="text-blue-400 hover:text-blue-300">info@lightspeedghost.com</a> — usually within 24 hours.</p>
          <Link href="/auth">
            <span className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-xl shadow-blue-600/25 hover:scale-[1.02]">
              Start for free
              <ArrowRight size={16} />
            </span>
          </Link>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost · 500 Oracle Pkwy, Redwood City, CA 94065 · <a href="mailto:info@lightspeedghost.com" className="hover:text-white/50">info@lightspeedghost.com</a></p>
      </footer>
    </div>
  );
}
