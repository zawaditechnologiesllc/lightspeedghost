import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useCheckPlagiarism, useHumanizeText, compareCode } from "@workspace/api-client-react";
import type { PlagiarismResult, CodeCompareResult } from "@workspace/api-client-react";
import { Loader2, ShieldCheck, ShieldAlert, Zap, AlertTriangle, Code2, FileText, ExternalLink, Info } from "lucide-react";

type PageTab = "text" | "code";

const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript / TypeScript" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C / C++" },
  { value: "c_sharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "r", label: "R" },
  { value: "matlab", label: "MATLAB" },
  { value: "sql", label: "SQL" },
];

export default function Plagiarism() {
  const [pageTab, setPageTab] = useState<PageTab>("text");

  const [text, setText] = useState("");
  const [humanizeIntensity, setHumanizeIntensity] = useState<"light" | "medium" | "heavy">("medium");
  const [result, setResult] = useState<PlagiarismResult | null>(null);
  const [humanizedText, setHumanizedText] = useState<string | null>(null);

  const [doc1, setDoc1] = useState("");
  const [doc2, setDoc2] = useState("");
  const [language, setLanguage] = useState("auto");
  const [codeResult, setCodeResult] = useState<CodeCompareResult | null>(null);

  const checkPlagiarism = useCheckPlagiarism();
  const humanizeText = useHumanizeText();
  const compareCodeMutation = useMutation({
    mutationFn: (body: { doc1: string; doc2: string; language?: string }) =>
      compareCode({ doc1: body.doc1, doc2: body.doc2, language: body.language === "auto" ? undefined : body.language }),
  });

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

  const handleCodeCompare = async () => {
    if (!doc1.trim() || !doc2.trim()) return;
    const res = await compareCodeMutation.mutateAsync({ doc1, doc2, language });
    setCodeResult(res);
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
        <p className="text-muted-foreground text-sm mt-1">Detect AI-generated content and plagiarism, then humanize your text — or compare two code submissions for similarity</p>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {([
          { id: "text", label: "Text Check", icon: FileText },
          { id: "code", label: "Code Similarity", icon: Code2 },
        ] as { id: PageTab; label: string; icon: React.FC<{ size?: number; className?: string }> }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPageTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              pageTab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {pageTab === "text" && (
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

                {(result.lexicalDiversity !== undefined || result.avgSentenceLength !== undefined) && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Info size={13} className="text-muted-foreground" />
                      <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Writing Metrics</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {result.lexicalDiversity !== undefined && (
                        <div className="bg-muted/50 rounded-lg p-3 border border-border">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Lexical Diversity</div>
                          <div className="text-lg font-bold mt-0.5">{result.lexicalDiversity}%</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {result.lexicalDiversity >= 60 ? "High — varied vocabulary" : result.lexicalDiversity >= 45 ? "Medium — some repetition" : "Low — repetitive (AI indicator)"}
                          </div>
                          <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${result.lexicalDiversity >= 60 ? "bg-green-500" : result.lexicalDiversity >= 45 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${result.lexicalDiversity}%` }} />
                          </div>
                        </div>
                      )}
                      {result.avgSentenceLength !== undefined && (
                        <div className="bg-muted/50 rounded-lg p-3 border border-border">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg Sentence Length</div>
                          <div className="text-lg font-bold mt-0.5">{result.avgSentenceLength} words</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {result.avgSentenceLength <= 20 ? "Natural — human-length sentences" : result.avgSentenceLength <= 28 ? "Moderate — slightly long" : "Long — AI indicator"}
                          </div>
                        </div>
                      )}
                    </div>
                    {result.aiFlags && result.aiFlags.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {result.aiFlags.map((flag, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-yellow-700 dark:text-yellow-400">
                            <AlertTriangle size={10} />
                            {flag}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-3 border-t border-border pt-2">
                      AI detection via lexical diversity · Method from <a href="https://github.com/Churanta/Plagiarism-Checker-and-AI-Text-Detection" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">Plagiarism-Checker-and-AI-Text-Detection <ExternalLink size={8} /></a>
                    </p>
                  </div>
                )}

                {result.matchedWords && result.matchedWords.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2.5">Words Matched in Academic Corpus</h3>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                      {result.matchedWords.slice(0, 60).map((word) => (
                        <span key={word} className="text-[11px] px-2 py-0.5 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 rounded font-medium">
                          {word}
                        </span>
                      ))}
                      {result.matchedWords.length > 60 && (
                        <span className="text-[11px] text-muted-foreground px-1">+{result.matchedWords.length - 60} more</span>
                      )}
                    </div>
                  </div>
                )}

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
                    <h3 className="font-semibold text-sm mb-3">Corpus Matches</h3>
                    <div className="space-y-2">
                      {result.plagiarismSources.map((source, i) => (
                        <div key={i} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                          <div className="flex items-center justify-between mb-1">
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex-1 flex items-center gap-0.5">
                              {decodeURIComponent(source.url.split("q=")[1] ?? source.url)} <ExternalLink size={9} />
                            </a>
                            <span className="text-xs font-bold text-red-600 dark:text-red-400 ml-2 shrink-0">{source.similarity}% match</span>
                          </div>
                          <p className="text-xs text-foreground/70 leading-relaxed line-clamp-1">Shared terms: {source.matchedText}</p>
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
      )}

      {pageTab === "code" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-sm">Code Similarity Detection</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Powered by the Winnowing algorithm (Stanford MOSS) — the same engine used for academic code plagiarism detection</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Submission A</label>
                <textarea
                  value={doc1}
                  onChange={(e) => setDoc1(e.target.value)}
                  rows={14}
                  placeholder="Paste code submission A here..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
                  spellCheck={false}
                />
                <p className="text-[10px] text-muted-foreground mt-1">{doc1.split("\n").length} lines · {doc1.length} chars</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Submission B</label>
                <textarea
                  value={doc2}
                  onChange={(e) => setDoc2(e.target.value)}
                  rows={14}
                  placeholder="Paste code submission B here..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
                  spellCheck={false}
                />
                <p className="text-[10px] text-muted-foreground mt-1">{doc2.split("\n").length} lines · {doc2.length} chars</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleCodeCompare}
                disabled={!doc1.trim() || !doc2.trim() || compareCodeMutation.isPending}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {compareCodeMutation.isPending ? (
                  <><Loader2 size={15} className="animate-spin" /> Analysing...</>
                ) : (
                  <><Code2 size={15} /> Compare Code</>
                )}
              </button>
            </div>
          </div>

          {codeResult && (
            <div className="space-y-4">
              <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${riskColors[codeResult.riskLevel]}`}>
                <div className="flex items-center gap-2">
                  {codeResult.riskLevel === "high" ? <ShieldAlert size={16} /> : codeResult.riskLevel === "medium" ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
                  <span className="font-semibold capitalize">Similarity Risk: {codeResult.riskLevel}</span>
                  <span className="text-sm font-bold">({codeResult.overallSimilarity}%)</span>
                </div>
                <span className="text-xs font-medium opacity-75">Algorithm: {codeResult.algorithm}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{codeResult.similarity1}%</div>
                  <div className="text-xs text-muted-foreground mt-0.5">of Submission A matched</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">{codeResult.overallSimilarity}%</div>
                  <div className="text-xs text-muted-foreground mt-0.5">overall similarity</div>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${codeResult.overallSimilarity >= 40 ? "bg-red-500" : codeResult.overallSimilarity >= 20 ? "bg-yellow-500" : "bg-green-500"}`}
                      style={{ width: `${codeResult.overallSimilarity}%` }}
                    />
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{codeResult.similarity2}%</div>
                  <div className="text-xs text-muted-foreground mt-0.5">of Submission B matched</div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <HighlightedCode
                  label="Submission A — Highlighted Matches"
                  raw={codeResult.highlightedDoc1}
                  matchCount={codeResult.slices1.length}
                />
                <HighlightedCode
                  label="Submission B — Highlighted Matches"
                  raw={codeResult.highlightedDoc2}
                  matchCount={codeResult.slices2.length}
                />
              </div>

              <div className="flex items-center justify-between bg-muted/40 border border-border rounded-lg px-4 py-2.5">
                <p className="text-[11px] text-muted-foreground">
                  Detection via <strong>Winnowing (k={codeResult.kgramSize}, w={codeResult.windowSize})</strong> · Ported from{" "}
                  <a href="https://github.com/blingenf/copydetect" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                    copydetect <ExternalLink size={9} />
                  </a>{" "}
                  · Algorithm from{" "}
                  <a href="https://theory.stanford.edu/~aiken/publications/papers/sigmod03.pdf" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                    Aiken et al. SIGMOD 2003 <ExternalLink size={9} />
                  </a>
                </p>
              </div>
            </div>
          )}

          {!codeResult && !compareCodeMutation.isPending && (
            <div className="bg-card border border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
              <Code2 size={36} className="opacity-30 mb-1" />
              <p className="text-sm font-medium">Paste two code submissions and click Compare Code</p>
              <p className="text-xs max-w-sm">The Winnowing algorithm fingerprints both documents and highlights structurally similar sections, even if variable names were changed</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HighlightedCode({ label, raw, matchCount }: { label: string; raw: string; matchCount: number }) {
  const parts: { text: string; highlighted: boolean }[] = [];
  const segments = raw.split(/(\[\[HL\]\].*?\[\[\/HL\]\])/s);
  for (const seg of segments) {
    if (seg.startsWith("[[HL]]")) {
      parts.push({ text: seg.replace("[[HL]]", "").replace("[[/HL]]", ""), highlighted: true });
    } else {
      parts.push({ text: seg, highlighted: false });
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        {matchCount > 0 && (
          <span className="text-[10px] bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
            {matchCount} matched region{matchCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="overflow-auto max-h-72 p-3">
        <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all">
          {parts.map((part, i) =>
            part.highlighted ? (
              <mark key={i} className="bg-red-200 dark:bg-red-900/60 text-foreground rounded px-0.5 not-italic">{part.text}</mark>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </pre>
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
