import { Link } from "wouter";
import { ArrowLeft, PenLine } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function Blog() {
  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/"><Logo size={28} textSize="text-base" className="cursor-pointer" /></Link>
        <Link href="/"><span className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors cursor-pointer"><ArrowLeft size={14} /> Back to home</span></Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 sm:py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-8">
          <PenLine size={28} className="text-blue-400" />
        </div>
        <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-4">Blog</p>
        <h1 className="text-4xl font-bold mb-5">Coming soon.</h1>
        <p className="text-white/50 text-lg leading-relaxed max-w-xl mx-auto mb-10">
          We're working on guides for students — how to use AI writing tools responsibly, how to improve academic writing, STEM study tips, and more. Check back soon.
        </p>
        <Link href="/auth">
          <span className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all cursor-pointer">
            Try the platform instead
          </span>
        </Link>
      </main>

      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
      </footer>
    </div>
  );
}
