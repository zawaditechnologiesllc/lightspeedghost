import { useMemo } from "react";
import { detectTone, type ToneResult } from "@/lib/textAnalysis";
import { Mic, TrendingUp } from "lucide-react";

const TONE_COLORS: Record<string, string> = {
  formal: "bg-purple-500",
  casual: "bg-green-500",
  confident: "bg-blue-500",
  tentative: "bg-yellow-500",
  analytical: "bg-cyan-500",
  persuasive: "bg-orange-500",
  neutral: "bg-gray-500",
};

const TONE_LABELS: Record<string, string> = {
  formal: "Formal",
  casual: "Casual",
  confident: "Confident",
  tentative: "Tentative",
  analytical: "Analytical",
  persuasive: "Persuasive",
};

export function TonePanel({ text }: { text: string }) {
  const tone = useMemo(() => detectTone(text), [text]);

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4">
      <h3 className="font-semibold text-white flex items-center gap-2">
        <Mic size={16} className="text-blue-400" />
        Tone Analysis
      </h3>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${TONE_COLORS[tone.dominant] || "bg-gray-500"}`} />
          <span className="text-white font-medium capitalize">{tone.dominant}</span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <div className="text-sm text-white/50">
          Formality: <span className="text-white/80 font-medium">{tone.formality}%</span>
        </div>
      </div>

      <div className="space-y-2">
        {tone.scores
          .filter((s) => s.score > 0)
          .map((s) => (
            <div key={s.tone}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white/50">{TONE_LABELS[s.tone] || s.tone}</span>
                <span className="text-white/60">{s.score}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${TONE_COLORS[s.tone] || "bg-gray-500"}`}
                  style={{ width: `${Math.min(100, s.score * 2)}%` }}
                />
              </div>
            </div>
          ))}
      </div>

      <div className="flex items-start gap-2 bg-white/[0.03] border border-white/5 rounded-xl p-3">
        <TrendingUp size={14} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-white/60 leading-relaxed">{tone.suggestion}</p>
      </div>

      <div className="border-t border-white/5 pt-3">
        <div className="flex items-center justify-between text-xs text-white/30">
          <span>Formality Scale</span>
          <span>{tone.formality < 40 ? "Informal" : tone.formality < 60 ? "Moderate" : "Formal"}</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full mt-1.5 relative overflow-hidden">
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-green-500/20" />
            <div className="flex-1 bg-yellow-500/20" />
            <div className="flex-1 bg-purple-500/20" />
          </div>
          <div
            className="absolute top-0 w-3 h-full bg-white rounded-full shadow-lg transform -translate-x-1/2"
            style={{ left: `${tone.formality}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/20 mt-1">
          <span>Casual</span>
          <span>Moderate</span>
          <span>Formal</span>
        </div>
      </div>
    </div>
  );
}
