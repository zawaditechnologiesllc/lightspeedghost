import { useMemo } from "react";
import { checkStyleConsistency } from "@/lib/textAnalysis";
import { Layers, AlertTriangle, CheckCircle } from "lucide-react";

function Ring({ value, size = 56 }: { value: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = value >= 80 ? "#22c55e" : value >= 50 ? "#eab308" : "#ef4444";

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="14" fontWeight="bold">
        {value}
      </text>
    </svg>
  );
}

export function StyleConsistencyPanel({ text }: { text: string }) {
  const result = useMemo(() => checkStyleConsistency(text), [text]);

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Layers size={16} className="text-blue-400" />
          Style Consistency
        </h3>
        <Ring value={result.overallScore} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
          <div className="text-xs text-white/50 mb-1">Sentence Variance</div>
          <div className="text-lg font-bold text-white">{result.sentenceLengthVariance}</div>
          <div className="text-[10px] text-white/30">{result.sentenceLengthVariance < 5 ? "Too uniform" : result.sentenceLengthVariance > 12 ? "Very varied" : "Good range"}</div>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
          <div className="text-xs text-white/50 mb-1">Vocabulary Diversity</div>
          <div className="text-lg font-bold text-white">{result.vocabularyDiversity}%</div>
          <div className="text-[10px] text-white/30">{result.vocabularyDiversity > 60 ? "Rich" : result.vocabularyDiversity > 40 ? "Moderate" : "Repetitive"}</div>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
          <div className="text-xs text-white/50 mb-1">Passive Voice</div>
          <div className="text-lg font-bold text-white">{result.passiveVoicePercent}%</div>
          <div className="text-[10px] text-white/30">{result.passiveVoicePercent > 30 ? "High — reduce" : "Acceptable"}</div>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
          <div className="text-xs text-white/50 mb-1">Tone Shifts</div>
          <div className="text-lg font-bold text-white">{result.toneShifts.length}</div>
          <div className="text-[10px] text-white/30">{result.toneShifts.length === 0 ? "Consistent" : "Style changes"}</div>
        </div>
      </div>

      {result.toneShifts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-white/50 font-medium">Detected tone shifts:</p>
          {result.toneShifts.map((shift, i) => (
            <div key={i} className="bg-yellow-500/5 border border-yellow-500/10 rounded-lg p-2.5">
              <div className="flex items-center gap-2 text-xs">
                <AlertTriangle size={12} className="text-yellow-400" />
                <span className="text-yellow-400">
                  Sentence {shift.position}: <span className="capitalize">{shift.from}</span> → <span className="capitalize">{shift.to}</span>
                </span>
              </div>
              <p className="text-[10px] text-white/30 mt-1 truncate">{shift.context}</p>
            </div>
          ))}
        </div>
      )}

      {result.issues.length > 0 && (
        <div className="space-y-1.5">
          {result.issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-white/50">
              <AlertTriangle size={10} className="text-yellow-400 mt-0.5 shrink-0" />
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}

      {result.issues.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <CheckCircle size={12} />
          Writing style is consistent throughout the document
        </div>
      )}
    </div>
  );
}
