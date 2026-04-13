import { TrendingDown, ArrowDown, Shield } from "lucide-react";

interface ScoreComparisonProps {
  beforeScore: number;
  afterScore: number;
  label?: string;
}

function ScoreRing({ value, size = 80, color }: { value: number; size?: number; color: string }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;

  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-1000 ease-out"
      />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="20" fontWeight="bold">
        {value}%
      </text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">
        AI Score
      </text>
    </svg>
  );
}

export function ScoreComparison({ beforeScore, afterScore, label = "AI Detection Score" }: ScoreComparisonProps) {
  const reduction = beforeScore - afterScore;
  const reductionPct = beforeScore > 0 ? Math.round((reduction / beforeScore) * 100) : 0;

  const beforeColor = beforeScore >= 60 ? "#ef4444" : beforeScore >= 30 ? "#eab308" : "#22c55e";
  const afterColor = afterScore >= 30 ? "#eab308" : afterScore >= 10 ? "#3b82f6" : "#22c55e";

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
      <h3 className="font-semibold text-white flex items-center gap-2 mb-5">
        <Shield size={16} className="text-blue-400" />
        {label}
      </h3>

      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <ScoreRing value={beforeScore} color={beforeColor} />
          <p className="text-xs text-white/40 mt-2">Before</p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <ArrowDown size={20} className="text-green-400" />
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5">
            <div className="flex items-center gap-1">
              <TrendingDown size={12} className="text-green-400" />
              <span className="text-green-400 font-bold text-sm">-{reduction}pts</span>
            </div>
          </div>
          <span className="text-[10px] text-white/30">{reductionPct}% reduction</span>
        </div>

        <div className="text-center">
          <ScoreRing value={afterScore} color={afterColor} />
          <p className="text-xs text-white/40 mt-2">After</p>
        </div>
      </div>

      <div className="mt-5 bg-white/[0.03] border border-white/5 rounded-xl p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Detection Risk</span>
          <span className={`font-medium ${afterScore <= 5 ? "text-green-400" : afterScore <= 20 ? "text-blue-400" : afterScore <= 40 ? "text-yellow-400" : "text-red-400"}`}>
            {afterScore <= 5 ? "Undetectable" : afterScore <= 20 ? "Very Low Risk" : afterScore <= 40 ? "Moderate Risk" : "High Risk — consider re-humanizing"}
          </span>
        </div>
      </div>
    </div>
  );
}
