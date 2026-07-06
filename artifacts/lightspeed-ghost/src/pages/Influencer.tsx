import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Zap, ArrowRight, Copy, Check, Eye, Wallet, Link2, Menu, X,
  DollarSign, CalendarClock, CreditCard, TrendingUp, ChevronDown,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";

interface Payout {
  id: number; views: number; amountCents: number; method: string | null;
  status: string; createdAt: string; paidAt: string | null;
}
interface InfluencerData {
  code: string; totalViews: number; earnedCents: number; paidCents: number; balanceCents: number;
  ratePer1kCents: number; minPayoutCents: number; payoutDays: number;
  payoutMethod: string; payoutDetails: string; nextEligibleAt: string | null; eligibleForPayout: boolean;
  payouts: Payout[];
}

const PAYOUT_METHODS = ["PayPal", "M-Pesa", "MTN MoMo", "Airtel Money", "Wise", "Bank transfer", "Crypto (USDT)"];

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-[#e0e3e5] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left gap-4 group">
        <span className="text-[#191c1e] font-bold group-hover:text-[#6b38d4] transition-colors">{q}</span>
        <ChevronDown size={18} className={`${open ? "rotate-180 text-[#6b38d4]" : "text-[#76777d]"} shrink-0 transition-transform`} />
      </button>
      {open && <p className="px-5 pb-5 text-[#45464d] leading-relaxed text-sm">{a}</p>}
    </div>
  );
}

export default function Influencer() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [data, setData] = useState<InfluencerData | null>(null);
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState("");
  const [details, setDetails] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [calcViews, setCalcViews] = useState(50000);

  useEffect(() => {
    if (!user) return;
    apiFetch("/influencer/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: InfluencerData | null) => {
        if (d) { setData(d); setMethod(d.payoutMethod || ""); setDetails(d.payoutDetails || ""); }
      })
      .catch(() => {});
  }, [user]);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://lightspeedghost.com";
  const link = data ? `${origin}/?ref=${data.code}` : "";
  const rateCents = data?.ratePer1kCents ?? 100;
  const minCents = data?.minPayoutCents ?? 2000;
  const payoutDays = data?.payoutDays ?? 30;
  const calcEarn = Math.floor((calcViews * rateCents) / 1000);

  function copyLink() {
    if (!link) return;
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
  }

  async function savePayout() {
    if (!method) return;
    setSavedMsg("");
    const r = await apiFetch("/influencer/payout-method", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, details }),
    });
    setSavedMsg(r.ok ? "Saved" : "Couldn't save — try again");
    if (r.ok) setTimeout(() => setSavedMsg(""), 2500);
  }

  const navLinks = [
    { label: "How it works", href: "#how" },
    { label: "Terms", href: "#terms" },
    { label: "Calculator", href: "#calc" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] antialiased overflow-x-hidden selection:bg-[#6b38d4]/20">
      {/* ─── NAV ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#e0e3e5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/"><Logo size={30} textSize="text-base" variant="light" className="cursor-pointer select-none shrink-0" /></Link>
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((i) => (
              <a key={i.label} href={i.href} className="px-3.5 py-2 text-sm text-[#45464d] hover:text-[#6b38d4] rounded-lg hover:bg-[#f2f4f6] transition-colors">{i.label}</a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2.5">
            {user ? (
              <a href="#dashboard" className="px-5 py-2.5 text-sm bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-lg transition-colors shadow-md shadow-[#6b38d4]/20">Your dashboard</a>
            ) : (
              <Link href="/auth"><span className="px-5 py-2.5 text-sm bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-lg transition-colors cursor-pointer shadow-md shadow-[#6b38d4]/20">Get your link</span></Link>
            )}
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-[#45464d] rounded-lg hover:bg-[#f2f4f6]" aria-label="Menu">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-[#e0e3e5] px-4 py-4 space-y-1 shadow-lg">
            {navLinks.map((i) => (
              <a key={i.label} href={i.href} onClick={() => setMobileOpen(false)} className="block px-3 py-3 text-sm text-[#45464d] hover:text-[#6b38d4] rounded-lg hover:bg-[#f2f4f6]">{i.label}</a>
            ))}
            <div className="pt-3 border-t border-[#e0e3e5] mt-2">
              <Link href={user ? "#dashboard" : "/auth"}><span onClick={() => setMobileOpen(false)} className="block text-center px-4 py-2.5 text-sm bg-[#6b38d4] text-white font-semibold rounded-lg cursor-pointer">{user ? "Your dashboard" : "Get your link"}</span></Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden pt-28 pb-14 sm:pt-32 sm:pb-16 px-4 sm:px-6">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(at 0% 0%, rgba(107,56,212,0.06) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(0,144,169,0.06) 0px, transparent 50%)" }} />
          <div className="relative max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e9ddff] text-[#5516be] text-xs font-bold uppercase tracking-wider mb-6">
              <Zap size={12} className="text-[#6b38d4]" /> Influencer Program
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight mb-5 text-[#131b2e]" style={{ letterSpacing: "-0.02em" }}>
              Get paid to share <span className="text-[#6b38d4]">Light Speed Ghost.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#45464d] leading-relaxed mb-8 max-w-2xl mx-auto">
              Earn <strong className="text-[#191c1e]">{money(rateCents)} for every 1,000 views</strong> your link brings in. No discount codes, no gimmicks — just your own tracked link, real views, real money paid every {payoutDays} days to your preferred method.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {user ? (
                <a href="#dashboard" className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-bold rounded-lg transition-all shadow-lg shadow-[#6b38d4]/25 hover:-translate-y-0.5 text-sm">
                  Go to your dashboard <ArrowRight size={16} />
                </a>
              ) : (
                <Link href="/auth"><span className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-bold rounded-lg transition-all cursor-pointer shadow-lg shadow-[#6b38d4]/25 hover:-translate-y-0.5 text-sm">
                  Sign in to get your link <ArrowRight size={16} />
                </span></Link>
              )}
              <a href="#how" className="inline-flex items-center gap-2 px-7 py-3.5 border border-[#c6c6cd] hover:border-[#6b38d4] text-[#191c1e] hover:text-[#6b38d4] font-bold rounded-lg transition-all hover:bg-[#eceef0] text-sm">See how it works</a>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[#76777d]">
              <span className="flex items-center gap-1.5"><DollarSign size={12} className="text-[#6b38d4]" /> {money(rateCents)} / 1,000 views</span>
              <span className="flex items-center gap-1.5"><Wallet size={12} className="text-[#6b38d4]" /> {money(minCents)} minimum payout</span>
              <span className="flex items-center gap-1.5"><CalendarClock size={12} className="text-[#6b38d4]" /> Paid every {payoutDays} days</span>
            </div>
          </div>
        </section>

        {/* ─── DASHBOARD (logged in) ─── */}
        {user && (
          <section id="dashboard" className="px-4 sm:px-6 pb-6 sm:pb-10">
            <div className="max-w-5xl mx-auto rounded-2xl border border-[#e0e3e5] bg-white shadow-sm p-6 sm:p-8">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
                <h2 className="text-xl font-bold text-[#131b2e]">Your creator dashboard</h2>
                <span className="text-[11px] font-semibold text-[#6b38d4] bg-[#e9ddff] px-2.5 py-1 rounded-full uppercase tracking-wide">{money(rateCents)} / 1k views</span>
              </div>

              {/* Link */}
              <label className="block text-xs font-semibold text-[#45464d] mb-1.5">Your tracked link</label>
              <div className="flex flex-col sm:flex-row items-stretch gap-2 mb-6">
                <div className="flex-1 flex items-center gap-2 px-3.5 py-3 rounded-lg border border-[#c6c6cd] bg-[#f7f9fb] text-sm text-[#191c1e] font-mono overflow-x-auto">
                  <Link2 size={14} className="text-[#6b38d4] shrink-0" />
                  <span className="truncate">{link || "Generating…"}</span>
                </div>
                <button onClick={copyLink} className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-semibold rounded-lg transition-colors text-sm shrink-0">
                  {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
                {[
                  { icon: Eye, label: "Total views", value: (data?.totalViews ?? 0).toLocaleString(), color: "text-blue-600" },
                  { icon: TrendingUp, label: "Earned", value: money(data?.earnedCents ?? 0), color: "text-[#6b38d4]" },
                  { icon: Wallet, label: "Unpaid balance", value: money(data?.balanceCents ?? 0), color: "text-emerald-600" },
                  { icon: CreditCard, label: "Paid to date", value: money(data?.paidCents ?? 0), color: "text-amber-600" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="rounded-xl border border-[#e0e3e5] bg-[#f7f9fb] p-4">
                    <Icon size={15} className={`${color} mb-2`} />
                    <div className={`text-xl font-bold ${color}`}>{value}</div>
                    <div className="text-[10px] text-[#76777d] uppercase tracking-wide mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Payout status */}
              <div className="rounded-xl border border-[#e0e3e5] bg-[#f2f4f6] p-4 mb-6 text-sm text-[#45464d]">
                {(data?.balanceCents ?? 0) >= minCents
                  ? <span className="flex items-center gap-2"><Check size={15} className="text-emerald-600" /> You've cleared the {money(minCents)} minimum — your balance is queued for the next {payoutDays}-day payout.</span>
                  : <span className="flex items-center gap-2"><Wallet size={15} className="text-[#76777d]" /> {money(minCents - (data?.balanceCents ?? 0))} more in earnings until you hit the {money(minCents)} minimum payout.</span>}
              </div>

              {/* Payout method */}
              <label className="block text-xs font-semibold text-[#45464d] mb-1.5">Preferred payment method</label>
              <div className="grid sm:grid-cols-[200px_1fr_auto] gap-2">
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-3 py-2.5 rounded-lg border border-[#c6c6cd] bg-white text-sm text-[#191c1e] focus:outline-none focus:border-[#6b38d4]">
                  <option value="" disabled>Select method…</option>
                  {PAYOUT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Account / phone / email for payout"
                  className="px-3 py-2.5 rounded-lg border border-[#c6c6cd] bg-white text-sm text-[#191c1e] placeholder-[#76777d] focus:outline-none focus:border-[#6b38d4]" />
                <button onClick={savePayout} className="px-5 py-2.5 border border-[#6b38d4] text-[#6b38d4] hover:bg-[#6b38d4]/5 font-semibold rounded-lg transition-colors text-sm">Save</button>
              </div>
              {savedMsg && <p className="text-xs text-emerald-600 mt-2">{savedMsg}</p>}

              {/* History */}
              {data && data.payouts.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-semibold text-[#45464d] mb-2">Payout history</p>
                  <div className="rounded-xl border border-[#e0e3e5] overflow-hidden">
                    {data.payouts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm border-b border-[#eceef0] last:border-0">
                        <span className="text-[#45464d]">{new Date(p.paidAt ?? p.createdAt).toLocaleDateString()}</span>
                        <span className="text-[#76777d]">{p.method ?? "—"}</span>
                        <span className="font-semibold text-emerald-600">{money(p.amountCents)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─── HOW IT WORKS ─── */}
        <section id="how" className="py-14 sm:py-20 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3">How it works</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#131b2e]">Three steps to get paid</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { n: "01", icon: Link2, t: "Grab your link", d: "Sign in and get a unique tracked link in one click. It sends people to Light Speed Ghost and counts every view." },
                { n: "02", icon: Eye, t: "Share it anywhere", d: "Drop it in your TikTok, YouTube, Instagram, X, or blog. Every view your link drives is counted toward your earnings." },
                { n: "03", icon: Wallet, t: "Get paid every 30 days", d: `Earn ${money(rateCents)} per 1,000 views. Once you pass ${money(minCents)}, we pay out every ${payoutDays} days to your preferred method.` },
              ].map(({ n, icon: Icon, t, d }) => (
                <div key={n} className="rounded-2xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-[#6b38d4]/10 flex items-center justify-center"><Icon size={20} className="text-[#6b38d4]" /></div>
                    <span className="text-3xl font-bold text-[#d8dadc]">{n}</span>
                  </div>
                  <h3 className="font-bold text-[#191c1e] mb-2">{t}</h3>
                  <p className="text-sm text-[#45464d] leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── TERMS ─── */}
        <section id="terms" className="py-14 sm:py-20 px-4 sm:px-6 bg-[#f2f4f6] border-y border-[#e0e3e5]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3">The deal</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#131b2e]">Simple, honest terms</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: DollarSign, big: money(rateCents), t: "per 1,000 views", d: "The minimum rate. Real views your link drives, counted transparently." },
                { icon: Wallet, big: money(minCents), t: "minimum payout", d: "Once your balance clears this, you're due a payout." },
                { icon: CalendarClock, big: `${payoutDays} days`, t: "payout cycle", d: "We settle balances on a rolling 30-day cycle." },
                { icon: CreditCard, big: "Your call", t: "payment method", d: "PayPal, M-Pesa, MTN MoMo, Airtel Money, Wise, bank transfer — you choose." },
              ].map(({ icon: Icon, big, t, d }) => (
                <div key={t} className="rounded-2xl border border-[#e0e3e5] bg-white p-5 shadow-sm text-center">
                  <div className="w-11 h-11 rounded-xl bg-[#6b38d4]/10 flex items-center justify-center mx-auto mb-3"><Icon size={20} className="text-[#6b38d4]" /></div>
                  <div className="text-2xl font-bold text-[#131b2e]">{big}</div>
                  <div className="text-xs font-semibold text-[#6b38d4] uppercase tracking-wide mb-2">{t}</div>
                  <p className="text-xs text-[#45464d] leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-[#76777d] text-xs mt-6 max-w-2xl mx-auto">No discount codes and no cut of anyone's purchase — you're paid purely for the views your link generates. Views are subject to basic anti-fraud checks; bot or invalid traffic doesn't count.</p>
          </div>
        </section>

        {/* ─── CALCULATOR ─── */}
        <section id="calc" className="py-14 sm:py-20 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3">Earnings calculator</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#131b2e] mb-8">See what your audience is worth</h2>
            <div className="rounded-2xl border border-[#e0e3e5] bg-white shadow-sm p-6 sm:p-8">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm text-[#45464d]">Views per month</span>
                <span className="text-lg font-bold text-[#131b2e]">{calcViews.toLocaleString()}</span>
              </div>
              <input type="range" min={1000} max={1000000} step={1000} value={calcViews}
                onChange={(e) => setCalcViews(parseInt(e.target.value))}
                className="w-full accent-[#6b38d4]" />
              <div className="mt-6 rounded-xl bg-[#e9ddff]/50 border border-[#d0bcff] p-5">
                <p className="text-xs text-[#5516be] uppercase tracking-wide font-semibold mb-1">Estimated monthly earnings</p>
                <p className="text-4xl font-bold text-[#6b38d4]">{money(calcEarn)}</p>
                <p className="text-xs text-[#76777d] mt-1">at {money(rateCents)} per 1,000 views</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" className="py-14 sm:py-20 px-4 sm:px-6 bg-[#f2f4f6] border-y border-[#e0e3e5]">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <p className="text-[#6b38d4] text-sm font-bold uppercase tracking-widest mb-3">FAQ</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#131b2e]">Questions, answered</h2>
            </div>
            <div className="space-y-4">
              {[
                { q: "How are views counted?", a: `Every time someone opens Light Speed Ghost through your tracked link, it registers a view against your code. Earnings are ${money(rateCents)} per 1,000 counted views. Views are de-duplicated and screened for bot/invalid traffic, which doesn't count.` },
                { q: "Is this a discount or referral-code program?", a: "No. There are no discount codes and you don't take a share of anyone's payment. You're paid purely for the views your link drives — a cleaner model for creators." },
                { q: "When and how do I get paid?", a: `Once your unpaid balance clears the ${money(minCents)} minimum, it's settled on a rolling ${payoutDays}-day cycle to your preferred method — PayPal, M-Pesa, MTN MoMo, Airtel Money, Wise, or bank transfer. Set your method in the dashboard.` },
                { q: "Where can I share my link?", a: "Anywhere you have an audience — TikTok, YouTube, Instagram, X, a newsletter, a blog, a student group chat. The more real views, the more you earn." },
                { q: "How do I start?", a: "Sign in (or create a free account), open this page, and your tracked link plus dashboard appear instantly. No application to wait on." },
              ].map((f) => <FAQItem key={f.q} {...f} />)}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden bg-[#131b2e] text-white">
          <div className="absolute inset-0 pointer-events-none"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#6b38d4]/20 rounded-full blur-[100px]" /></div>
          <div className="relative max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight" style={{ letterSpacing: "-0.02em" }}>Your audience is already worth money.</h2>
            <p className="text-[#9aa3bd] mb-8 text-base sm:text-lg">Grab your link, share the tool that writes from real research, and get paid for every 1,000 views.</p>
            {user ? (
              <a href="#dashboard" className="inline-flex items-center gap-2 px-8 py-4 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-bold rounded-lg transition-all shadow-2xl hover:-translate-y-0.5 text-base">Open your dashboard <ArrowRight size={18} /></a>
            ) : (
              <button onClick={() => navigate("/auth")} className="inline-flex items-center gap-2 px-8 py-4 bg-[#6b38d4] hover:bg-[#5b2fc0] text-white font-bold rounded-lg transition-all shadow-2xl hover:-translate-y-0.5 text-base">Get your link — it's free <ArrowRight size={18} /></button>
            )}
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="bg-[#eceef0] border-t border-[#e0e3e5] py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/"><Logo size={24} textSize="text-sm" variant="light" className="cursor-pointer opacity-80 hover:opacity-100 transition-opacity" /></Link>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-[#76777d]">
            <Link href="/"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">Home</span></Link>
            <Link href="/about"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">About</span></Link>
            <Link href="/contact"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">Contact</span></Link>
            <Link href="/terms"><span className="hover:text-[#6b38d4] cursor-pointer transition-colors">Terms</span></Link>
          </div>
          <p className="text-[#76777d] text-xs">© {new Date().getFullYear()} Light Speed Ghost</p>
        </div>
      </footer>
    </div>
  );
}
