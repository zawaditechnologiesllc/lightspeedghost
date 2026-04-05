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
  starter: Zap,
  pro:     Crown,
  campus:  Users,
};

const PLAN_COLOR: Record<string, string> = {
  starter: "text-blue-400",
  pro:     "text-amber-400",
  campus:  "text-emerald-400",
};

export function ManageFundsModal({ open, onClose }: ManageFundsModalProps) {
  const { plan, usage, getLimit, remaining } = useSubscription();
  const { balanceCents, refresh: refreshCredits } = useCredits();
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);

  if (!open) return null;

  const PlanIcon = PLAN_ICON[plan ?? "starter"] ?? Zap;
  const planColor = PLAN_COLOR[plan ?? "starter"] ?? "text-blue-400";
  const planName = plan === "pro" ? "Pro" : plan === "campus" ? "Campus" : "Starter";

  const creditDollars = (balanceCents / 100).toFixed(2);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet size={15} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Manage Funds</p>
                <p className="text-[11px] text-muted-foreground">Plan, credits &amp; usage</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
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
                  <PlanIcon size={15} className={planColor} />
                  <span className="text-sm font-semibold text-foreground">{planName} Plan</span>
                </div>
                {plan === "starter" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium">
                    Free tier
                  </span>
                )}
                {plan === "pro" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium flex items-center gap-1">
                    <Star size={9} /> Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {plan === "starter" && "3 papers · 1 revision · 1 humanization per month included"}
                {plan === "pro"     && "50 papers · 50 revisions · 50 humanizations per month"}
                {plan === "campus"  && "15 papers · 15 revisions · 15 humanizations per month (seat)"}
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
            {plan === "starter" && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Crown size={14} className="text-primary" />
                  <p className="text-sm font-semibold text-primary">Upgrade to Pro</p>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Unlock 50 of every tool per month, priority LightSpeed AI, and unlimited Study &amp; Plagiarism checks.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCheckoutPlan("pro_monthly")}
                    className="flex-1 py-2 rounded-lg bg-muted border border-border text-foreground text-xs font-semibold hover:bg-muted/80 transition-colors flex items-center justify-center gap-1.5"
                  >
                    $14.99/mo <ChevronRight size={12} />
                  </button>
                  <button
                    onClick={() => setCheckoutPlan("pro_annual")}
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                  >
                    $99/yr · Save 45% <ChevronRight size={12} />
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
