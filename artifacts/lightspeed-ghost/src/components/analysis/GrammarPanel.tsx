import { useMemo, useState } from "react";
import { checkGrammar, type GrammarIssue } from "@/lib/textAnalysis";
import { AlertTriangle, XCircle, Lightbulb, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";

const SEVERITY_CONFIG = {
  error: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Error" },
  warning: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", label: "Warning" },
  suggestion: { icon: Lightbulb, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Suggestion" },
};

const TYPE_LABELS: Record<string, string> = {
  grammar: "Grammar",
  spelling: "Spelling",
  punctuation: "Punctuation",
  style: "Style",
  clarity: "Clarity",
};

export function GrammarPanel({ text }: { text: string }) {
  const issues = useMemo(() => checkGrammar(text), [text]);
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? issues : issues.filter((i) => i.type === filter || i.severity === filter);

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const suggestionCount = issues.filter((i) => i.severity === "suggestion").length;

  const overallScore = Math.max(0, 100 - errorCount * 5 - warningCount * 2 - suggestionCount);

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <h3 className="font-semibold text-white flex items-center gap-2">
          <CheckCircle size={16} className={overallScore >= 80 ? "text-green-400" : overallScore >= 50 ? "text-yellow-400" : "text-red-400"} />
          Grammar & Style Check
        </h3>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${overallScore >= 80 ? "text-green-400" : overallScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
            {overallScore}/100
          </span>
          {expanded ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
        </div>
      </div>

      {expanded && (
        <>
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                <XCircle size={10} /> {errorCount} errors
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                <AlertTriangle size={10} /> {warningCount} warnings
              </span>
            )}
            {suggestionCount > 0 && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Lightbulb size={10} /> {suggestionCount} suggestions
              </span>
            )}
            {issues.length === 0 && (
              <span className="text-xs text-green-400">No issues found — looking clean!</span>
            )}
          </div>

          {issues.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {["all", "error", "warning", "suggestion", "grammar", "spelling", "punctuation", "style", "clarity"].map((f) => (
                <button
                  key={f}
                  onClick={(e) => { e.stopPropagation(); setFilter(f); }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                    filter === f ? "bg-blue-600/20 text-blue-400 border-blue-500/30" : "bg-white/[0.03] text-white/50 border-white/10 hover:border-white/20"
                  }`}
                >
                  {f === "all" ? "All" : TYPE_LABELS[f] || f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filtered.slice(0, 20).map((issue, i) => {
              const cfg = SEVERITY_CONFIG[issue.severity];
              const Icon = cfg.icon;
              return (
                <div key={i} className={`${cfg.bg} border ${cfg.border} rounded-xl p-3`}>
                  <div className="flex items-start gap-2">
                    <Icon size={14} className={`${cfg.color} mt-0.5 shrink-0`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-[10px] text-white/30 px-1.5 py-0.5 rounded bg-white/5">{TYPE_LABELS[issue.type]}</span>
                      </div>
                      <p className="text-sm text-white/80">{issue.message}</p>
                      {issue.suggestion && (
                        <p className="text-xs text-green-400/80 mt-1">
                          Suggestion: <span className="font-medium">{issue.suggestion}</span>
                        </p>
                      )}
                      <p className="text-xs text-white/25 mt-1.5 font-mono truncate">…{issue.context}…</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length > 20 && (
              <p className="text-xs text-white/30 text-center pt-2">
                +{filtered.length - 20} more issues
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
