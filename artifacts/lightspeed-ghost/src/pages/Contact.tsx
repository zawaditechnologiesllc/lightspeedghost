import { Link } from "wouter";
import { Mail, MapPin, Clock, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function Contact() {
  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/"><Logo size={28} textSize="text-base" className="cursor-pointer" /></Link>
        <Link href="/"><span className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors cursor-pointer"><ArrowLeft size={14} /> Back to home</span></Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 sm:py-24">
        <div className="text-center mb-16">
          <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-4">Contact</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-5">We're here to help.</h1>
          <p className="text-white/50 text-lg">Reach out with questions about the platform, your account, pricing, or anything else. We respond within 24 hours on business days.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            {
              icon: Mail,
              title: "Email support",
              body: "info@lightspeedghost.com",
              sub: "Response within 24 hours",
              href: "mailto:info@lightspeedghost.com",
            },
            {
              icon: MapPin,
              title: "Office",
              body: "500 Oracle Pkwy",
              sub: "Redwood City, CA 94065",
              href: "https://maps.google.com/?q=500+Oracle+Pkwy+Redwood+City+CA",
            },
            {
              icon: Clock,
              title: "Support hours",
              body: "Mon – Fri, 9am – 6pm PT",
              sub: "Live chat available 24/7",
              href: null,
            },
          ].map(({ icon: Icon, title, body, sub, href }) => (
            <div key={title} className="p-6 rounded-2xl bg-white/[0.03] border border-white/8 text-center">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <Icon size={20} className="text-blue-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              {href ? (
                <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm block mb-1">{body}</a>
              ) : (
                <p className="text-white/70 text-sm mb-1">{body}</p>
              )}
              <p className="text-white/35 text-xs">{sub}</p>
            </div>
          ))}
        </div>

        <div className="max-w-xl mx-auto p-8 rounded-2xl bg-white/[0.03] border border-white/8">
          <h2 className="text-xl font-semibold mb-6">Send us a message</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Your email</label>
              <input type="email" placeholder="you@university.edu"
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Subject</label>
              <input type="text" placeholder="Question about my account..."
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Message</label>
              <textarea rows={5} placeholder="Tell us what's going on..."
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 transition-colors resize-none" />
            </div>
            <a href="mailto:info@lightspeedghost.com"
              className="block w-full text-center py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-sm">
              Send Message
            </a>
            <p className="text-white/25 text-xs text-center">This form opens your email client. You can also email us directly at info@lightspeedghost.com</p>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
      </footer>
    </div>
  );
}
