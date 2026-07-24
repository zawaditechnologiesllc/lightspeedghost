import { useState } from "react";
import { Link } from "wouter";
import { Mail, MapPin, Clock, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

export default function Contact() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!email.trim() || !message.trim()) {
      setError("Please add your email and a message.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/contact/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), subject: subject.trim(), message: message.trim(), source: "contact" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to send message");
      }
      setSent(true);
      setEmail(""); setSubject(""); setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef7f1] text-[#191c1e] antialiased">
      <header className="border-b border-[#eceef0] px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/"><Logo size={28} textSize="text-base" variant="light" className="cursor-pointer" /></Link>
        <Link href="/"><span className="flex items-center gap-1.5 text-sm text-[#76777d] hover:text-[#191c1e] transition-colors cursor-pointer"><ArrowLeft size={14} /> Back to home</span></Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 sm:py-24">
        <div className="text-center mb-16">
          <p className="text-[#10b981] text-xs font-semibold uppercase tracking-widest mb-4">Contact</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-5">We're here to help.</h1>
          <p className="text-[#76777d] text-lg">Reach out with questions about the platform, your account, pricing, or anything else. We respond within 24 hours on business days.</p>
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
            <div key={title} className="p-6 rounded-2xl bg-white border border-[#e0e3e5] text-center">
              <div className="w-11 h-11 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 flex items-center justify-center mx-auto mb-4">
                <Icon size={20} className="text-[#10b981]" />
              </div>
              <h3 className="font-semibold text-[#191c1e] mb-2">{title}</h3>
              {href ? (
                <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
                  className="text-[#10b981] hover:text-[#059669] text-sm block mb-1">{body}</a>
              ) : (
                <p className="text-[#45464d] text-sm mb-1">{body}</p>
              )}
              <p className="text-[#76777d] text-xs">{sub}</p>
            </div>
          ))}
        </div>

        <div className="max-w-xl mx-auto p-8 rounded-2xl bg-white border border-[#e0e3e5]">
          <h2 className="text-xl font-semibold mb-6">Send us a message</h2>
          {sent ? (
            <div className="text-center py-8">
              <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-4" />
              <p className="text-[#191c1e] font-medium mb-1">Message sent — thank you!</p>
              <p className="text-[#76777d] text-sm mb-6">We'll get back to you within 24 hours on business days.</p>
              <button onClick={() => setSent(false)} className="text-[#10b981] hover:text-[#059669] text-sm">Send another message</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#45464d] mb-1.5">Your email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
                  className="w-full px-4 py-2.5 rounded-lg bg-[#eceef0] border border-[#e0e3e5] text-[#191c1e] placeholder-[#9a9aa1] text-sm focus:outline-none focus:border-[#10b981]/50 focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-[#45464d] mb-1.5">Subject</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Question about my account..."
                  className="w-full px-4 py-2.5 rounded-lg bg-[#eceef0] border border-[#e0e3e5] text-[#191c1e] placeholder-[#9a9aa1] text-sm focus:outline-none focus:border-[#10b981]/50 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-[#45464d] mb-1.5">Message</label>
                <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us what's going on..."
                  className="w-full px-4 py-2.5 rounded-lg bg-[#eceef0] border border-[#e0e3e5] text-[#191c1e] placeholder-[#9a9aa1] text-sm focus:outline-none focus:border-[#10b981]/50 transition-colors resize-none" />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button onClick={submit} disabled={sending}
                className="flex items-center justify-center gap-2 w-full text-center py-2.5 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm">
                {sending ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : "Send Message"}
              </button>
              <p className="text-[#9a9aa1] text-xs text-center">Or email us directly at info@lightspeedghost.com</p>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-[#eceef0] py-8 px-6 text-center">
        <p className="text-[#9a9aa1] text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
      </footer>
    </div>
  );
}
