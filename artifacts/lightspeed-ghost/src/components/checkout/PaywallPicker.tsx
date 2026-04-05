import { useState } from "react";
import {
  X, Zap, CreditCard, CheckCircle, Sparkles,
  ArrowRight, Lock,
} from "lucide-react";
import {
  formatAmount, getPaygPrice, DOCUMENT_TIERS, TIER_LABELS, TIER_WORD_RANGES,
  type PaygTool, type DocumentTier,
} from "@/lib/pricing";

interface PaywallPickerProps {
  open: boolean;
  onClose: () => void;
  tool: PaygTool;
  tier?: DocumentTier;
  onChooseSubscription: () => void;
  onChoosePayg: (tier?: DocumentTier) => void;
  currentPlan?: string | null;
}

const TOOL_LABELS: Record<PaygTool, string> = {
  paper:      "paper generation",
  revision:   "paper revision",
  humanizer:  "Ghost Writer",
  stem:       "STEM solve",
  study:      "study session",
  plagiarism: "plagiarism check",
  outline:    "outline generation",
};

const TOOL_VERB: Record<PaygTool, string> = {
  paper:      "Generate this paper",
  revision:   "Revise this paper",
  humanizer:  "Humanize this text",
  stem:       "Solve this problem",
  study:      "Start this session",
  plagiarism: "Check this text",
  outline:    "Generate this outline",
};

const TIER_TOOLS: PaygTool[] = ["paper", "revision", "humanizer"];

const PRO_PERKS: Record<PaygTool, string[]> = {
  paper:      ["50 papers/month", "All paper types", "Verified citations", "Priority queue"],
  revision:   ["50 revisions/month", "Full AI+plagiarism analysis", "Grade targeting"],
  humanizer:  ["50 humanizations/month", "Ghost Writer mode", "Style presets"],
  stem:       ["30 STEM solves/day", "All subjects", "Step-by-step + graphs"],
  study:      ["Unlimited study sessions", "Flashcards + quizzes", "Multi-file upload"],
  plagiarism: ["Unlimited plagiarism checks", "AI detection", "Code compare"],
  outline:    ["Unlimited outlines", "Auto-detect paper type", "Reference integration"],
};

export function PaywallPicker({
  open,
  onClose,
  tool,
  tier: initialTier,
  onChooseSubscription,
  onChoosePayg,
  currentPlan,
}: PaywallPickerProps) {
  const needsTier = TIER_TOOLS.includes(tool);
  const [selectedTier, setSelectedTier] = useState<DocumentTier | undefined>(initialTier);

  const paygPrice = getPaygPrice(tool, needsTier ? selectedTier : undefined);
  const canPayg = !needsTier || (selectedTier !== undefined && paygPrice > 0);

  if (!open) return null;

  const isPro = currentPlan === "pro" || currentPlan === "campus";
  const perks = PRO_PERKS[tool];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-[#0a0f1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Lock size={13} className="text-orange-400" />
            </div>
            <span className="text-sm font-semibold text-white">Limit reached</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-white/45 leading-relaxed">
            You've used all your {TOOL_LABELS[tool]}s for this period on your{" "}
            <span className="text-white/70 font-medium capitalize">{currentPlan ?? "Starter"}</span> plan.
            Choose how to continue:
          </p>

          {/* ── Option A: Subscribe ── */}
          {!isPro && (
            <button
              onClick={onChooseSubscription}
              className="w-full group text-left p-4 rounded-xl bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-500/25 hover:border-blue-400/40 hover:from-blue-900/40 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Sparkles size={13} className="text-blue-400" />
                    <span className="text-sm font-bold text-white">Pro Plan</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">BEST VALUE</span>
                  </div>
                  <div className="text-xs text-white/40">$14.99/month · cancel anytime</div>
                </div>
                <ArrowRight size={14} className="text-blue-400/70 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all mt-0.5 shrink-0" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                {perks.map((p) => (
                  <div key={p} className="flex items-center gap-1.5 text-[11px] text-white/55">
                    <CheckCircle size={10} className="text-blue-400/80 shrink-0" />
                    {p}
                  </div>
                ))}
              </div>
            </button>
          )}

          {/* ── Divider ── */}
          {!isPro && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-[11px] text-white/25">or</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>
          )}

          {/* ── Option B: PAYG ── */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard size={13} className="text-orange-400" />
              <span className="text-sm font-semibold text-white">
                {TOOL_VERB[tool]} — pay once
              </span>
            </div>

            {/* Tier selector for paper/revision/humanizer */}
            {needsTier ? (
              <div className="mb-3 space-y-1.5">
                <p className="text-[11px] text-white/35 mb-2">Choose your document type:</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {DOCUMENT_TIERS.map((t) => {
                    const price = getPaygPrice(tool, t);
                    const active = selectedTier === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setSelectedTier(t)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs border transition-all ${
                          active
                            ? "border-orange-500/40 bg-orange-900/15 text-white"
                            : "border-white/8 bg-white/[0.02] text-white/55 hover:border-white/15 hover:text-white/80"
                        }`}
                      >
                        <span className="flex flex-col items-start gap-0.5">
                          <span className={active ? "text-white font-medium" : ""}>{TIER_LABELS[t]}</span>
                          <span className={`text-[10px] ${active ? "text-orange-300/60" : "text-white/25"}`}>{TIER_WORD_RANGES[t]}</span>
                        </span>
                        <span className={`font-semibold shrink-0 ml-2 ${active ? "text-orange-400" : "text-white/40"}`}>
                          {formatAmount(price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs text-white/45">One-time payment</span>
                <span className="text-lg font-bold text-orange-400">{formatAmount(paygPrice)}</span>
              </div>
            )}

            <button
              onClick={() => onChoosePayg(needsTier ? selectedTier : undefined)}
              disabled={!canPayg}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-35 disabled:cursor-not-allowed"
            >
              <Zap size={13} />
              {canPayg
                ? `Pay ${formatAmount(paygPrice)} · ${TOOL_VERB[tool]}`
                : "Select a document type above"}
            </button>

            <p className="mt-2 text-[10px] text-white/20 text-center">
              One-time · no subscription · instant access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
