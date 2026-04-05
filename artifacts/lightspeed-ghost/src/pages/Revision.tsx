import { useState, useCallback, useRef, useEffect } from "react";
import {
  FileEdit, CheckCircle, AlertTriangle, Zap, ArrowRight, Copy, CheckCheck,
  TrendingUp, BookOpen, Download, BarChart3, RefreshCcw, FileText,
  ShieldAlert, ShieldCheck, PenLine, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePaywallGuard } from "@/hooks/usePaywallGuard";
import { PaywallFlow } from "@/components/checkout/PaywallFlow";
import FileUploadZone, { type ExtractedFile } from "@/components/FileUploadZone";

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = "upload" | "analysing" | "decision" | "revising" | "results";
type ResultTab = "revised" | "changes" | "stats";

interface AnalysisResult {
  aiScore: number;
  plagiarismScore: number;
  aiReason: string;
  plagiarismReason: string;
  recommendation: "revise" | "new_paper";
  wordCount: number;
}

interface RevisionChange {
  section: string;
  original: string;
  revised: string;
  reason: string;
}

interface RevisionResult {
  revisedText: string;
  changes: RevisionChange[];
  feedback: string;
  gradeEstimate: string;
  stats: { aiScore: number; plagiarismScore: number };
  improvementAreas: string[];
  documentId?: number;
}

interface Step {
  id: string;
  message: string;
  status: "pending" | "running" | "done" | "error";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function downloadRevised(text: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Revised Paper</title>
<style>
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.8;
         max-width: 750px; margin: 60px auto; color: #111; padding: 0 40px; }
  h1 { font-size: 16pt; text-align: center; margin-bottom: 6px; }
  h2 { font-size: 13pt; margin-top: 24px; }
  h3 { font-size: 12pt; margin-top: 16px; }
  p  { margin-bottom: 12px; text-align: justify; }
</style></head>
<body>
${text
  .replace(/^# (.*)/gm, "<h1>$1</h1>")
  .replace(/^## (.*)/gm, "<h2>$1</h2>")
  .replace(/^### (.*)/gm, "<h3>$1</h3>")
  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  .replace(/\*(.*?)\*/g, "<em>$1</em>")
  .split("\n\n")
  .map((p) => (p.startsWith("<h") ? p : `<p>${p}</p>`))
  .join("\n")}
</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "revised_paper.html";
  a.click();
  URL.revokeObjectURL(url);
}

function ScoreBadge({ score, label, inverse = false }: { score: number; label: string; inverse?: boolean }) {
  const good = inverse ? score >= 70 : score <= 20;
  const warn = inverse ? score >= 50 : score <= 40;
  const color = good
    ? "text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/5"
    : warn
      ? "text-yellow-600 dark:text-yellow-400 border-yellow-500/30 bg-yellow-500/5"
      : "text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/5";
  return (
    <div className={cn("rounded-xl border p-5 text-center", color)}>
      <div className="text-4xl font-bold tabular-nums">{score}%</div>
      <div className="text-xs mt-1 opacity-70">{label}</div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Revision() {
  const { session } = useAuth();
  const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";
  const { guard, plan, isAtLimit, pickerState, checkoutState, closePicker, closeCheckout, chooseSubscription, choosePayg } = usePaywallGuard();

  // ── phase
  const [phase, setPhase] = useState<Phase>("upload");
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState("");

  // ── prefill from plagiarism checker
  const [fromPlagiarism, setFromPlagiarism] = useState(false);

  // ── form inputs
  const [paperText, setPaperText] = useState("");
  const [rubricText, setRubricText] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [marksScored, setMarksScored] = useState("");
  const [targetGrade, setTargetGrade] = useState("");
  const [paperWordCount, setPaperWordCount] = useState(0);

  // ── analysis gate
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  // ── results
  const [result, setResult] = useState<RevisionResult | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>("revised");
  const [copied, setCopied] = useState(false);

  const streamRef = useRef<HTMLDivElement>(null);

  // ── Upload handlers ───────────────────────────────────────────────────────

  const handlePaperUploaded = useCallback((file: ExtractedFile) => {
    setPaperText(file.text);
    setPaperWordCount(file.wordCount ?? file.text.split(/\s+/).filter(Boolean).length);
  }, []);

  const handleRubricUploaded = useCallback((file: ExtractedFile) => {
    setRubricText(file.text.slice(0, 4000));
  }, []);

  const handleReferenceUploaded = useCallback((file: ExtractedFile) => {
    setReferenceText(prev => (prev ? prev + "\n\n" : "") + file.text.slice(0, 5000));
  }, []);

  // ── Pre-fill from AI & Plagiarism Checker ─────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("plag-prefill-revision-text");
    if (stored && stored.trim()) {
      setPaperText(stored);
      setPaperWordCount(stored.split(/\s+/).filter(Boolean).length);
      setFromPlagiarism(true);
      localStorage.removeItem("plag-prefill-revision-text");
    }
  }, []);

  // ── Step updater ─────────────────────────────────────────────────────────

  const updateStep = (id: string, message: string, status: Step["status"]) => {
    setSteps(prev => {
      const exists = prev.some(s => s.id === id);
      if (exists) return prev.map(s => s.id === id ? { ...s, message, status } : s);
      return [...prev, { id, message, status }];
    });
  };

  // ── PHASE 1 → 2: Analyse paper ────────────────────────────────────────────

  const handleAnalyse = async () => {
    const text = paperText.trim();
    if (!text || text.split(/\s+/).length < 50) {
      setError("Please upload or paste your paper (minimum 50 words) before continuing.");
      return;
    }
    setError("");
    setPhase("analysing");

    try {
      const token = session?.access_token;
      const resp = await fetch(`${API_BASE}/revision/analyse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
      });

      if (!resp.ok) throw new Error("Analysis failed — please try again");
      const data: AnalysisResult = await resp.json();
      setAnalysis(data);
      setPhase("decision");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setPhase("upload");
    }
  };

  // ── PHASE 3 → 4: Start streaming revision ─────────────────────────────────

  const handleRevise = async () => {
    if (isAtLimit("revision")) { guard("revision", () => {}); return; }
    setPhase("revising");
    setError("");
    setSteps([
      { id: "analyse", message: "", status: "pending" },
      { id: "rewrite", message: "", status: "pending" },
      { id: "quality", message: "", status: "pending" },
    ]);

    try {
      const token = session?.access_token;
      const resp = await fetch(`${API_BASE}/revision/submit-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          originalText: paperText.trim(),
          targetGrade: targetGrade.trim() || undefined,
          marksScored: marksScored.trim() || undefined,
          gradingCriteria: rubricText.trim() || undefined,
          referenceText: referenceText.trim() || undefined,
          instructions: instructions.trim() || undefined,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Revision failed — please try again");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let event = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            event = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (event === "step") {
                updateStep(data.id, data.message, data.status);
              } else if (event === "done") {
                setResult(data as RevisionResult);
                setResultTab("revised");
                setPhase("results");
              } else if (event === "error") {
                setError(data.message ?? "Revision failed");
                setPhase("decision");
              }
            } catch { /* ignore parse errors */ }
            event = "";
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setPhase("decision");
    }
  };

  const copyRevised = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.revisedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── PHASE: UPLOAD ─────────────────────────────────────────────────────────

  if (phase === "upload") {
    const words = paperText.split(/\s+/).filter(Boolean).length;

    return (
      <div className="h-full flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="shrink-0 border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap size={16} className="text-primary" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Paper Revision</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI detection &amp; plagiarism scan first — then we rewrite to 92%+ with 0% AI
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6 pb-16 sm:px-6 sm:py-8 space-y-6">

            {fromPlagiarism && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-primary/10 border border-primary/30 rounded-xl text-sm text-primary">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="shrink-0" />
                  <div>
                    <div className="font-semibold">Paper loaded from your AI & Plagiarism check</div>
                    <div className="text-xs font-normal opacity-80 mt-0.5">
                      Complete the prerequisites below: add your rubric, target grade, and any class materials — then click "Scan Paper"
                    </div>
                  </div>
                </div>
                <button onClick={() => setFromPlagiarism(false)} className="shrink-0 hover:opacity-60 transition-opacity text-lg leading-none">&times;</button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                <AlertTriangle size={14} className="shrink-0" /> {error}
              </div>
            )}

            {/* Upload paper */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block flex items-center gap-1.5">
                <FileText size={11} />
                Your Paper *
              </label>
              <FileUploadZone
                onExtracted={handlePaperUploaded}
                accept=".pdf,.docx,.doc,.txt,.md"
                label="Upload your paper (PDF or Word)"
                hint="Your paper will be scanned for AI content and plagiarism before revision"
              />
              {paperText && (
                <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle size={10} /> Paper loaded — {words.toLocaleString()} words
                </p>
              )}
            </div>

            {/* Paste fallback */}
            {!paperText && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Or paste your paper text</label>
                <textarea
                  value={paperText}
                  onChange={e => { setPaperText(e.target.value); setPaperWordCount(e.target.value.split(/\s+/).filter(Boolean).length); }}
                  rows={6}
                  placeholder="Paste your paper text here…"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono"
                />
              </div>
            )}

            {/* Rubric */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block flex items-center gap-1.5">
                <BookOpen size={11} />
                Marking Rubric
                <span className="font-normal lowercase tracking-normal text-muted-foreground/60">(recommended — for targeted grade improvement)</span>
              </label>
              <FileUploadZone
                onExtracted={handleRubricUploaded}
                accept=".pdf,.docx,.doc,.txt,.md"
                label="Upload grading rubric or criteria"
                hint="We'll rewrite every weak section to satisfy each rubric criterion"
                compact
              />
              {rubricText && (
                <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle size={10} /> Rubric loaded ({rubricText.split(/\s+/).length} words)
                </p>
              )}
            </div>

            {/* Reference materials */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block flex items-center gap-1.5">
                <FileText size={11} />
                Class Materials &amp; References
                <span className="font-normal lowercase tracking-normal text-muted-foreground/60">(optional)</span>
              </label>
              <FileUploadZone
                onExtracted={handleReferenceUploaded}
                accept=".pdf,.docx,.doc,.txt,.md"
                label="Upload lecture notes, readings, recommended studies…"
                hint="AI will strengthen your arguments using these materials"
                compact
              />
              {referenceText && (
                <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle size={10} /> {referenceText.split(/\s+/).filter(Boolean).length.toLocaleString()} words of reference material loaded
                </p>
              )}
            </div>

            {/* Grade info */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Marks Scored</label>
                <input
                  value={marksScored}
                  onChange={e => setMarksScored(e.target.value)}
                  placeholder="e.g., 62 or 62/100"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Target Grade</label>
                <input
                  value={targetGrade}
                  onChange={e => setTargetGrade(e.target.value)}
                  placeholder="e.g., A, 85%, First Class"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Extra instructions */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Additional Instructions</label>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                rows={2}
                placeholder="Specific things to fix or improve…"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {/* Quality guarantee */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-500/5 border border-green-500/20 text-[11px] text-green-700 dark:text-green-400">
              <ShieldCheck size={14} className="shrink-0 mt-0.5" />
              <span>Every revision is checked for <strong>0% AI detection</strong>, <strong>&lt;8% plagiarism</strong> and a minimum <strong>92% grade</strong> — same standards as writing from scratch.</span>
            </div>

            {/* CTA */}
            <div className="pt-2">
              <button
                onClick={handleAnalyse}
                disabled={!paperText.trim()}
                className="w-full flex items-center justify-center gap-2.5 bg-primary text-primary-foreground px-4 py-4 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <ShieldAlert size={18} className="shrink-0" />
                Scan Paper &amp; Start Revision
              </button>
              {!paperText.trim() && (
                <p className="text-center text-xs text-muted-foreground mt-2">Upload or paste your paper to continue</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE: ANALYSING ─────────────────────────────────────────────────────

  if (phase === "analysing") {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background gap-6 px-6">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap size={16} className="text-primary" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
          </div>
          <h2 className="text-xl font-bold">Scanning your paper…</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Checking AI content percentage and plagiarism risk. This takes about 10 seconds.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          {["Detecting AI-generated content patterns…", "Estimating plagiarism risk…", "Generating recommendation…"].map((msg, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0" style={{ animationDelay: `${i * 300}ms` }} />
              <span className="text-sm text-muted-foreground">{msg}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── PHASE: DECISION ───────────────────────────────────────────────────────

  if (phase === "decision" && analysis) {
    const tooMuchAI = analysis.aiScore > 30;
    const highPlagiarism = analysis.plagiarismScore > 20;
    const needsWarning = tooMuchAI || highPlagiarism;

    return (
      <div className="h-full flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="shrink-0 border-b border-border bg-card px-6 py-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap size={16} className="text-primary" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Paper Revision</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Scan results — review before proceeding</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6">

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                <AlertTriangle size={14} className="shrink-0" /> {error}
              </div>
            )}

            {/* Score cards */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Scan Results for your {analysis.wordCount.toLocaleString()}-word paper</p>
              <div className="grid grid-cols-2 gap-3">
                <ScoreBadge score={analysis.aiScore} label="AI Detection" />
                <ScoreBadge score={analysis.plagiarismScore} label="Plagiarism Risk" />
              </div>
            </div>

            {/* Explanations */}
            <div className="space-y-3">
              <div className="px-4 py-3 rounded-xl bg-card border border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">AI Analysis</p>
                <p className="text-sm text-foreground">{analysis.aiReason}</p>
              </div>
              <div className="px-4 py-3 rounded-xl bg-card border border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Plagiarism Analysis</p>
                <p className="text-sm text-foreground">{analysis.plagiarismReason}</p>
              </div>
            </div>

            {/* Warning if AI > 30% */}
            {tooMuchAI && (
              <div className="px-4 py-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <ShieldAlert size={16} className="shrink-0" />
                  <span className="font-semibold text-sm">{analysis.aiScore}% AI content — above the 30% institutional threshold</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Most universities and schools use a 30% AI detection limit. Papers above this threshold are typically flagged for academic misconduct. <strong className="text-foreground">Writing a new paper from scratch</strong> is the safest option — LightSpeed AI guarantees 0% AI content.
                </p>
              </div>
            )}

            {/* Warning if plagiarism > 20% */}
            {highPlagiarism && (
              <div className="px-4 py-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 space-y-2">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span className="font-semibold text-sm">{analysis.plagiarismScore}% plagiarism risk — above acceptable levels</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A plagiarism score above 20% risks rejection. Our revision will rephrase and strengthen all flagged passages to bring this well under 8%.
                </p>
              </div>
            )}

            {/* Clean result */}
            {!needsWarning && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400">
                <ShieldCheck size={16} className="shrink-0" />
                <span className="text-sm font-medium">Your paper is within acceptable limits — revision will raise it to 92%+.</span>
              </div>
            )}

            {/* Decision buttons */}
            <div className="space-y-3 pt-2">
              {/* Primary: Write New Paper (if AI too high) or Revise (if OK) */}
              {tooMuchAI ? (
                <>
                  <Link href={`/write`}>
                    <div className="w-full flex items-center justify-between gap-3 bg-primary text-primary-foreground px-5 py-4 rounded-xl font-bold text-sm hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-primary/20 group">
                      <div className="flex items-center gap-3">
                        <PenLine size={18} className="shrink-0" />
                        <div className="text-left">
                          <div className="font-bold">Write a New Paper</div>
                          <div className="text-xs font-normal opacity-80">0% AI · &lt;8% plagiarism · 92%+ grade — included in your plan</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </div>
                  </Link>

                  <button
                    onClick={handleRevise}
                    className="w-full flex items-center justify-center gap-2 border border-border text-foreground px-5 py-3 rounded-xl text-sm font-medium hover:bg-muted/50 transition-all"
                  >
                    <FileEdit size={16} className="text-muted-foreground" />
                    Revise anyway — reduce AI to under 30%
                    <span className="text-[10px] text-muted-foreground ml-1">(not guaranteed safe)</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleRevise}
                    className="w-full flex items-center justify-center gap-2.5 bg-primary text-primary-foreground px-5 py-4 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                  >
                    <TrendingUp size={18} className="shrink-0" />
                    Revise Paper to {targetGrade || "92%+"}
                  </button>

                  <Link href="/write">
                    <div className="w-full flex items-center justify-center gap-2 border border-border text-muted-foreground px-4 py-2.5 rounded-xl text-sm hover:text-foreground hover:bg-muted/30 transition-all cursor-pointer">
                      <PenLine size={14} />
                      Or write a new paper from scratch instead
                    </div>
                  </Link>
                </>
              )}

              <button
                onClick={() => { setPhase("upload"); setAnalysis(null); setError(""); }}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <RefreshCcw size={11} /> Upload a different paper
              </button>
            </div>
          </div>
        </div>
        <PaywallFlow
          pickerState={pickerState}
          checkoutState={checkoutState}
          plan={plan}
          closePicker={closePicker}
          closeCheckout={closeCheckout}
          chooseSubscription={chooseSubscription}
          choosePayg={choosePayg}
        />
      </div>
    );
  }

  // ── PHASE: REVISING ───────────────────────────────────────────────────────

  if (phase === "revising") {
    const runningStep = steps.find(s => s.status === "running");
    const doneCount = steps.filter(s => s.status === "done").length;
    const pct = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;

    return (
      <div className="h-full flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="shrink-0 border-b border-border bg-card px-6 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-primary" />
            <span className="font-bold tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">LIGHT SPEED AI</span>
          </div>
          <span className="text-muted-foreground text-sm hidden sm:inline">— Revising your paper</span>
          <div className="ml-auto text-xs text-muted-foreground">{pct}%</div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-muted shrink-0">
          <div
            className="h-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-700"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Left: activity feed */}
          <div className="shrink-0 border-b md:border-b-0 md:w-72 md:border-r border-border flex flex-col overflow-hidden max-h-40 md:max-h-none">
            <div className="px-5 py-4 border-b border-border bg-muted/20 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Currently</p>
              <p className="text-sm font-medium text-foreground leading-snug min-h-[2.5rem]">
                {runningStep?.message ?? (doneCount === steps.length && steps.length > 0 ? "Finalising revision…" : "Preparing revision…")}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {steps.map((step, i) => (
                <div key={step.id} className="relative">
                  {i < steps.length - 1 && (
                    <div className="absolute left-[7px] top-5 w-px h-full bg-border" />
                  )}
                  <div className="flex items-start gap-3 py-2.5">
                    <div className="shrink-0 mt-0.5 z-10">
                      {step.status === "done" && (
                        <div className="w-3.5 h-3.5 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        </div>
                      )}
                      {step.status === "running" && (
                        <div className="w-3.5 h-3.5 rounded-full bg-primary/20 border border-primary animate-pulse" />
                      )}
                      {step.status === "pending" && (
                        <div className="w-3.5 h-3.5 rounded-full bg-background border border-border" />
                      )}
                    </div>
                    <p className={cn(
                      "text-xs leading-relaxed flex-1",
                      step.status === "done" && "text-muted-foreground",
                      step.status === "running" && "text-foreground font-medium",
                      step.status === "pending" && "text-muted-foreground/35",
                    )}>
                      {step.message || (step.status === "pending" ? "Queued…" : "—")}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-border shrink-0">
              <p className="text-[10px] text-muted-foreground/50">Keep this window open while we revise</p>
            </div>
          </div>

          {/* Right: info panel */}
          <div className="flex-1 flex flex-col items-center justify-center p-5 sm:p-8 gap-4 sm:gap-6 text-center">
            <div className="space-y-2">
              <TrendingUp size={32} className="text-primary/30 mx-auto" />
              <h3 className="text-base sm:text-lg font-semibold">Raising your paper to {targetGrade || "Grade A / 92%+"}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Every weak section is being rewritten to meet grade A standards — 4-part paragraph structure, citations every 150–200 words, zero AI-detectable prose.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" />0% AI target</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" />&lt;8% plagiarism</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-violet-500" />92%+ grade</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE: RESULTS ────────────────────────────────────────────────────────

  if (phase === "results" && result) {
    const revisedWords = result.revisedText.split(/\s+/).filter(Boolean).length;

    return (
      <div className="h-full flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="shrink-0 border-b border-border bg-card px-4 py-2.5 sm:px-5 sm:py-3 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-primary" />
            <span className="text-sm font-bold text-primary">Paper Revision</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
            <span className="text-xs text-green-600 dark:text-green-400 font-semibold bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
              {result.gradeEstimate}
            </span>
            <button
              onClick={copyRevised}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
            >
              {copied ? <CheckCheck size={12} className="text-green-500" /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => downloadRevised(result.revisedText)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <Download size={12} /> Download
            </button>
            <button
              onClick={() => { setPhase("upload"); setResult(null); setAnalysis(null); setPaperText(""); setError(""); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <RefreshCcw size={12} /> New revision
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 border-b border-border bg-muted/10 px-5 flex items-center gap-1 py-2">
          {(["revised", "changes", "stats"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setResultTab(tab)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize",
                resultTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab}
              {tab === "changes" && result.changes.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                  {result.changes.length}
                </span>
              )}
            </button>
          ))}
          <div className="ml-auto text-xs text-muted-foreground">{revisedWords.toLocaleString()} words</div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto" ref={streamRef}>

          {/* Revised paper */}
          {resultTab === "revised" && (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {result.revisedText.split("\n").map((line, i) => {
                  if (/^# /.test(line)) return <h1 key={i} className="text-xl font-bold mt-6 mb-2">{line.slice(2)}</h1>;
                  if (/^## /.test(line)) return <h2 key={i} className="text-base font-bold mt-5 mb-2 border-b border-border pb-1">{line.slice(3)}</h2>;
                  if (/^### /.test(line)) return <h3 key={i} className="text-sm font-semibold mt-4 mb-1.5">{line.slice(4)}</h3>;
                  if (line.trim() === "") return <div key={i} className="h-2" />;
                  const parts = line.split(/(\*\*.*?\*\*)/g);
                  return (
                    <p key={i} className="text-sm text-foreground leading-relaxed mb-1">
                      {parts.map((p, j) =>
                        p.startsWith("**") && p.endsWith("**")
                          ? <strong key={j}>{p.slice(2, -2)}</strong>
                          : p
                      )}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          {/* Changes */}
          {resultTab === "changes" && (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
              {result.feedback && (
                <div className="px-4 py-4 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Revision Summary</p>
                  <p className="text-sm text-foreground leading-relaxed">{result.feedback}</p>
                </div>
              )}

              {result.improvementAreas.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {result.improvementAreas.map((area, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                      {area}
                    </span>
                  ))}
                </div>
              )}

              {result.changes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No individual tracked changes — see the Revised tab for the improved paper.
                </div>
              ) : (
                result.changes.map((change, i) => (
                  <div key={i} className="border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                      {change.section}
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border-l-2 border-red-400">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-red-500 mb-1">Original</div>
                        <div className="text-sm text-red-700 dark:text-red-300 leading-relaxed">{change.original}</div>
                      </div>
                      <div className="flex justify-center">
                        <ArrowRight size={14} className="text-muted-foreground" />
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border-l-2 border-green-400">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-green-600 mb-1">Revised</div>
                        <div className="text-sm text-green-700 dark:text-green-300 leading-relaxed">{change.revised}</div>
                      </div>
                      <div className="text-xs text-muted-foreground italic bg-muted/30 rounded px-3 py-2">
                        {change.reason}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Stats */}
          {resultTab === "stats" && (
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">{result.gradeEstimate.split(/[/ ]/)[0] || "A"}</div>
                  <div className="text-xs mt-1 text-muted-foreground">Estimated Grade</div>
                  <div className="text-[10px] mt-1 font-semibold text-green-600 dark:text-green-400">{result.gradeEstimate}</div>
                </div>
                <div className={cn("rounded-xl border p-4 text-center", result.stats.aiScore <= 10 ? "border-green-500/30 bg-green-500/5" : "border-yellow-500/30 bg-yellow-500/5")}>
                  <div className={cn("text-3xl font-bold", result.stats.aiScore <= 10 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400")}>{result.stats.aiScore}%</div>
                  <div className="text-xs mt-1 text-muted-foreground">AI Detection</div>
                  <div className={cn("text-[10px] mt-1 font-semibold", result.stats.aiScore <= 10 ? "text-green-600 dark:text-green-400" : "text-yellow-600")}>{result.stats.aiScore <= 5 ? "Excellent" : result.stats.aiScore <= 15 ? "Safe" : "Review"}</div>
                </div>
                <div className={cn("rounded-xl border p-4 text-center", result.stats.plagiarismScore <= 8 ? "border-green-500/30 bg-green-500/5" : "border-yellow-500/30 bg-yellow-500/5")}>
                  <div className={cn("text-3xl font-bold", result.stats.plagiarismScore <= 8 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400")}>{result.stats.plagiarismScore}%</div>
                  <div className="text-xs mt-1 text-muted-foreground">Plagiarism Risk</div>
                  <div className={cn("text-[10px] mt-1 font-semibold", result.stats.plagiarismScore <= 8 ? "text-green-600 dark:text-green-400" : "text-yellow-600")}>{result.stats.plagiarismScore <= 5 ? "Original" : result.stats.plagiarismScore <= 10 ? "Safe" : "High Risk"}</div>
                </div>
              </div>

              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-card border border-border text-sm text-muted-foreground">
                <BarChart3 size={14} className="text-primary shrink-0 mt-0.5" />
                <span>These are AI-estimated scores. For final submission, run through Turnitin or Copyleaks for authoritative results. Our revision targets guarantee both scores will be well within institutional limits.</span>
              </div>

              <Link href="/write">
                <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-5 py-4 hover:bg-primary/10 transition-colors cursor-pointer group">
                  <PenLine size={15} className="text-primary shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-primary">Write a new paper from scratch</div>
                    <div className="text-xs text-muted-foreground">Start fresh with LightSpeed AI — guaranteed 0% AI</div>
                  </div>
                  <ChevronRight size={14} className="text-primary group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
