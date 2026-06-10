import { X, Zap, Crown, Users, ArrowRight, TrendingUp, ChevronRight, Star, Wallet, Coins, Plus } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useCredits } from "@/hooks/useCredits";
import { SUBSCRIPTION_PLANS, formatAmount } from "@/lib/pricing";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import { BuyCreditsModal } from "@/components/BuyCreditsModal";
import { useState } from "react";
import type { PlanId } from "@/lib/pricing";

interface ManageFundsModalProps {
  open: boolean;
  onClose: () => void;
}

const TOOL_LABELS = [
  { key: "paper",      label: "Papers",           color: "bg-blue-500" },
  { key: "revision",   label: "Revisions",         color: "bg-violet-500" },
  { key: "humanizer",  label: "Humanizer",         color: "bg-purple-500" },
  { key: "stem",       label: "STEM Solves",        color: "bg-cyan-500" },
  { key: "study",      label: "Study Sessions",    color: "bg-amber-500" },
  { key: "plagiarism", label: "Plagiarism Checks", color: "bg-emerald-500" },
  { key: "outline",    label: "Outlines",          color: "bg-indigo-500" },
] as const;

const PLAN_ICON: Record<string, React.ElementType> = {
  starter:             Zap,
  student_pro_monthly: Star,
  pro:                 Crown,
  campus:              Users,
};

const PLAN_COLOR: Record<string, string> = {
  starter:             "text-blue-400",
  student_pro_monthly: "text-violet-400",
  pro:                 "text-amber-400",
  campus:              "text-emerald-400",
};

export function ManageFundsModal({ open, onClose }: ManageFundsModalProps) {
  const { plan, usage, getLimit, remaining, loading: planLoading } = useSubscription();
  const { balanceCents, refresh: refreshCredits } = useCredits();
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);

  if (!open) return null;

  const resolvedPlan = planLoading ? null : (plan ?? "none");
  const PlanIcon = PLAN_ICON[resolvedPlan ?? "starter"] ?? Zap;
  const planColor = PLAN_COLOR[resolvedPlan ?? "starter"] ?? "text-blue-400";
  const planName = resolvedPlan === "pro" ? "Pro" : resolvedPlan === "student_pro_monthly" ? "Student Pro" : resolvedPlan === "institution" ? "Institution" : resolvedPlan === "campus" ? "Institution" : resolvedPlan === "starter" ? "Starter" : resolvedPlan === null ? "…" : "No";

  const creditDollars = (balanceCents / 100).toFixed(2);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative flex items-center justify-center px-5 py-4 border-b border-border shrink-0">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet size={15} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Manage Funds</p>
                <p className="text-[11px] text-muted-foreground">Plan, credits &amp; usage</p>
              </div>
            </div>
            <button onClick={onClose} className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Credits balance */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Coins size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {balanceCents.toLocaleString()} <span className="text-amber-400">credits</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">≈ ${creditDollars} · never expire</p>
                </div>
              </div>
              <button
                onClick={() => setBuyCreditsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/30 transition-colors shrink-0"
              >
                <Plus size={12} />
                Add Credits
              </button>
            </div>

            {/* Current Plan */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <PlanIcon size={15} className={planLoading ? "text-muted-foreground" : planColor} />
                  <span className="text-sm font-semibold text-foreground">{planName} Plan</span>
                </div>
                {!planLoading && resolvedPlan === "none" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50 border border-white/15 font-medium">
                    PAYG only
                  </span>
                )}
                {!planLoading && resolvedPlan === "starter" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 font-medium">
                    $9.99/mo
                  </span>
                )}
                {!planLoading && resolvedPlan === "student_pro_monthly" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 font-medium flex items-center gap-1">
                    <Star size={9} /> Active · $19.99/mo
                  </span>
                )}
                {!planLoading && resolvedPlan === "pro" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium flex items-center gap-1">
                    <Star size={9} /> Active
                  </span>
                )}
                {!planLoading && (resolvedPlan === "campus" || resolvedPlan === "institution") && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                    <Star size={9} /> Active
                  </span>
                )}
                {planLoading && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium animate-pulse">
                    Loading…
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {planLoading                  && "Fetching your plan…"}
                {!planLoading && resolvedPlan === "none" && "No active subscription — every tool is pay-as-you-go. Subscribe for monthly included quotas."}
                {!planLoading && resolvedPlan === "starter" && "3 papers · 1 revision · 15 STEM · 20 study · 5 plagiarism/outlines per month"}
                {!planLoading && resolvedPlan === "student_pro_monthly" && "8 papers (≤3,500 words) · 4 revisions · 6 humanizations · 40 STEM · 75 study · 10 plagiarism · 10 outlines per month"}
                {!planLoading && resolvedPlan === "pro"     && "15 papers · 20 revisions · 20 humanizations · 20 outlines · 60 STEM · 150 study · 20 plagiarism per month"}
                {!planLoading && resolvedPlan === "campus"       && "5 papers · 8 revisions · 8 humanizations · 30 STEM · 75 study · 10 plagiarism · 10 outlines per seat/month"}
                {!planLoading && resolvedPlan === "institution"  && "Unlimited papers · revisions · STEM · study sessions · plagiarism checks · outlines"}
              </p>
            </div>

            {/* Usage Bars */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp size={12} className="text-muted-foreground" /> This month's usage
              </p>
              {TOOL_LABELS.map(({ key, label, color }) => {
                const limit = getLimit(key);
                const used = usage[key] ?? 0;
                const rem = remaining(key);
                const pct = limit === null ? 0 : limit === 0 ? 100 : Math.min(100, (used / limit) * 100);
                return (
                  <div key={key}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-foreground font-mono">
                        {limit === null ? `${used} / ∞` : rem === null ? `${used}` : `${used} / ${limit}`}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full transition-all`}
                        style={{ width: `${limit === null ? 30 : pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Upgrade CTA */}
            {!planLoading && (resolvedPlan === "starter" || resolvedPlan === "none") && (
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star size={14} className="text-violet-400" />
                  <p className="text-sm font-semibold text-violet-300">Upgrade to Student Pro</p>
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25 font-semibold uppercase tracking-wide">Most popular</span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  8 papers · 4 revisions · Humanizer unlocked (6 jobs) · 40 STEM · 75 study · 10 plagiarism · 10 outlines per month.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCheckoutPlan("student_pro_monthly")}
                    className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-500 transition-colors flex items-center justify-center gap-1.5"
                  >
                    Student Pro · $19.99/mo <ChevronRight size={12} />
                  </button>
                  <button
                    onClick={() => setCheckoutPlan("pro_monthly")}
                    className="flex-1 py-2 rounded-lg bg-muted border border-border text-foreground text-xs font-semibold hover:bg-muted/80 transition-colors flex items-center justify-center gap-1.5"
                  >
                    Pro · $29.99/mo <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
            {!planLoading && resolvedPlan === "student_pro_monthly" && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Crown size={14} className="text-primary" />
                  <p className="text-sm font-semibold text-primary">Upgrade to Pro</p>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  15 papers (all lengths) · 20 revisions · 20 humanizations · 60 STEM · 150 study · 20 plagiarism · 20 outlines per month.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCheckoutPlan("pro_monthly")}
                    className="flex-1 py-2 rounded-lg bg-muted border border-border text-foreground text-xs font-semibold hover:bg-muted/80 transition-colors flex items-center justify-center gap-1.5"
                  >
                    $29.99/mo <ChevronRight size={12} />
                  </button>
                  <button
                    onClick={() => setCheckoutPlan("pro_annual")}
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                  >
                    $269/yr · Save 25% <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Plans list */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">All plans</p>
              {SUBSCRIPTION_PLANS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setCheckoutPlan(p.id)}
                  className="w-full flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3.5 hover:border-primary/40 hover:bg-muted/40 transition-all group"
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{p.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-primary">
                    {p.displayPrice}
                    <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {checkoutPlan && (
        <CheckoutModal
          open={true}
          onClose={() => setCheckoutPlan(null)}
          mode="subscription"
          plan={checkoutPlan}
          onSuccess={() => { setCheckoutPlan(null); onClose(); }}
        />
      )}

      <BuyCreditsModal
        open={buyCreditsOpen}
        onClose={() => setBuyCreditsOpen(false)}
        onSuccess={() => { refreshCredits(); }}
      />
    </>
  );
}
