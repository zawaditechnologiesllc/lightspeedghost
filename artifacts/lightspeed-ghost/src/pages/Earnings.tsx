import { useState, useEffect } from "react";
import {
  Zap, Copy, Check, Eye, Wallet, Link2, DollarSign,
  CalendarClock, CreditCard, TrendingUp, ChevronDown,
} from "lucide-react";
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

const money = (cents: number) => {
  const d = cents / 100;
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
};

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3.5 text-left gap-4 group">
        <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{q}</span>
        <ChevronDown size={16} className={`${open ? "rotate-180 text-primary" : "text-muted-foreground"} shrink-0 transition-transform`} />
      </button>
      {open && <p className="px-4 pb-4 text-muted-foreground leading-relaxed text-xs">{a}</p>}
    </div>
  );
}

export default function Earnings() {
  const [data, setData] = useState<InfluencerData | null>(null);
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState("");
  const [details, setDetails] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    apiFetch("/influencer/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: InfluencerData | null) => {
        if (d) { setData(d); setMethod(d.payoutMethod || ""); setDetails(d.payoutDetails || ""); }
      })
      .catch(() => {});
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://lightspeedghost.com";
  const link = data ? `${origin}/?ref=${data.code}` : "";
  const rateCents = data?.ratePer1kCents ?? 100;
  const minCents = data?.minPayoutCents ?? 2000;
  const payoutDays = data?.payoutDays ?? 30;
  const balanceCents = data?.balanceCents ?? 0;

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

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Influencer earnings</h1>
            <p className="text-sm text-muted-foreground">Get paid {money(rateCents)} for every 1,000 views your link brings in</p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase tracking-wide">{money(rateCents)} / 1k views</span>
      </div>

      {/* Tracked link */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Your tracked link — share it anywhere</label>
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <div className="flex-1 flex items-center gap-2 px-3.5 py-3 rounded-lg border border-border bg-background text-sm text-foreground font-mono overflow-x-auto">
            <Link2 size={14} className="text-primary shrink-0" />
            <span className="truncate">{link || "Generating…"}</span>
          </div>
          <button onClick={copyLink} disabled={!link} className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground hover:opacity-90 font-semibold rounded-lg transition-opacity text-sm shrink-0 disabled:opacity-40">
            {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Drop it in your TikTok, YouTube, Instagram, X, newsletter, or group chats. Every real view counts toward your earnings.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Eye, label: "Total views", value: (data?.totalViews ?? 0).toLocaleString(), color: "text-blue-500" },
          { icon: TrendingUp, label: "Earned", value: money(data?.earnedCents ?? 0), color: "text-primary" },
          { icon: Wallet, label: "Unpaid balance", value: money(balanceCents), color: "text-emerald-500" },
          { icon: CreditCard, label: "Paid to date", value: money(data?.paidCents ?? 0), color: "text-amber-500" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <Icon size={15} className={`${color} mb-2`} />
            <div className={`text-xl font-bold ${color} tabular-nums`}>{value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Payout status */}
      <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
        {balanceCents >= minCents
          ? <span className="flex items-center gap-2"><Check size={15} className="text-emerald-500 shrink-0" /> You've cleared the {money(minCents)} minimum — your balance is queued for the next {payoutDays}-day payout.</span>
          : <span className="flex items-center gap-2"><Wallet size={15} className="text-muted-foreground shrink-0" /> {money(minCents - balanceCents)} more in earnings until you hit the {money(minCents)} minimum payout.</span>}
      </div>

      {/* Payout method */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Preferred payment method</label>
        <div className="grid sm:grid-cols-[200px_1fr_auto] gap-2">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary">
            <option value="" disabled>Select method…</option>
            {PAYOUT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Account / phone / email for payout"
            className="px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
          <button onClick={savePayout} className="px-5 py-2.5 border border-primary text-primary hover:bg-primary/5 font-semibold rounded-lg transition-colors text-sm">Save</button>
        </div>
        {savedMsg && <p className="text-xs text-emerald-500 mt-2">{savedMsg}</p>}
      </div>

      {/* Payout history */}
      {data && data.payouts.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground px-4 pt-4 pb-2">Payout history</p>
          <div className="divide-y divide-border">
            {data.payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">{new Date(p.paidAt ?? p.createdAt).toLocaleDateString()}</span>
                <span className="text-muted-foreground">{p.method ?? "—"}</span>
                <span className="font-semibold text-emerald-500 tabular-nums">{money(p.amountCents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Program terms */}
      <div>
        <h2 className="text-base font-semibold mb-3 text-foreground">The deal</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: DollarSign, big: money(rateCents), t: "per 1,000 views", d: "Real views your link drives, counted transparently." },
            { icon: Wallet, big: money(minCents), t: "minimum payout", d: "Once your balance clears this, you're due a payout." },
            { icon: CalendarClock, big: `${payoutDays} days`, t: "payout cycle", d: `Balances settle on a rolling ${payoutDays}-day cycle.` },
            { icon: CreditCard, big: "Your call", t: "payment method", d: "PayPal, M-Pesa, MTN MoMo, Airtel Money, Wise, bank, crypto." },
          ].map(({ icon: Icon, big, t, d }) => (
            <div key={t} className="bg-card border border-border rounded-xl p-4 text-center">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2"><Icon size={16} className="text-primary" /></div>
              <div className="text-lg font-bold text-foreground">{big}</div>
              <div className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1">{t}</div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">No discount codes and no cut of anyone's purchase — you're paid purely for the views your link generates. Views are de-duplicated and screened for bot/invalid traffic, which doesn't count.</p>
      </div>

      {/* How it works */}
      <div>
        <h2 className="text-base font-semibold mb-3 text-foreground">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { n: "01", icon: Link2, t: "Copy your link", d: "Your unique tracked link is above — it counts every view it sends to Light Speed Ghost." },
            { n: "02", icon: Eye, t: "Share it anywhere", d: "TikTok, YouTube, Instagram, X, blogs, group chats — every real view is counted." },
            { n: "03", icon: Wallet, t: `Get paid every ${payoutDays} days`, d: `Earn ${money(rateCents)} per 1,000 views. Pass ${money(minCents)} and you're paid to your chosen method.` },
          ].map(({ n, icon: Icon, t, d }) => (
            <div key={n} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><Icon size={16} className="text-primary" /></div>
                <span className="text-2xl font-bold text-muted-foreground/30">{n}</span>
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">{t}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-base font-semibold mb-3 text-foreground">Questions, answered</h2>
        <div className="space-y-2">
          {[
            { q: "How are views counted?", a: `Every time someone opens Light Speed Ghost through your tracked link, it registers a view against your code. Earnings are ${money(rateCents)} per 1,000 counted views. Views are de-duplicated and screened for bot/invalid traffic, which doesn't count.` },
            { q: "Is this a discount or referral-code program?", a: "No. There are no discount codes and you don't take a share of anyone's payment. You're paid purely for the views your link drives — a cleaner model for creators." },
            { q: "When and how do I get paid?", a: `Once your unpaid balance clears the ${money(minCents)} minimum, it's settled on a rolling ${payoutDays}-day cycle to your preferred method — PayPal, M-Pesa, MTN MoMo, Airtel Money, Wise, bank transfer, or crypto. Set your method above.` },
            { q: "Where can I share my link?", a: "Anywhere you have an audience — TikTok, YouTube, Instagram, X, a newsletter, a blog, a student group chat. The more real views, the more you earn." },
          ].map((f) => <FAQItem key={f.q} {...f} />)}
        </div>
      </div>
    </div>
  );
}
