import { useState } from "react";
import { useCheckPlagiarism, useHumanizeText } from "@workspace/api-client-react";
import { Loader2, ShieldCheck, ShieldAlert, Zap, AlertTriangle } from "lucide-react";
import type { PlagiarismResult } from "@workspace/api-client-react";

export default function Plagiarism() {
  const [text, setText] = useState("");
  const [humanizeIntensity, setHumanizeIntensity] = useState<"light" | "medium" | "heavy">("medium");
  const [result, setResult] = useState<PlagiarismResult | null>(null);
  const [humanizedText, setHumanizedText] = useState<string | null>(null);
  const checkPlagiarism = useCheckPlagiarism();
  const humanizeText = useHumanizeText();

  const handleCheck = async () => {
    if (!text.trim()) return;
    const res = await checkPlagiarism.mutateAsync({ text, checkAi: true, checkPlagiarism: true });
    setResult(res);
    setHumanizedText(null);
  };

  const handleHumanize = async () => {
    const textToHumanize = humanizedText ?? text;
    if (!textToHumanize.trim()) return;
    const res = await humanizeText.mutateAsync({ text: textToHumanize, intensity: humanizeIntensity });
    setHumanizedText(res.humanizedText);
  };

  const riskColors = {
    low: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900",
    medium: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900",
    high: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI & Plagiarism Checker</h1>
        <p className="text-muted-foreground text-sm mt-1">Detect AI-generated content and plagiarism, then humanize your text</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Input Text</h2>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder="Paste your text here to check for AI content and plagiarism..."
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{text.split(/\s+/).filter(Boolean).length} words</span>
              <button
                onClick={handleCheck}
                disabled={!text.trim() || checkPlagiarism.isPending}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {checkPlagiarism.isPending ? (
                  <><Loader2 size={15} className="animate-spin" /> Checking...</>
                ) : (
                  <><ShieldCheck size={15} /> Run Check</>
                )}
              </button>
            </div>
          </div>

          {humanizedText && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm">Humanized Text</h3>
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border border-border">
                {humanizedText}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {result ? (
            <>
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${riskColors[result.overallRisk]}`}>
                {result.overallRisk === "high" ? <ShieldAlert size={16} /> : result.overallRisk === "medium" ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
                <span className="font-semibold capitalize">Overall Risk: {result.overallRisk}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ScoreCard label="AI Content" score={result.aiScore} color="blue" />
                <ScoreCard label="Plagiarism" score={result.plagiarismScore} color="red" />
              </div>

              {result.aiSections.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-sm mb-3">Detected AI Sections</h3>
                  <div className="space-y-2">
                    {result.aiSections.map((section, i) => (
                      <div key={i} className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">AI Score: {section.score.toFixed(0)}%</span>
                        </div>
                        <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">{section.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.plagiarismSources.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-sm mb-3">Plagiarism Sources</h3>
                  <div className="space-y-2">
                    {result.plagiarismSources.map((source, i) => (
                      <div key={i} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                        <div className="flex items-center justify-between mb-1">
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex-1">
                            {source.url}
                          </a>
                          <span className="text-xs font-bold text-red-600 dark:text-red-400 ml-2 shrink-0">{source.similarity}%</span>
                        </div>
                        <p className="text-xs text-foreground/70 leading-relaxed line-clamp-2">{source.matchedText}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.aiScore > 20 && (
                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <h3 className="font-semibold text-sm">Humanize AI Content</h3>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-2">Intensity</label>
                    <div className="flex gap-2">
                      {(["light", "medium", "heavy"] as const).map((intensity) => (
                        <button
                          key={intensity}
                          onClick={() => setHumanizeIntensity(intensity)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                            humanizeIntensity === intensity
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {intensity}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleHumanize}
                    disabled={humanizeText.isPending}
                    className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {humanizeText.isPending ? (
                      <><Loader2 size={14} className="animate-spin" /> Humanizing...</>
                    ) : (
                      <><Zap size={14} /> Humanize Text</>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center text-center gap-3">
              <ShieldCheck size={32} className="text-muted-foreground/40" />
              <div className="text-muted-foreground text-sm">Paste your text and run a check to see results here</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ label, score, color }: { label: string; score: number; color: "blue" | "red" }) {
  const colorMap = {
    blue: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-900", bar: "bg-blue-500", text: "text-blue-700 dark:text-blue-400" },
    red: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-900", bar: "bg-red-500", text: "text-red-700 dark:text-red-400" },
  };
  const c = colorMap[color];
  return (
    <div className={`${c.bg} ${c.border} border rounded-xl p-4`}>
      <div className={`text-2xl font-bold ${c.text}`}>{score.toFixed(0)}%</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      <div className="mt-2 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
