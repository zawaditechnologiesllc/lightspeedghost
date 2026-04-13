import { useMemo, useState } from "react";
import { scoreSentences, type SentenceScore } from "@/lib/textAnalysis";
import { Eye, EyeOff, Info } from "lucide-react";

function probColor(p: number): string {
  if (p >= 80) return "bg-red-500/30 border-red-500/40";
  if (p >= 60) return "bg-orange-500/25 border-orange-500/35";
  if (p >= 40) return "bg-yellow-500/20 border-yellow-500/30";
  if (p >= 20) return "bg-blue-500/10 border-blue-500/20";
  return "bg-transparent border-transparent";
}

function probLabel(p: number): string {
  if (p >= 80) return "Very likely AI";
  if (p >= 60) return "Likely AI";
  if (p >= 40) return "Possibly AI";
  if (p >= 20) return "Likely human";
  return "Human-written";
}

function probTextColor(p: number): string {
  if (p >= 80) return "text-red-400";
  if (p >= 60) return "text-orange-400";
  if (p >= 40) return "text-yellow-400";
  return "text-green-400";
}

const LEGEND = [
  { label: "Very likely AI (80%+)", color: "bg-red-500/40" },
  { label: "Likely AI (60-79%)", color: "bg-orange-500/35" },
  { label: "Possibly AI (40-59%)", color: "bg-yellow-500/30" },
  { label: "Likely Human (20-39%)", color: "bg-blue-500/20" },
  { label: "Human (<20%)", color: "bg-transparent border border-white/10" },
];

export function SentenceHighlighter({ text, aiScore }: { text: string; aiScore: number }) {
  const scored = useMemo(() => scoreSentences(text, aiScore), [text, aiScore]);
  const [showHighlights, setShowHighlights] = useState(true);
  const [selectedSentence, setSelectedSentence] = useState<SentenceScore | null>(null);

  const distribution = useMemo(() => {
    const bins = { high: 0, medium: 0, low: 0, human: 0 };
    scored.forEach((s) => {
      if (s.aiProbability >= 70) bins.high++;
      else if (s.aiProbability >= 40) bins.medium++;
      else if (s.aiProbability >= 20) bins.low++;
      else bins.human++;
    });
    return bins;
  }, [scored]);

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Eye size={16} className="text-blue-400" />
          Sentence-Level AI Detection
        </h3>
        <button
          onClick={() => setShowHighlights(!showHighlights)}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          {showHighlights ? <EyeOff size={12} /> : <Eye size={12} />}
          {showHighlights ? "Hide" : "Show"} highlights
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${l.color}`} />
            <span className="text-[10px] text-white/40">{l.label}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="flex-1 bg-white/[0.03] rounded-lg p-2 text-center">
          <div className="text-red-400 font-bold text-lg">{distribution.high}</div>
          <div className="text-[10px] text-white/40">High AI</div>
        </div>
        <div className="flex-1 bg-white/[0.03] rounded-lg p-2 text-center">
          <div className="text-yellow-400 font-bold text-lg">{distribution.medium}</div>
          <div className="text-[10px] text-white/40">Medium</div>
        </div>
        <div className="flex-1 bg-white/[0.03] rounded-lg p-2 text-center">
          <div className="text-blue-400 font-bold text-lg">{distribution.low}</div>
          <div className="text-[10px] text-white/40">Low</div>
        </div>
        <div className="flex-1 bg-white/[0.03] rounded-lg p-2 text-center">
          <div className="text-green-400 font-bold text-lg">{distribution.human}</div>
          <div className="text-[10px] text-white/40">Human</div>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 max-h-80 overflow-y-auto leading-relaxed text-sm text-white/80">
        {scored.map((s, i) => (
          <span
            key={i}
            onClick={() => setSelectedSentence(selectedSentence === s ? null : s)}
            className={`cursor-pointer rounded px-0.5 py-0.5 border transition-all ${
              showHighlights ? probColor(s.aiProbability) : "border-transparent"
            } ${selectedSentence === s ? "ring-1 ring-blue-500" : ""}`}
          >
            {s.text}{" "}
          </span>
        ))}
      </div>

      {selectedSentence && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-blue-400" />
            <span className="text-xs text-white/60">Sentence Analysis</span>
          </div>
          <p className="text-sm text-white/70 italic">"{selectedSentence.text}"</p>
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-white/40">AI Probability: </span>
              <span className={`text-sm font-bold ${probTextColor(selectedSentence.aiProbability)}`}>
                {selectedSentence.aiProbability}%
              </span>
            </div>
            <div>
              <span className="text-xs text-white/40">Verdict: </span>
              <span className={`text-xs font-medium ${probTextColor(selectedSentence.aiProbability)}`}>
                {probLabel(selectedSentence.aiProbability)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
