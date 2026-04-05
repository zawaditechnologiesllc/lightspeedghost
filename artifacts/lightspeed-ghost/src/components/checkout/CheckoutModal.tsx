import { useState, useEffect, useCallback } from "react";
import {
  X, Loader2, CreditCard, Smartphone, Globe, ShieldCheck,
  RefreshCw, ArrowRight, AlertCircle,
} from "lucide-react";
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

const MOMO_LABELS: Record<string, string> = {
  mpesa:  "M-Pesa",
  airtel: "Airtel Money",
  mtn:    "MTN MoMo",
};

const MOMO_COLORS: Record<string, string> = {
  mpesa:  "text-green-400",
  airtel: "text-red-400",
  mtn:    "text-yellow-400",
};

const GATEWAY_ICONS: Record<string, React.ElementType> = {
  stripe:        CreditCard,
  paddle:        CreditCard,
  lemon_squeezy: Globe,
  paystack:      ShieldCheck,
  intasend:      Smartphone,
};

const PLAN_AMOUNTS: Record<PlanId, number> = {
  pro_monthly:      1499,
  pro_annual:       9900,
  campus_annual:    600,
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
  const [useCardFallback, setUseCardFallback] = useState(false);

  const amountCents = mode === "subscription" && plan
    ? (plan === "campus_annual"
      ? PLAN_AMOUNTS[plan] * Math.max(5, seats) * 12
      : PLAN_AMOUNTS[plan])
    : (tool ? getPaygPrice(tool, tier) : 0);

  const label = mode === "subscription" && plan
    ? plan === "pro_monthly" ? "Pro — Monthly"
      : plan === "pro_annual" ? "Pro — Annual"
      : `Campus (${seats} seats)`
    : (tool ? getPaygLabel(tool, tier) : "");

  const doDetect = useCallback(async () => {
    setDetecting(true);
    const info = await detectGateway();
    setGatewayInfo(info);
    setUseCardFallback(false);
    setDetecting(false);
  }, [detectGateway]);

  useEffect(() => {
    if (open && !gatewayInfo) {
      doDetect();
    }
  }, [open, gatewayInfo, doDetect]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setGatewayInfo(null);
      setUseCardFallback(false);
    }
  }, [open]);

  const effectiveGateway = useCardFallback
    ? (gatewayInfo?.cardFallbackGateway ?? gatewayInfo?.gateway)
    : gatewayInfo?.gateway;

  async function handleCheckout() {
    setRedirecting(true);
    try {
      let session;
      const preferred = useCardFallback && gatewayInfo?.cardFallbackGateway
        ? gatewayInfo.cardFallbackGateway
        : undefined;

      if (mode === "subscription" && plan) {
        session = await createSubscriptionSession(plan, seats, preferred);
      } else if (mode === "payg" && tool) {
        session = await createPaygSession(tool, tier, preferred);
      }

      if (session?.checkoutUrl) {
        window.location.href = session.checkoutUrl;
      }
    } finally {
      setRedirecting(false);
    }
  }

  if (!open) return null;

  const isMoMo = gatewayInfo?.isMobileMoney && !useCardFallback;
  const momoLabel = gatewayInfo?.momoProvider ? MOMO_LABELS[gatewayInfo.momoProvider] ?? "Mobile Money" : "Mobile Money";
  const momoColor = gatewayInfo?.momoProvider ? MOMO_COLORS[gatewayInfo.momoProvider] ?? "text-green-400" : "text-green-400";
  const GatewayIcon = effectiveGateway ? (GATEWAY_ICONS[effectiveGateway] ?? CreditCard) : CreditCard;
  const gatewayLabel = effectiveGateway ? (GATEWAY_LABELS[effectiveGateway] ?? effectiveGateway) : "";

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
        <div className="px-6 py-5 space-y-4">

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

          {/* Payment method */}
          <div>
            <div className="text-xs text-white/40 mb-2.5 font-medium uppercase tracking-wider">Payment Method</div>

            {detecting ? (
              <div className="flex items-center gap-2.5 text-white/40 text-sm py-3">
                <Loader2 size={14} className="animate-spin" />
                Detecting best payment method…
              </div>
            ) : gatewayInfo ? (
              <div className="space-y-3">

                {/* Mobile money option (primary for MoMo regions) */}
                {gatewayInfo.isMobileMoney && (
                  <button
                    onClick={() => setUseCardFallback(false)}
                    className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                      !useCardFallback
                        ? "border-green-500/40 bg-green-900/10"
                        : "border-white/8 bg-white/[0.02] hover:bg-white/5"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                      <Smartphone size={16} className={momoColor} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className={`text-sm font-semibold ${!useCardFallback ? momoColor : "text-white"}`}>
                        {momoLabel}
                      </div>
                      <div className="text-xs text-white/35 mt-0.5">
                        Pay directly from your mobile wallet
                      </div>
                    </div>
                    {!useCardFallback && (
                      <div className="shrink-0 w-4 h-4 rounded-full border-2 border-green-400 bg-green-400/30" />
                    )}
                  </button>
                )}

                {/* Card option — always shown as secondary for MoMo, primary otherwise */}
                {gatewayInfo.isMobileMoney && gatewayInfo.cardFallbackGateway ? (
                  <button
                    onClick={() => setUseCardFallback(true)}
                    className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                      useCardFallback
                        ? "border-blue-500/40 bg-blue-900/10"
                        : "border-white/8 bg-white/[0.02] hover:bg-white/5"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                      <CreditCard size={16} className={useCardFallback ? "text-blue-400" : "text-white/50"} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className={`text-sm font-semibold ${useCardFallback ? "text-blue-400" : "text-white"}`}>
                        Pay by Card
                      </div>
                      <div className="text-xs text-white/35 mt-0.5">
                        Visa, Mastercard — secure hosted checkout
                      </div>
                    </div>
                    {useCardFallback && (
                      <div className="shrink-0 w-4 h-4 rounded-full border-2 border-blue-400 bg-blue-400/30" />
                    )}
                  </button>
                ) : !gatewayInfo.isMobileMoney ? (
                  /* Non-MoMo: just show the single detected gateway */
                  <div className="flex items-center gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3">
                    <div className="w-9 h-9 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                      <GatewayIcon size={16} className="text-white/70" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{gatewayLabel}</div>
                      <div className="text-xs text-white/35 mt-0.5">Secure hosted checkout</div>
                    </div>
                    <ShieldCheck size={14} className="ml-auto text-green-400/70 shrink-0" />
                  </div>
                ) : null}

                {/* Insufficient funds hint for MoMo users */}
                {gatewayInfo.isMobileMoney && !useCardFallback && gatewayInfo.cardFallbackGateway && (
                  <button
                    onClick={() => setUseCardFallback(true)}
                    className="w-full flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors py-1 justify-center"
                  >
                    <AlertCircle size={11} />
                    Insufficient funds on {momoLabel}? Pay by card instead
                    <ArrowRight size={10} />
                  </button>
                )}
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
                {isMoMo ? `Pay via ${momoLabel}` : "Pay"} {formatAmount(amountCents)}
              </>
            )}
          </button>
        </div>

        {/* Retry detection */}
        {!detecting && !gatewayInfo && (
          <div className="px-6 pb-4 text-center">
            <button
              onClick={doDetect}
              className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              <RefreshCw size={11} />
              Retry gateway detection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
