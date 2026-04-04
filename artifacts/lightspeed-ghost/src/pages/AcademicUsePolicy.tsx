import { Link } from "wouter";
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function AcademicUsePolicy() {
  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/"><Logo size={28} textSize="text-base" className="cursor-pointer" /></Link>
        <Link href="/"><span className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors cursor-pointer"><ArrowLeft size={14} /> Back to home</span></Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-3">Legal</p>
        <h1 className="text-4xl font-bold mb-3">Academic Use Policy</h1>
        <p className="text-white/40 text-sm mb-12">Last updated: January 2025</p>

        <div className="space-y-10 text-white/70 leading-relaxed">

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">Our Position on Academic Integrity</h2>
            <p>Light Speed Ghost is a writing aid. It is in the same category as Grammarly, tutoring services, study groups, and writing centers — tools that help students improve their work, not tools that replace their thinking. We care about genuine learning. We built this platform for students who are overwhelmed, not for students who want to cheat.</p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">Acceptable Use</h2>
            <div className="space-y-3">
              {[
                "Using generated papers as a starting draft that you review, edit, and make your own",
                "Using the outline builder to structure your own argument before writing",
                "Using the STEM solver to understand methods and check your working — not just to copy answers",
                "Using the revision tool to improve your own submitted draft",
                "Using the plagiarism checker to identify and fix unintentional similarity",
                "Using the AI study assistant to understand concepts, quiz yourself, and prepare for exams",
                "Generating citations and checking their accuracy before including them",
              ].map(item => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">Prohibited Use</h2>
            <div className="space-y-3">
              {[
                "Submitting AI-generated content as entirely your own without any review or editing",
                "Using the platform in violation of your institution's specific academic integrity policy",
                "Generating content for others to submit (contract cheating)",
                "Using it for assessments that explicitly prohibit AI assistance without disclosure",
              ].map(item => (
                <div key={item} className="flex items-start gap-3">
                  <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">Your Responsibility</h2>
            <p>You are fully responsible for all content you submit academically. Light Speed Ghost provides tools, not answers you can submit blindly. Read what is generated. Edit it. Make it reflect your actual understanding. That is the point.</p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">Enforcement</h2>
            <p>We reserve the right to suspend accounts we have strong reason to believe are being used for contract cheating or systematic academic fraud. We cooperate with institutional integrity investigations when legally required to do so.</p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">Questions</h2>
            <p>If you're unsure whether a specific use is appropriate, email us at <a href="mailto:info@lightspeedghost.com" className="text-blue-400 hover:text-blue-300">info@lightspeedghost.com</a>. We're happy to discuss it.</p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
      </footer>
    </div>
  );
}
