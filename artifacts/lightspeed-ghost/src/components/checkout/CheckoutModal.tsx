import { useState, useEffect, useCallback } from "react";
import { X, Loader2, CreditCard, Smartphone, Globe, ShieldCheck } from "lucide-react";
import { usePaymentGateway, type GatewayInfo } from "@/hooks/usePaymentGateway";
import {
  formatAmount,
  getPaygPrice,
  getPaygLabel,
  GATEWAY_LABELS,
  type PlanId,
  type PaygTool,
  type DocumentTier,
} from "@/lib/pricing";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  mode: "subscription" | "payg";
  plan?: PlanId;
  tool?: PaygTool;
  tier?: DocumentTier;
  seats?: number;
  onSuccess?: () => void;
}

const GATEWAY_ICONS: Record<string, React.ElementType> = {
  stripe:       CreditCard,
  paddle:       CreditCard,
  lemon_squeezy: Globe,
  paystack:     ShieldCheck,
  intasend:     Smartphone,
};

const PLAN_AMOUNTS: Record<PlanId, number> = {
  pro_monthly:   1499,
  pro_annual:    9900,
  campus_annual: 600,
};

export function CheckoutModal({
  open,
  onClose,
  mode,
  plan,
  tool,
  tier,
  seats = 5,
  onSuccess,
}: CheckoutModalProps) {
  const {
    loading,
    error,
    detectGateway,
    createSubscriptionSession,
    createPaygSession,
  } = usePaymentGateway();

  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const amountCents = mode === "subscription" && plan
    ? (plan === "campus_annual" ? PLAN_AMOUNTS[plan] * Math.max(5, seats) * 12 : PLAN_AMOUNTS[plan])
    : (tool ? getPaygPrice(tool, tier) : 0);

  const label = mode === "subscription" && plan
    ? plan === "pro_monthly" ? "Pro — Monthly" : plan === "pro_annual" ? "Pro — Annual" : `Campus (${seats} seats)`
    : (tool ? getPaygLabel(tool, tier) : "");

  const doDetect = useCallback(async () => {
    setDetecting(true);
    const info = await detectGateway();
    setGatewayInfo(info);
    setDetecting(false);
  }, [detectGateway]);

  useEffect(() => {
    if (open && !gatewayInfo) {
      doDetect();
    }
  }, [open, gatewayInfo, doDetect]);

  async function handleCheckout() {
    setRedirecting(true);
    try {
      let session;
      if (mode === "subscription" && plan) {
        session = await createSubscriptionSession(plan, seats);
      } else if (mode === "payg" && tool) {
        session = await createPaygSession(tool, tier);
      }

      if (session?.checkoutUrl) {
        window.location.href = session.checkoutUrl;
      }
    } finally {
      setRedirecting(false);
    }
  }

  if (!open) return null;

  const GatewayIcon = gatewayInfo ? (GATEWAY_ICONS[gatewayInfo.gateway] ?? CreditCard) : CreditCard;
  const gatewayLabel = gatewayInfo ? (GATEWAY_LABELS[gatewayInfo.gateway] ?? gatewayInfo.gateway) : "";
  const isMobile = gatewayInfo?.gateway === "intasend";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#0a0f1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center">
              <CreditCard size={14} className="text-white" />
            </div>
            <span className="font-semibold text-white text-sm">Checkout</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Order summary */}
          <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4">
            <div className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">Order Summary</div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">{label}</span>
              <span className="text-base font-bold text-white">{formatAmount(amountCents)}</span>
            </div>
            {mode === "subscription" && plan === "campus_annual" && (
              <div className="mt-1.5 text-xs text-white/35">
                {seats} seats × $6/seat/mo × 12 months
              </div>
            )}
            {mode === "subscription" && plan === "pro_annual" && (
              <div className="mt-1.5 text-xs text-green-400/80">
                Save 45% vs monthly billing
              </div>
            )}
          </div>

          {/* Gateway info */}
          <div>
            <div className="text-xs text-white/40 mb-2.5 font-medium uppercase tracking-wider">Payment Method</div>
            {detecting ? (
              <div className="flex items-center gap-2.5 text-white/40 text-sm py-3">
                <Loader2 size={14} className="animate-spin" />
                Detecting best payment method…
              </div>
            ) : gatewayInfo ? (
              <div className="flex items-center gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                  <GatewayIcon size={16} className="text-white/70" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{gatewayLabel}</div>
                  <div className="text-xs text-white/35 mt-0.5">
                    {isMobile
                      ? "Mobile Money — secure checkout"
                      : "Secure hosted checkout"}
                  </div>
                </div>
                <ShieldCheck size={14} className="ml-auto text-green-400/70 shrink-0" />
              </div>
            ) : null}
          </div>

          {/* Error */}
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Security note */}
          <div className="flex items-center gap-2 text-xs text-white/25">
            <ShieldCheck size={12} />
            <span>256-bit SSL encryption · PCI-DSS compliant · Secure redirect</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-white/50 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCheckout}
            disabled={loading || detecting || redirecting || !gatewayInfo}
            className="flex-1 py-2.5 text-sm font-semibold bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {(loading || redirecting) ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Redirecting…
              </>
            ) : (
              <>
                Pay {formatAmount(amountCents)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
