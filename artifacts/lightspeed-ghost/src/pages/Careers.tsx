import { Link } from "wouter";
import { ArrowLeft, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function Careers() {
  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/"><Logo size={28} textSize="text-base" className="cursor-pointer" /></Link>
        <Link href="/"><span className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors cursor-pointer"><ArrowLeft size={14} /> Back to home</span></Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 sm:py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-8">
          <Zap size={28} className="text-blue-400" />
        </div>
        <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-4">Careers</p>
        <h1 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight">We're building something students actually need.</h1>
        <p className="text-white/55 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
          We're a small, focused team working on AI tools for students. We move fast, care about quality, and believe the best academic tools haven't been built yet.
        </p>

        <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/8 text-left mb-10">
          <h2 className="text-white font-semibold mb-3">No open roles right now</h2>
          <p className="text-white/55 text-sm leading-relaxed">
            We don't have specific openings listed, but we're always interested in hearing from people who are genuinely great at what they do — especially in AI engineering, full-stack development, and educational content. If that's you, send a note.
          </p>
        </div>

        <a href="mailto:info@lightspeedghost.com?subject=I'd like to work with you"
          className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-xl shadow-blue-600/25 hover:scale-[1.02]">
          Get in touch
        </a>
        <p className="mt-4 text-white/25 text-xs">info@lightspeedghost.com</p>
      </main>

      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost · 500 Oracle Pkwy, Redwood City, CA 94065</p>
      </footer>
    </div>
  );
}
