import { useState } from "react";
import { Lock, Zap, CreditCard } from "lucide-react";
import { CheckoutModal } from "./CheckoutModal";
import { useSubscription } from "@/hooks/useSubscription";
import { formatAmount, getPaygPrice, type PaygTool, type DocumentTier } from "@/lib/pricing";

interface PaywallGateProps {
  tool: PaygTool;
  tier?: DocumentTier;
  children: React.ReactNode;
}

const TOOL_LABELS: Record<PaygTool, string> = {
  paper:      "paper generation",
  revision:   "revision",
  humanizer:  "Ghost Writer",
  stem:       "STEM solver",
  study:      "study session",
  plagiarism: "plagiarism check",
  outline:    "outline generation",
};

const PLAN_PERIOD: Record<PaygTool, string> = {
  paper:      "this month",
  revision:   "this month",
  humanizer:  "this month",
  stem:       "today",
  study:      "this month",
  plagiarism: "this month",
  outline:    "this month",
};

export function PaywallGate({ tool, tier, children }: PaywallGateProps) {
  const { plan, isAtLimit, remaining, loading } = useSubscription();
  const [showSub, setShowSub] = useState(false);
  const [showPayg, setShowPayg] = useState(false);

  if (loading) return <>{children}</>;
  if (!isAtLimit(tool)) return <>{children}</>;

  const label = TOOL_LABELS[tool];
  const period = PLAN_PERIOD[tool];
  const rem = remaining(tool);
  const paygPrice = getPaygPrice(tool, tier);
  const isPro = plan === "pro" || plan === "campus";

  return (
    <>
      <div className="relative rounded-xl overflow-hidden">
        <div className="opacity-25 pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-[#04080f]/80 backdrop-blur-[2px]">
          <div className="text-center px-6 py-8 max-w-xs">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
              <Lock size={20} className="text-orange-400" />
            </div>

            <h3 className="font-semibold text-white text-sm mb-1">
              {rem === 0 ? `0 ${label}s left ${period}` : `Limit reached`}
            </h3>
            <p className="text-white/45 text-xs leading-relaxed mb-5">
              {isPro
                ? `You've reached the ${label} limit for your plan.`
                : `Your ${plan ?? "Starter"} plan includes a limited number of ${label}s ${period}. Upgrade to Pro or pay for this one.`}
            </p>

            <div className="flex flex-col gap-2">
              {!isPro && (
                <button
                  onClick={() => setShowSub(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-semibold rounded-xl transition-all"
                >
                  <Zap size={14} />
                  Upgrade to Pro — $14.99/mo
                </button>
              )}
              {paygPrice > 0 && (
                <button
                  onClick={() => setShowPayg(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-sm rounded-xl transition-all"
                >
                  <CreditCard size={14} />
                  Pay just {formatAmount(paygPrice)} for this one
                </button>
              )}
            </div>

            {!isPro && (
              <p className="mt-3 text-[11px] text-white/25">
                Pro: 15 papers/mo · 20 plagiarism/mo · 150 study/mo · 10 STEM/day
              </p>
            )}
          </div>
        </div>
      </div>

      <CheckoutModal
        open={showSub}
        onClose={() => setShowSub(false)}
        mode="subscription"
        plan="pro_monthly"
      />
      <CheckoutModal
        open={showPayg}
        onClose={() => setShowPayg(false)}
        mode="payg"
        tool={tool}
        tier={tier}
      />
    </>
  );
}
