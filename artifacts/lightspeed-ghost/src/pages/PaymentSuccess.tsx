import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Loader2, XCircle, ArrowRight } from "lucide-react";
import { usePaymentGateway } from "@/hooks/usePaymentGateway";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const { verifyPayment } = usePaymentGateway();

  const [status, setStatus] = useState<"verifying" | "success" | "failed">("verifying");
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gateway = params.get("gateway") ?? "";
    const sessionId = params.get("session_id") ?? params.get("reference") ?? "";

    if (!gateway) {
      setStatus("failed");
      return;
    }

    let attempts = 0;
    const maxAttempts = 6;

    const tryVerify = () => {
      verifyPayment(gateway, sessionId).then((result) => {
        if (result.confirmed) {
          setStatus("success");
          setPlan(result.plan);
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(tryVerify, 3000);
          } else {
            setStatus("failed");
          }
        }
      }).catch(() => {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(tryVerify, 3000);
        } else {
          setStatus("failed");
        }
      });
    };

    tryVerify();
  }, [verifyPayment]);

  return (
    <div className="min-h-screen bg-[#04080f] flex items-center justify-center px-4">
      <div className="text-center max-w-md">

        {status === "verifying" && (
          <div className="space-y-4">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto">
              <Loader2 size={32} className="text-white/40 animate-spin" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white mb-2">Verifying payment…</h1>
              <p className="text-white/40 text-sm">Please wait while we confirm your payment.</p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-5">
            <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
              <CheckCircle size={36} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {plan === "pro" || plan === "campus" ? "You're now on Pro!" : "Payment successful!"}
              </h1>
              <p className="text-white/50 text-sm leading-relaxed">
                {plan === "pro" || plan === "campus"
                  ? "Your subscription is active. Enjoy unlimited access to all LightSpeed Ghost tools."
                  : "Your purchase is confirmed. Head to your dashboard to get started."}
              </p>
            </div>
            <button
              onClick={() => setLocation("/app")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all text-sm"
            >
              Go to Dashboard
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {status === "failed" && (
          <div className="space-y-5">
            <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
              <XCircle size={36} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Payment not confirmed</h1>
              <p className="text-white/50 text-sm leading-relaxed">
                We couldn't verify your payment. If you were charged, contact our support team and we'll sort it out within 24 hours.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setLocation("/pricing")}
                className="px-5 py-2.5 border border-white/10 hover:border-white/20 text-white/70 hover:text-white rounded-xl text-sm transition-colors"
              >
                Back to Pricing
              </button>
              <button
                onClick={() => setLocation("/app")}
                className="px-5 py-2.5 bg-white/8 hover:bg-white/12 text-white rounded-xl text-sm transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
