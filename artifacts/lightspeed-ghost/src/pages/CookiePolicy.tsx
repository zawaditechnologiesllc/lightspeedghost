import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/"><Logo size={28} textSize="text-base" className="cursor-pointer" /></Link>
        <Link href="/"><span className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors cursor-pointer"><ArrowLeft size={14} /> Back to home</span></Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-3">Legal</p>
        <h1 className="text-4xl font-bold mb-3">Cookie Policy</h1>
        <p className="text-white/40 text-sm mb-12">Last updated: January 2025</p>

        <div className="space-y-10 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-white text-xl font-semibold mb-4">What Are Cookies</h2>
            <p>Cookies are small text files placed on your device by websites you visit. They are widely used to make websites work efficiently and provide information to the site owner.</p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">Cookies We Use</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-medium mb-2">Essential Cookies</h3>
                <p>These are required for the Platform to function. They manage your authentication session (Supabase JWT tokens) and keep you logged in. You cannot opt out of these without losing access to the platform.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Preference Cookies</h3>
                <p>We store your theme preference (light/dark mode) and sidebar state in your browser's local storage. These are not transmitted to our servers.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Third-Party Cookies</h3>
                <p>Our live chat widget (Tidio) may set cookies to maintain your chat session. These are governed by Tidio's own cookie policy. We do not use Google Analytics or advertising cookies.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">Managing Cookies</h2>
            <p>You can control cookies through your browser settings. Disabling essential cookies will prevent you from logging in. Most browsers allow you to view, delete, and block cookies — consult your browser's help documentation for details.</p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">Contact</h2>
            <p>Questions about cookies? Email <a href="mailto:info@lightspeedghost.com" className="text-blue-400 hover:text-blue-300">info@lightspeedghost.com</a>.</p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
      </footer>
    </div>
  );
}
