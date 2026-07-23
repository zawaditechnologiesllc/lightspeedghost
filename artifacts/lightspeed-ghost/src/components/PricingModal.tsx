import { useState } from "react";
import { X, Check, Zap, Sparkles, Crown, Building2, ArrowRight } from "lucide-react";

// Pricing popup opened from the top-right "Start for free" / "Upgrade" buttons.
// Shows the plan lineup (Free / Pro / Institution) plus a Pay-As-You-Go option.
// All CTAs are delegated to the parent so it can open the auth popup or jump to
// the detailed PAYG table on the page.

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
  onStartFree: () => void;
  onGetPro: (annual: boolean) => void;
  onInstitution: () => void;
  onPayg: () => void;
  onLogin: () => void;
}

export function PricingModal({ open, onClose, onStartFree, onGetPro, onInstitution, onPayg, onLogin }: PricingModalProps) {
  const [annual, setAnnual] = useState(false);
  if (!open) return null;

  const plans = [
    {
      key: "free",
      name: "Free",
      icon: Zap,
      price: "$0",
      per: "forever · no card",
      desc: "Check your writing without spending a cent — and without your text ever touching an AI model.",
      features: [
        "Unlimited in-browser Writing Analyzer",
        "3 plagiarism + AI checks / month (local)",
        "Your text never touches an AI model",
      ],
      cta: "Start free",
      onClick: onStartFree,
      highlight: false,
    },
    {
      key: "pro",
      name: "Pro",
      icon: Crown,
      price: annual ? "$22.42" : "$29.99",
      per: annual ? "/ mo · billed $269/yr" : "/ month",
      desc: "Every tool unlocked — write from real research, humanize, revise, and solve STEM.",
      features: [
        "15 papers · 20 revisions · 20 humanizer / mo",
        "60 STEM · 150 study · 20 AI + plagiarism checks",
        "Priority processing + export formats",
      ],
      cta: "Get Pro",
      onClick: () => onGetPro(annual),
      highlight: true,
    },
    {
      key: "institution",
      name: "Institution",
      icon: Building2,
      price: "Custom",
      per: "seats · one invoice",
      desc: "For universities, tutoring centers, and study groups. Custom seats, admin dashboard, one invoice.",
      features: [
        "All Pro tools for every seat",
        "Shared library + admin dashboard",
        "Academic-integrity reporting + SLA",
      ],
      cta: "Contact sales",
      onClick: onInstitution,
      highlight: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#131b2e]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-[#f7f9fb] rounded-2xl shadow-2xl border border-[#e0e3e5] my-4 sm:my-0 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 pt-5 pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#131b2e]">Choose your plan</h2>
            <p className="text-[13px] text-[#45464d] mt-0.5">Start free. Upgrade when you need AI power. Or pay per use.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-[#76777d] hover:text-[#191c1e] hover:bg-white transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Monthly / annual toggle */}
        <div className="flex items-center justify-center gap-3 pb-4">
          <span className={`text-sm font-medium ${!annual ? "text-[#191c1e]" : "text-[#76777d]"}`}>Monthly</span>
          <button
            type="button" role="switch" aria-checked={annual} aria-label="Bill annually"
            onClick={() => setAnnual((a) => !a)}
            className={`relative w-11 h-6 rounded-full transition-colors ${annual ? "bg-[#6b38d4]" : "bg-[#c6c6cd]"}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow ${annual ? "left-6" : "left-1"}`} />
          </button>
          <span className={`text-sm font-medium ${annual ? "text-[#191c1e]" : "text-[#76777d]"}`}>Annual</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Save 25%</span>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-3 px-5 sm:px-7">
          {plans.map(({ key, name, icon: Icon, price, per, desc, features, cta, onClick, highlight }) => (
            <div
              key={key}
              className={`relative rounded-xl p-4 flex flex-col bg-white border ${highlight ? "border-2 border-[#6b38d4] shadow-lg shadow-[#6b38d4]/10" : "border-[#e0e3e5]"}`}
            >
              {highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-[#6b38d4] text-white uppercase tracking-wide">Most popular</span>
              )}
              <div className="flex items-center gap-2 mb-2">
                <Icon size={15} className={highlight ? "text-[#6b38d4]" : "text-[#45464d]"} />
                <span className="font-bold text-[#191c1e]">{name}</span>
              </div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-2xl font-bold text-[#131b2e]">{price}</span>
                <span className="text-[11px] text-[#76777d] mb-1">{per}</span>
              </div>
              <p className="text-[11px] text-[#45464d] leading-snug mb-3">{desc}</p>
              <ul className="space-y-1.5 mb-4 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12px] text-[#45464d]">
                    <Check size={13} className={`shrink-0 mt-0.5 ${highlight ? "text-[#6b38d4]" : "text-emerald-600"}`} strokeWidth={3} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={onClick}
                className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  highlight ? "bg-[#6b38d4] hover:bg-[#5b2fc0] text-white shadow-md shadow-[#6b38d4]/20" : "border border-[#6b38d4] text-[#6b38d4] hover:bg-[#6b38d4]/5"
                }`}
              >
                {cta}
              </button>
            </div>
          ))}
        </div>

        {/* PAYG option */}
        <div className="px-5 sm:px-7 pt-3 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <div className="flex items-center gap-2.5 flex-1">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                <Sparkles size={15} className="text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#191c1e]">No subscription? Pay as you go.</p>
                <p className="text-[11px] text-[#45464d]">One paper, one check, one solve — from $1.99. Credits never expire.</p>
              </div>
            </div>
            <button
              onClick={onPayg}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-100 text-xs font-bold transition-colors shrink-0"
            >
              See PAYG pricing <ArrowRight size={13} />
            </button>
          </div>

          <p className="text-center text-[12px] text-[#76777d] mt-4">
            Already have an account?{" "}
            <button onClick={onLogin} className="text-[#6b38d4] hover:text-[#5b2fc0] font-semibold">Log in</button>
          </p>
        </div>
      </div>
    </div>
  );
}
