import { useState } from "react";
import {
  X, PenLine, BookOpen, Files, ShieldCheck, FlaskConical,
  GraduationCap, Wand2, ShoppingCart, ChevronDown,
} from "lucide-react";
import {
  PAYG_PRICES, DOCUMENT_TIERS, TIER_LABELS, formatAmount,
  type PaygTool, type DocumentTier,
} from "@/lib/pricing";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";

interface PAYGMarketModalProps {
  open: boolean;
  onClose: () => void;
}

interface ToolItem {
  key: PaygTool;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  tiered: boolean;
}

const TOOLS: ToolItem[] = [
  { key: "paper",      label: "Write Paper",          desc: "Full paper with real verified citations",     icon: PenLine,       color: "text-blue-400",    bg: "bg-blue-500/10",   tiered: true },
  { key: "revision",   label: "Revise Paper",          desc: "AI revision with tracked changes",            icon: Files,         color: "text-violet-400",  bg: "bg-violet-500/10", tiered: true },
  { key: "humanizer",  label: "LightSpeed Humanizer",  desc: "AI bypass — drop score below 15%",           icon: Wand2,         color: "text-purple-400",  bg: "bg-purple-500/10", tiered: true },
  { key: "stem",       label: "STEM Problem",          desc: "Step-by-step solve with graphs — $0.99",     icon: FlaskConical,  color: "text-cyan-400",    bg: "bg-cyan-500/10",   tiered: false },
  { key: "study",      label: "Study Day Pass",        desc: "Unlimited AI tutor for 24 hours — $1.99",    icon: GraduationCap, color: "text-amber-400",   bg: "bg-amber-500/10",  tiered: false },
  { key: "plagiarism", label: "Plagiarism Check",      desc: "Full AI + similarity scan — $0.99",          icon: ShieldCheck,   color: "text-emerald-400", bg: "bg-emerald-500/10",tiered: false },
  { key: "outline",    label: "Outline",               desc: "Structured outline for any paper — $0.49",   icon: BookOpen,      color: "text-indigo-400",  bg: "bg-indigo-500/10", tiered: false },
];

const TIER_MIN: Partial<Record<PaygTool, number>> = {
  paper:     199,
  revision:  99,
  humanizer: 99,
};

export function PAYGMarketModal({ open, onClose }: PAYGMarketModalProps) {
  const [tiers, setTiers] = useState<Partial<Record<PaygTool, DocumentTier>>>({});
  const [checkout, setCheckout] = useState<{ tool: PaygTool; tier?: DocumentTier } | null>(null);

  if (!open) return null;

  function getPrice(tool: ToolItem): number {
    const entry = PAYG_PRICES[tool.key];
    if (typeof entry === "number") return entry;
    const tier = tiers[tool.key];
    if (!tier) return TIER_MIN[tool.key] ?? 0;
    return (entry as Record<DocumentTier, number>)[tier] ?? 0;
  }

  function handleBuy(tool: ToolItem) {
    const tier = tool.tiered ? tiers[tool.key] : undefined;
    setCheckout({ tool: tool.key, tier });
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <ShoppingCart size={15} className="text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Pay-As-You-Go Market</p>
                <p className="text-[11px] text-muted-foreground">One-time purchases · no subscription needed</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            <p className="text-[11px] text-muted-foreground px-0.5">
              Pay per use with any available payment method — card, M-Pesa, Airtel, MTN MoMo, and more — based on your region.
            </p>

            {TOOLS.map((tool) => {
              const price = getPrice(tool);
              const Icon = tool.icon;
              return (
                <div
                  key={tool.key}
                  className="rounded-xl border border-border bg-muted/20 p-4 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl ${tool.bg} flex items-center justify-center shrink-0`}>
                      <Icon size={16} className={tool.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{tool.label}</p>
                        <span className="text-sm font-bold text-orange-400 shrink-0">
                          {tool.tiered && !tiers[tool.key] ? `from ${formatAmount(price)}` : formatAmount(price)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 mb-2.5">{tool.desc}</p>

                      {tool.tiered && (
                        <div className="relative mb-2.5">
                          <select
                            value={tiers[tool.key] ?? ""}
                            onChange={(e) =>
                              setTiers((prev) => ({ ...prev, [tool.key]: e.target.value as DocumentTier || undefined }))
                            }
                            className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground pr-8 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                          >
                            <option value="">Select document type…</option>
                            {DOCUMENT_TIERS.map((t) => (
                              <option key={t} value={t}>
                                {TIER_LABELS[t]} — {formatAmount((PAYG_PRICES[tool.key] as Record<DocumentTier, number>)[t])}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                      )}

                      <button
                        onClick={() => handleBuy(tool)}
                        disabled={tool.tiered && !tiers[tool.key]}
                        className="w-full py-2 rounded-lg bg-orange-500/15 border border-orange-500/25 text-orange-400 text-xs font-semibold hover:bg-orange-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {tool.tiered && !tiers[tool.key] ? "Select type to buy" : `Buy · ${formatAmount(price)}`}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {checkout && (
        <CheckoutModal
          open={true}
          onClose={() => setCheckout(null)}
          mode="payg"
          tool={checkout.tool}
          tier={checkout.tier}
          onSuccess={() => { setCheckout(null); onClose(); }}
        />
      )}
    </>
  );
}
