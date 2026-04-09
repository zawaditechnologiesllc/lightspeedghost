import { useState } from "react";
import { X, Coins, Star, Zap, ChevronRight, ShieldCheck, CheckCircle } from "lucide-react";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import { formatAmount } from "@/lib/pricing";

interface BuyCreditsModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CREDIT_PACKAGES = [
  {
    id:          "credits_500",
    priceCents:  500,
    credits:     500,
    label:       "Starter",
    bonus:       null,
    popular:     false,
    best:        false,
    color:       "border-border",
    highlight:   "",
    desc:        "Great for trying credits out",
  },
  {
    id:          "credits_1100",
    priceCents:  1000,
    credits:     1100,
    label:       "Basic",
    bonus:       "+10%",
    popular:     true,
    best:        false,
    color:       "border-primary/40",
    highlight:   "bg-primary/5",
    desc:        "Most popular — 10% bonus credits",
  },
  {
    id:          "credits_2850",
    priceCents:  2500,
    credits:     2850,
    label:       "Standard",
    bonus:       "+14%",
    popular:     false,
    best:        false,
    color:       "border-border",
    highlight:   "",
    desc:        "Good for regular users",
  },
  {
    id:          "credits_6000",
    priceCents:  5000,
    credits:     6000,
    label:       "Premium",
    bonus:       "+20%",
    popular:     false,
    best:        true,
    color:       "border-amber-500/40",
    highlight:   "bg-amber-500/5",
    desc:        "Best value — 20% bonus credits",
  },
] as const;

export type CreditPackageId = typeof CREDIT_PACKAGES[number]["id"];

export function formatCredits(cents: number): string {
  if (cents >= 100) return `${(cents / 100).toFixed(2)}`;
  return `${cents}¢`;
}

export function creditsToDisplay(cents: number): string {
  return cents.toLocaleString();
}

export function BuyCreditsModal({ open, onClose, onSuccess }: BuyCreditsModalProps) {
  const [selected, setSelected] = useState<CreditPackageId>("credits_1100");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  if (!open) return null;

  const pkg = CREDIT_PACKAGES.find((p) => p.id === selected)!;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative flex items-center justify-center px-5 py-4 border-b border-border shrink-0">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Coins size={15} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Buy Credits</p>
                <p className="text-[11px] text-muted-foreground">Use credits for any tool — no expiry</p>
              </div>
            </div>
            <button onClick={onClose} className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-3">
            {/* How credits work */}
            <div className="rounded-xl bg-muted/30 border border-border p-3 flex items-start gap-2.5">
              <Zap size={13} className="text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">1 credit = $0.01.</span> At checkout, your credit balance is checked first — if you have enough, the purchase is instant with no redirect. Credits never expire.
              </p>
            </div>

            {/* Credit equivalences */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "STEM solve",        cost: "99 cr" },
                { label: "Plagiarism check",  cost: "99 cr" },
                { label: "Outline",           cost: "49 cr" },
                { label: "Essay humanize",    cost: "199 cr" },
              ].map(({ label, cost }) => (
                <div key={label} className="flex items-center gap-1.5 text-[11px]">
                  <CheckCircle size={10} className="text-emerald-400 shrink-0" />
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground font-mono ml-auto">{cost}</span>
                </div>
              ))}
            </div>

            {/* Packages */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">Choose a package</p>
              {CREDIT_PACKAGES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`w-full flex items-center gap-3 rounded-xl border p-3.5 transition-all text-left ${p.color} ${p.highlight} ${
                    selected === p.id ? "ring-2 ring-primary/50" : "hover:border-primary/30"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    selected === p.id ? "border-primary bg-primary" : "border-muted-foreground/40"
                  }`}>
                    {selected === p.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{p.label}</span>
                      {p.popular && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-medium">Popular</span>
                      )}
                      {p.best && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium flex items-center gap-0.5">
                          <Star size={8} /> Best value
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-muted-foreground font-mono">{p.credits.toLocaleString()} credits</span>
                      {p.bonus && (
                        <span className="text-[10px] text-emerald-400 font-semibold">{p.bonus} bonus</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0">{formatAmount(p.priceCents)}</span>
                </button>
              ))}
            </div>

            {/* Buy button */}
            <button
              onClick={() => setCheckoutOpen(true)}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <Coins size={15} />
              Buy {pkg.credits.toLocaleString()} credits · {formatAmount(pkg.priceCents)}
              <ChevronRight size={14} />
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/50">
              <ShieldCheck size={10} />
              Secure checkout · All payment methods · Credits added instantly on confirmation
            </div>
          </div>
        </div>
      </div>

      {checkoutOpen && (
        <CheckoutModal
          open={true}
          onClose={() => setCheckoutOpen(false)}
          mode="credits"
          creditPackageId={selected}
          creditPackageCents={pkg.priceCents}
          creditPackageCredits={pkg.credits}
          onSuccess={() => {
            setCheckoutOpen(false);
            onSuccess?.();
            onClose();
          }}
        />
      )}
    </>
  );
}
