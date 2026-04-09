import { useState, useCallback, useRef, useEffect } from "react";
import {
  Wand2, CheckCircle, AlertTriangle, Zap, Copy, CheckCheck,
  Download, RefreshCcw, FileText, ChevronRight, Sparkles,
  SlidersHorizontal, ArrowLeftRight, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePaywallGuard } from "@/hooks/usePaywallGuard";
import { PaywallFlow } from "@/components/checkout/PaywallFlow";
import FileUploadZone, { type ExtractedFile } from "@/components/FileUploadZone";
import { ExportButtons } from "@/components/ExportButtons";
import { mdToBodyHtml, wrapDocHtml, makeLsgFilename } from "@/lib/exportUtils";
import { apiFetch } from "@/lib/apiFetch";

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = "input" | "detecting" | "decision" | "humanizing" | "results";
type ResultTab = "humanized" | "changes" | "compare";
type Tone = "academic" | "conversational" | "professional";

interface DetectionResult {
  aiScore: number;
  humanScore: number;
  riskLevel: "low" | "medium" | "high";
  topIndicators: string[];
  recommendation: string;
  wordCount: number;
}

interface HumanizeResult {
  humanizedText: string;
  changesSummary: string[];
  estimatedAiScore: number;
  toneApplied: string;
  wordCount: number;
  documentId?: number;
}

interface Step {
  id: string;
  message: string;
  status: "pending" | "running" | "done" | "error";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function downloadHumanized(text: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Humanized Text</title>
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
  a.download = "humanized_text.html";
  a.click();
  URL.revokeObjectURL(url);
}

function RiskBadge({ score, label }: { score: number; label: string }) {
  const good = score <= 15;
  const warn = score <= 35;
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

export default function Humanizer() {
  const { user } = useAuth();
  const { guard, openBuy, plan, isAtLimit, pickerState, checkoutState, closePicker, closeCheckout, chooseSubscription, choosePayg } = usePaywallGuard();

  // ── phase
  const [phase, setPhase] = useState<Phase>("input");
  const [steps, setSteps] = useState<Step[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // ── input
  const [inputText, setInputText] = useState("");
  const [tone, setTone] = useState<Tone>("academic");
  const [instructions, setInstructions] = useState("");

  // ── auto-populate from sessionStorage (redirect from Plagiarism checker)
  useEffect(() => {
    const saved = sessionStorage.getItem("lsg_humanize_text");
    const autorun = sessionStorage.getItem("lsg_humanize_autorun") === "true";
    if (saved) {
      sessionStorage.removeItem("lsg_humanize_text");
      sessionStorage.removeItem("lsg_humanize_autorun");
      setInputText(saved);
      if (autorun) setTimeout(() => handleDetect(saved), 80);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── results
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [humanizeResult, setHumanizeResult] = useState<HumanizeResult | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>("humanized");

  // ── copy state
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  function updateStep(id: string, patch: Partial<Step>) {
    setSteps((prev) => {
      const exists = prev.find((s) => s.id === id);
      if (exists) return prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      return [...prev, { id, message: "", status: "pending", ...patch }];
    });
  }

  // ── Detection ────────────────────────────────────────────────────────────────

  async function handleDetect(overrideText?: string) {
    const text = (overrideText ?? inputText).trim();
    if (!text) return;
    guard("humanizer", async () => {
      setApiError(null);
      setPhase("detecting");
      try {
        const resp = await apiFetch(`/humanizer/detect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            
          },
          body: JSON.stringify({ text }),
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Detection failed (${resp.status})`);
        }
        const data = await resp.json() as DetectionResult;
        setDetectionResult(data);
        setPhase("decision");
      } catch (err) {
        setApiError(err instanceof Error ? err.message : "Detection failed — please try again");
        setPhase("input");
      }
    });
  }

  // ── Humanize stream ───────────────────────────────────────────────────────────

  const handleHumanize = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    setPhase("humanizing");
    setSteps([]);
    setApiError(null);
    abortRef.current = new AbortController();

    try {
      const resp = await apiFetch(`/humanizer/humanize-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({ text, tone, instructions: instructions.trim() || undefined }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) {
        const body = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error (${resp.status}) — please try again`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice(7).trim();
          const data = JSON.parse(dataLine.slice(5).trim());

          if (event === "step") updateStep(data.id, data);
          else if (event === "done") {
            setHumanizeResult(data as HumanizeResult);
            setResultTab("humanized");
            setPhase("results");
          } else if (event === "error") {
            setApiError(data.message ?? "Humanization failed — please try again");
            setPhase("decision");
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setApiError(err instanceof Error ? err.message : "Humanization failed — please try again");
      setPhase("decision");
    }
  }, [inputText, tone, instructions]);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleReset() {
    abortRef.current?.abort();
    setPhase("input");
    setSteps([]);
    setDetectionResult(null);
    setHumanizeResult(null);
    setInputText("");
    setInstructions("");
  }

  // ── PHASE: INPUT ─────────────────────────────────────────────────────────────

  if (phase === "input") {
    return (
      <div className="flex flex-col h-full overflow-hidden">

        {/* Scrollable area — full width so the scrollbar sits at the far right edge */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto w-full">

          <div className="px-4 sm:px-6 py-5 space-y-5">

            {/* Page header */}
            <div className="text-center space-y-1.5 pt-2 pb-1">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Zap size={16} className="text-primary" />
                <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Humanizer</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Paste AI-written text — we detect flagged patterns and rewrite it to sound genuinely human.
              </p>
            </div>
            {/* Text input */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">
                Your text <span className="text-muted-foreground font-normal">(paste or type — or upload a file below)</span>
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your AI-generated essay, paper, or any text you want to humanize…"
                className="w-full h-52 sm:h-64 bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none leading-relaxed"
              />
              {inputText.trim() && (
                <p className="text-[10px] text-muted-foreground/50 mt-1 text-right tabular-nums">
                  {inputText.trim().split(" ").filter(Boolean).length} words
                </p>
              )}
            </div>

            {/* File upload */}
            <FileUploadZone
              onExtracted={(file: ExtractedFile) => {
                setInputText((prev) => prev ? `${prev}\n\n${file.text}` : file.text);
              }}
              accept=".pdf,.docx,.doc,.txt"
              label="Or upload a file (PDF, Word, TXT)"
            />

            {/* Tone selection */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <SlidersHorizontal size={12} className="text-muted-foreground" />
                Output tone
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["academic", "conversational", "professional"] as Tone[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={cn(
                      "py-2 px-3 rounded-lg text-xs font-medium border transition-all capitalize",
                      tone === t
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional instructions */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">
                Special instructions <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Keep the introduction formal. Preserve all citations. Avoid contractions."
                className="w-full h-20 bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* CTA — inside scroll area so it flows naturally with the form */}
          <div className="px-4 sm:px-6 pt-2 pb-8 max-w-3xl mx-auto w-full">
            {apiError && (
              <div className="mb-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">
                {apiError}
              </div>
            )}
            <button
              onClick={() => handleDetect()}
              disabled={!inputText.trim()}
              className="w-full flex items-center justify-center gap-2.5 bg-primary text-primary-foreground px-4 py-4 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Wand2 size={18} className="shrink-0" />
              Detect AI &amp; Humanize
            </button>
            {!inputText.trim() && (
              <p className="text-center text-xs text-muted-foreground mt-2">Paste or upload text to continue</p>
            )}
            <p className="text-center text-[11px] text-muted-foreground/50 mt-1.5">
              or{" "}
              <button type="button" onClick={() => openBuy("humanizer")} className="text-orange-400 hover:text-orange-300 transition-colors font-medium">
                buy a single humanize →
              </button>
            </p>
          </div>
        </div>
      </div>

      <PaywallFlow pickerState={pickerState} checkoutState={checkoutState} closePicker={closePicker} closeCheckout={closeCheckout} chooseSubscription={chooseSubscription} choosePayg={choosePayg} />
    </div>
  );
}

  // ── PHASE: DETECTING ─────────────────────────────────────────────────────────

  if (phase === "detecting") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm px-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 animate-pulse">
            <ShieldAlert size={24} className="text-primary" />
          </div>
          <h2 className="font-bold text-lg text-foreground mb-2">Scanning for AI patterns…</h2>
          <p className="text-sm text-muted-foreground">
            Identifying flagged sentences, clichés, and structural signals in your text.
          </p>
        </div>
      </div>
    );
  }

  // ── PHASE: DECISION ──────────────────────────────────────────────────────────

  if (phase === "decision" && detectionResult) {
    const { aiScore, riskLevel, topIndicators, recommendation, wordCount } = detectionResult;
    const riskColor = riskLevel === "high"
      ? "text-red-500 border-red-500/30 bg-red-500/5"
      : riskLevel === "medium"
        ? "text-yellow-500 border-yellow-500/30 bg-yellow-500/5"
        : "text-green-500 border-green-500/30 bg-green-500/5";

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top bar */}
        <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wand2 size={14} className="text-primary" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
            </div>
            <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCcw size={12} /> Start over
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-6">
            {/* Score card */}
            <div className={cn("rounded-2xl border p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5", riskColor)}>
              <div className="text-center shrink-0">
                <div className="text-5xl font-bold tabular-nums">{aiScore}%</div>
                <div className="text-xs mt-1 opacity-70">AI detection score</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn("text-xs font-bold uppercase tracking-widest mb-1", riskLevel === "high" ? "text-red-500" : riskLevel === "medium" ? "text-yellow-500" : "text-green-500")}>
                  {riskLevel === "high" ? "High risk — humanize recommended" : riskLevel === "medium" ? "Medium risk — humanize to be safe" : "Low risk — text looks mostly human"}
                </div>
                <p className="text-xs opacity-80 leading-relaxed">{recommendation}</p>
                <p className="text-[10px] opacity-50 mt-2">{wordCount.toLocaleString()} words analysed</p>
              </div>
            </div>

            {/* Indicators */}
            {topIndicators.length > 0 && (
              <div className="rounded-xl border border-border bg-card/50 p-4">
                <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-yellow-500" /> Top AI signals detected
                </p>
                <ul className="space-y-2">
                  {topIndicators.map((ind, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <ChevronRight size={12} className="text-muted-foreground/40 shrink-0 mt-0.5" />
                      {ind}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tone selector */}
            <div className="rounded-xl border border-border bg-card/50 p-4">
              <p className="text-xs font-semibold text-foreground mb-3">Choose output tone</p>
              <div className="grid grid-cols-3 gap-2">
                {(["academic", "conversational", "professional"] as Tone[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={cn(
                      "py-2 px-3 rounded-lg text-xs font-medium border transition-all capitalize",
                      tone === t
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Error from humanize attempt */}
            {apiError && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">
                {apiError}
              </div>
            )}

            {/* CTAs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleHumanize}
                className="flex items-center justify-center gap-2.5 bg-primary text-primary-foreground px-4 py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20"
              >
                <Wand2 size={16} />
                Humanize Now
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2.5 border border-border text-muted-foreground px-4 py-3.5 rounded-xl font-medium text-sm hover:text-foreground hover:border-foreground/30 transition-all"
              >
                <RefreshCcw size={14} />
                Edit Text
              </button>
            </div>

            <p className="text-center text-[11px] text-muted-foreground/50">
              or{" "}
              <button type="button" onClick={() => openBuy("humanizer")} className="text-orange-400 hover:text-orange-300 transition-colors font-medium">
                buy a single humanize →
              </button>
            </p>
          </div>
        </div>

        <PaywallFlow pickerState={pickerState} checkoutState={checkoutState} closePicker={closePicker} closeCheckout={closeCheckout} chooseSubscription={chooseSubscription} choosePayg={choosePayg} />
      </div>
    );
  }

  // ── PHASE: HUMANIZING ────────────────────────────────────────────────────────

  if (phase === "humanizing") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
            <Wand2 size={14} className="text-primary" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <span className="text-xs text-muted-foreground">Humanizing…</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-8 space-y-3">
            {steps.map((step) => (
              <div key={step.id} className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {step.status === "done" ? (
                    <CheckCircle size={16} className="text-green-500" />
                  ) : step.status === "running" ? (
                    <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-border" />
                  )}
                </div>
                <p className={cn("text-sm leading-relaxed", step.status === "running" ? "text-foreground" : step.status === "done" ? "text-muted-foreground" : "text-muted-foreground/40")}>
                  {step.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE: RESULTS ───────────────────────────────────────────────────────────

  if (phase === "results" && humanizeResult) {
    const { humanizedText, changesSummary, estimatedAiScore, toneApplied, wordCount } = humanizeResult;

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top bar */}
        <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <Wand2 size={14} className="text-primary" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-[11px] text-muted-foreground">AI score reduced to {estimatedAiScore}% · {wordCount.toLocaleString()} words</span>
            </div>
            <div className="flex items-center gap-2">
              <ExportButtons
                getHtml={() => wrapDocHtml("Humanized Text", mdToBodyHtml(humanizedText))}
                getText={() => humanizedText}
                filename={makeLsgFilename("humanizer", "HUMANIZED")}
                formats={["docx", "pdf", "copy"]}
              />
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors"
              >
                <RefreshCcw size={12} /> New text
              </button>
            </div>
          </div>
        </div>

        {/* Score strip */}
        <div className="shrink-0 bg-green-500/5 border-b border-green-500/15 px-4 py-3">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400 font-semibold">AI score: {estimatedAiScore}%</span>
            </div>
            <div className="text-xs text-muted-foreground">Tone: <span className="text-foreground font-medium capitalize">{toneApplied}</span></div>
            <div className="text-xs text-muted-foreground">{wordCount.toLocaleString()} words · Passes Turnitin & GPTZero at most institutions</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 border-b border-border">
          <div className="max-w-4xl mx-auto px-4 flex">
            {([
              { key: "humanized", label: "Humanized Text", icon: Wand2 },
              { key: "changes", label: "Changes Made", icon: FileText },
              { key: "compare", label: "Before / After", icon: ArrowLeftRight },
            ] as { key: ResultTab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setResultTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs font-medium border-b-2 transition-colors",
                  resultTab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={12} />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{key === "humanized" ? "Text" : key === "changes" ? "Changes" : "Compare"}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-5 sm:py-6">
            {resultTab === "humanized" && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {humanizedText.split("\n").map((para, i) =>
                  para.trim() ? (
                    para.startsWith("# ") ? <h1 key={i} className="text-xl font-bold mt-6 mb-3">{para.slice(2)}</h1>
                    : para.startsWith("## ") ? <h2 key={i} className="text-lg font-bold mt-5 mb-2">{para.slice(3)}</h2>
                    : para.startsWith("### ") ? <h3 key={i} className="text-base font-semibold mt-4 mb-2">{para.slice(4)}</h3>
                    : <p key={i} className="text-sm leading-relaxed mb-4 text-foreground">{para}</p>
                  ) : <div key={i} className="mb-2" />
                )}
              </div>
            )}

            {resultTab === "changes" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={14} className="text-green-500" />
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">Humanization complete — {changesSummary.length} improvements applied</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <RiskBadge score={detectionResult?.aiScore ?? 0} label="Original AI score" />
                    <div className="flex items-center justify-center text-2xl text-muted-foreground/30 font-bold">→</div>
                    <RiskBadge score={estimatedAiScore} label="After humanizing" />
                  </div>
                </div>
                <ul className="space-y-2">
                  {changesSummary.map((change, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/30 text-sm">
                      <CheckCircle size={13} className="text-green-500 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resultTab === "compare" && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert size={13} className="text-red-500" />
                    <span className="text-xs font-semibold text-red-500">Original ({detectionResult?.aiScore ?? "?"}% AI)</span>
                  </div>
                  <div className="text-xs leading-relaxed text-muted-foreground space-y-2 max-h-96 overflow-y-auto">
                    {inputText.split("\n").filter(Boolean).slice(0, 8).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                    {inputText.split("\n").filter(Boolean).length > 8 && (
                      <p className="text-muted-foreground/40 italic">…{inputText.split("\n").filter(Boolean).length - 8} more paragraphs</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck size={13} className="text-green-500" />
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">Humanized ({estimatedAiScore}% AI)</span>
                  </div>
                  <div className="text-xs leading-relaxed text-foreground space-y-2 max-h-96 overflow-y-auto">
                    {humanizedText.split("\n").filter(Boolean).slice(0, 8).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                    {humanizedText.split("\n").filter(Boolean).length > 8 && (
                      <p className="text-muted-foreground/40 italic">…{humanizedText.split("\n").filter(Boolean).length - 8} more paragraphs</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <PaywallFlow pickerState={pickerState} checkoutState={checkoutState} closePicker={closePicker} closeCheckout={closeCheckout} chooseSubscription={chooseSubscription} choosePayg={choosePayg} />
      </div>
    );
  }

  return null;
}
