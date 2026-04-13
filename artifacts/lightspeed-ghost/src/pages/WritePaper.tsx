import { useState, useRef, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Loader2, Wand2, Download, Save, CheckCircle, XCircle, ExternalLink,
  FileText, ListOrdered, BookMarked, Zap, BarChart3, Edit3,
  Eye, RotateCcw, ChevronDown, Upload, X, Check, AlertTriangle,
  GraduationCap, FlaskConical,
} from "lucide-react";
import { useWakeLock } from "@/hooks/useWakeLock";
import FileUploadZone, { type ExtractedFile } from "@/components/FileUploadZone";
import MathRenderer from "@/components/MathRenderer";
import { detectPaperType, detectCitationStyle, extractTopic, extractSubject } from "@/lib/autofill";
import { ExportButtons } from "@/components/ExportButtons";
import { mdToBodyHtml, wrapDocHtml, makeLsgFilename } from "@/lib/exportUtils";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { usePaywallGuard } from "@/hooks/usePaywallGuard";
import { PaywallFlow } from "@/components/checkout/PaywallFlow";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  message: string;
  status: "pending" | "running" | "done" | "error";
}

interface Citation {
  id: string; authors: string; title: string; year: number;
  source: string; url?: string; formatted: string; index: number;
}

interface PaperStats {
  grade: number; aiScore: number; plagiarismScore: number;
  wordCount: number; bodyWordCount: number; feedback: string[];
}

interface PaperResult {
  documentId: number; title: string; content: string;
  citations: Citation[]; bibliography: string; stats: PaperStats;
}

type Phase = "config" | "generating" | "results";
type ResultTab = "paper" | "citations" | "bibliography" | "stats";
type PaperViewMode = "view" | "edit";

// ── Config ────────────────────────────────────────────────────────────────────


const ACADEMIC_LEVELS = [
  { value: "high_school",   label: "High School" },
  { value: "undergrad_1_2", label: "UG Year 1–2" },
  { value: "undergrad_3_4", label: "UG Year 3–4" },
  { value: "honours",       label: "Honours" },
  { value: "masters",       label: "Masters" },
  { value: "phd",           label: "PhD" },
];

// Paper types that have a Results/Findings section — show dataset upload for these
const DATA_PAPER_TYPES = new Set([
  "research", "research paper", "lab report", "report",
  "dissertation", "thesis", "case study", "term paper",
]);

const PAPER_TYPES = [
  { value: "research",               label: "Research Paper" },
  { value: "essay",                  label: "Essay" },
  { value: "argumentative",          label: "Argumentative Essay" },
  { value: "thesis",                 label: "Thesis" },
  { value: "dissertation",           label: "Dissertation" },
  { value: "literature_review",      label: "Lit. Review" },
  { value: "annotated bibliography", label: "Annotated Bibliography" },
  { value: "report",                 label: "Report" },
  { value: "lab report",             label: "Lab Report" },
  { value: "case study",             label: "Case Study" },
  { value: "term paper",             label: "Term Paper" },
  { value: "critical analysis",      label: "Critical Analysis" },
  { value: "reflective",             label: "Reflective Essay" },
];

const CITATION_STYLES = ["apa", "mla", "chicago", "harvard", "ieee"] as const;

const STEP_ORDER = ["citations", "data", "stem", "writing", "bibliography", "stats"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderInlineText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3] !== undefined) parts.push(<em key={m.index}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function lineHasMath(line: string): boolean {
  return /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/.test(line);
}

function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("# "))   { nodes.push(<h1 key={i} className="text-xl font-bold mt-6 mb-2 text-foreground">{line.slice(2)}</h1>); i++; continue; }
    if (line.startsWith("## "))  { nodes.push(<h2 key={i} className="text-base font-bold mt-5 mb-2 text-foreground border-b border-border pb-1">{line.slice(3)}</h2>); i++; continue; }
    if (line.startsWith("### ")) { nodes.push(<h3 key={i} className="text-sm font-semibold mt-4 mb-1.5 text-foreground">{line.slice(4)}</h3>); i++; continue; }
    if (line.trim() === "")      { nodes.push(<div key={i} className="h-2" />); i++; continue; }

    if (line.startsWith("$$") && line.trim() !== "$$") {
      nodes.push(<MathRenderer key={i} text={line.trim()} displayMode className="my-4 text-center" />);
      i++; continue;
    }

    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="list-disc list-inside text-sm text-foreground leading-relaxed mb-2 space-y-0.5 pl-2">
          {items.map((it, j) => <li key={j}>{lineHasMath(it) ? <MathRenderer text={it} className="inline" /> : renderInlineText(it)}</li>)}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside text-sm text-foreground leading-relaxed mb-2 space-y-0.5 pl-2">
          {items.map((it, j) => <li key={j}>{lineHasMath(it) ? <MathRenderer text={it} className="inline" /> : renderInlineText(it)}</li>)}
        </ol>
      );
      continue;
    }

    if (lineHasMath(line)) {
      nodes.push(<MathRenderer key={i} text={line} className="text-sm text-foreground leading-relaxed mb-1" />);
      i++; continue;
    }

    nodes.push(
      <p key={i} className="text-sm text-foreground leading-relaxed mb-1">
        {renderInlineText(line)}
      </p>
    );
    i++;
  }

  return nodes;
}

function StatCard({ label, value, color, sublabel, passing }: {
  label: string; value: string; color: string; sublabel?: string; passing?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-2 py-1 sm:px-3 sm:py-2.5 flex items-center gap-2 sm:flex-col sm:items-start sm:gap-0.5 ${color}`}>
      <div className="flex items-center gap-1 shrink-0 sm:w-full">
        <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide opacity-70 leading-none">{label}</span>
        {passing !== undefined && (
          passing
            ? <CheckCircle size={9} className="text-green-500 shrink-0" />
            : <XCircle size={9} className="text-red-400 shrink-0" />
        )}
      </div>
      <span className="text-base sm:text-xl font-bold leading-none">{value}</span>
      {sublabel && <span className="hidden sm:block text-[10px] opacity-60 mt-0.5">{sublabel}</span>}
    </div>
  );
}

function downloadPaper(content: string, title: string, bibliography: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.8;
         max-width: 750px; margin: 60px auto; color: #111; padding: 0 40px; }
  h1 { font-size: 16pt; text-align: center; margin-bottom: 6px; }
  h2 { font-size: 13pt; margin-top: 24px; }
  h3 { font-size: 12pt; margin-top: 16px; }
  p  { margin-bottom: 12px; text-align: justify; }
  .bibliography { margin-top: 32px; border-top: 1px solid #ccc; padding-top: 16px; font-size: 11pt; }
</style>
</head>
<body>
${content
  .replace(/^# (.*)/gm, "<h1>$1</h1>")
  .replace(/^## (.*)/gm, "<h2>$1</h2>")
  .replace(/^### (.*)/gm, "<h3>$1</h3>")
  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  .replace(/\*(.*?)\*/g, "<em>$1</em>")
  .split("\n\n").map(p => p.startsWith("<h") ? p : `<p>${p}</p>`).join("\n")}
<div class="bibliography"><h2>References</h2><p>${bibliography.replace(/\n/g, "<br>")}</p></div>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, "_")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WritePaper() {
  const { user } = useAuth();
  const { guard, openBuy, plan, isAtLimit, pickerState, checkoutState, closePicker, closeCheckout, chooseSubscription, choosePayg } = usePaywallGuard();

  // ── phase
  const [phase, setPhase] = useState<Phase>("config");
  const [steps, setSteps] = useState<Step[]>([]);
  const [streamedContent, setStreamedContent] = useState("");
  const [result, setResult] = useState<PaperResult | null>(null);
  const [genError, setGenError] = useState("");

  // ── results UI
  const [resultTab, setResultTab] = useState<ResultTab>("paper");
  const [viewMode, setViewMode] = useState<PaperViewMode>("view");
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // ── form
  const [paperType, setPaperType] = useState("research");
  const [citationStyle, setCitationStyle] = useState<string>("apa");
  const [wordCount, setWordCount] = useState(1000);
  const [academicLevel, setAcademicLevel] = useState("undergrad_3_4");
  const [isStem, setIsStem] = useState(false);
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [rubricText, setRubricText] = useState("");
  const [fromPlagiarism, setFromPlagiarism] = useState(false);
  const [referenceText, setReferenceText] = useState("");
  const [datasetText, setDatasetText] = useState("");
  const [datasetPreview, setDatasetPreview] = useState<string[][]>([]);

  // ── citation confirmation
  const [detectedStyle, setDetectedStyle] = useState<string | null>(null);
  const [styleConfirmed, setStyleConfirmed] = useState(false);

  // ── ref for streaming scroll
  const streamRef = useRef<HTMLDivElement>(null);

  // ── target word count captured at generation start (for condition checking)
  const targetWordCountRef = useRef<number>(1500);

  // ── keep screen awake during generation
  useWakeLock(phase === "generating");

  // ── autofill from assignment brief
  const handleBriefExtracted = useCallback((file: ExtractedFile) => {
    const text = file.text;
    if (!topic) setTopic(extractTopic(text) ?? "");
    if (!subject) setSubject(extractSubject(text) ?? "");
    setPaperType(detectPaperType(text));
    const detected = detectCitationStyle(text);
    setDetectedStyle(detected);
    setStyleConfirmed(false);
    setCitationStyle(detected);
    setAdditionalInstructions(text.slice(0, 2000));
    // detect word count
    const wMatch = text.match(/(\d[\d,]*)\s*(?:to\s*(\d[\d,]*))?\s*words?\b/i);
    if (wMatch) {
      const n = parseInt(wMatch[1].replace(/,/g, ""), 10);
      if (n >= 100 && n <= 15000) setWordCount(n);
    }
  }, [topic, subject]);

  // ── pre-fill from AI & Plagiarism checker redirect, or from Outline
  useEffect(() => {
    // 1. Check for outline prefill stored in sessionStorage
    const outlinePrefill = sessionStorage.getItem("outline_prefill");
    if (outlinePrefill) {
      try {
        const data = JSON.parse(outlinePrefill) as {
          topic?: string;
          subject?: string;
          paperType?: string;
          wordCount?: number;
          additionalInstructions?: string;
        };
        sessionStorage.removeItem("outline_prefill");
        if (data.topic)    setTopic(data.topic);
        if (data.subject)  setSubject(data.subject);
        if (data.paperType) setPaperType(data.paperType);
        if (data.wordCount) setWordCount(data.wordCount);
        if (data.additionalInstructions) setAdditionalInstructions(data.additionalInstructions);
        return; // skip URL params if outline prefill was used
      } catch { /* ignore parse errors */ }
    }

    // 2. Fallback: URL params (from plagiarism checker or other tools)
    const params = new URLSearchParams(window.location.search);
    const t = params.get("topic");
    const s = params.get("subject");
    const pt = params.get("type");
    const from = params.get("from");
    if (t) setTopic(decodeURIComponent(t));
    if (s) setSubject(decodeURIComponent(s));
    if (pt) setPaperType(pt);
    if (from === "plagiarism") setFromPlagiarism(true);
  }, []);

  // ── autofill from rubric
  const handleRubricExtracted = useCallback((file: ExtractedFile) => {
    setRubricText(file.text.slice(0, 3000));
  }, []);

  // ── accumulate reference / reading materials
  const handleReferenceExtracted = useCallback((file: ExtractedFile) => {
    setReferenceText(prev => (prev ? prev + "\n\n" : "") + file.text.slice(0, 5000));
  }, []);

  // ── dataset upload (CSV / TSV / text)
  const handleDatasetUpload = useCallback((file: ExtractedFile) => {
    const raw = file.text.slice(0, 50000);
    setDatasetText(raw);
    const lines = raw.trim().split("\n").filter(Boolean);
    if (lines.length > 0) {
      const firstLine = lines[0];
      const sep = firstLine.split("\t").length > firstLine.split(",").length ? "\t" : ",";
      setDatasetPreview(lines.slice(0, 4).map(l => l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""))));
    }
  }, []);

  // ── generate
  const handleGenerate = async () => {
    if (!topic.trim() || !subject.trim()) return;
    if (isAtLimit("paper")) { guard("paper", () => {}); return; }

    targetWordCountRef.current = wordCount;
    setPhase("generating");
    setStreamedContent("");
    setGenError("");
    const initialSteps: Step[] = STEP_ORDER
      .filter(id => id !== "stem" || isStem)
      .filter(id => id !== "data" || !!datasetText.trim())
      .map(id => ({ id, message: "", status: "pending" }));
    setSteps(initialSteps);

    try {
      
      const resp = await apiFetch(`/writing/generate-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({
          topic: topic.trim(),
          subject: subject.trim(),
          paperType,
          wordCount,
          citationStyle,
          academicLevel,
          isStem,
          additionalInstructions: additionalInstructions.trim() || undefined,
          rubricText: rubricText.trim() || undefined,
          referenceText: referenceText.trim() || undefined,
          datasetText: datasetText.trim() || undefined,
        }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error("Server error — please try again");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const updateStep = (id: string, message: string, status: Step["status"]) => {
        setSteps(prev => {
          const exists = prev.some(s => s.id === id);
          if (exists) return prev.map(s => s.id === id ? { ...s, message, status } : s);
          return [...prev, { id, message, status }];
        });
      };

      let receivedFinalEvent = false;
      let event = ""; // persists across chunks — event: and data: lines may arrive in different chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("event: ")) { event = line.slice(7).trim(); }
          else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (event === "step") {
                updateStep(data.id, data.message, data.status);
              } else if (event === "token") {
                setStreamedContent(prev => {
                  const next = prev + data.text;
                  setTimeout(() => streamRef.current?.scrollTo(0, streamRef.current.scrollHeight), 0);
                  return next;
                });
              } else if (event === "done") {
                receivedFinalEvent = true;
                setResult(data as PaperResult);
                setEditedContent(data.content);
                setPhase("results");
                setResultTab("paper");
                setViewMode("view");
              } else if (event === "error") {
                receivedFinalEvent = true;
                setGenError(data.message ?? "Unknown error");
                setPhase("config");
              }
            } catch { /* ignore parse errors */ }
            event = "";
          }
        }
      }
      // Stream ended without a final "done" or "error" event — connection was interrupted
      if (!receivedFinalEvent) {
        setGenError("Connection was interrupted before the paper was completed. The server may need more time — please try again.");
        setPhase("config");
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Network error — please try again");
      setPhase("config");
    }
  };

  // ── save edits
  const handleSave = async () => {
    if (!result) return;
    setIsSaving(true);
    // Always apply edits locally and switch to view immediately
    setResult(prev => prev ? { ...prev, content: editedContent } : prev);
    setViewMode("view");

    if (!result.documentId) {
      setSaveMsg("Edits applied");
      setTimeout(() => setSaveMsg(""), 2000);
      setIsSaving(false);
      return;
    }

    try {
      const resp = await apiFetch(`/writing/save/${result.documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editedContent }),
      });
      if (resp.ok) {
        const data = await resp.json() as { wordCount: number };
        setResult(prev => prev ? { ...prev, stats: { ...prev.stats, bodyWordCount: data.wordCount } } : prev);
        setSaveMsg("Changes saved!");
      } else {
        setSaveMsg("Server save failed — edits kept locally");
      }
    } catch {
      setSaveMsg("Save failed — edits kept locally");
    }
    setTimeout(() => setSaveMsg(""), 3000);
    setIsSaving(false);
  };

  // ── GENERATING PHASE ──────────────────────────────────────────────────────

  if (phase === "generating") {
    const doneCount = steps.filter(s => s.status === "done").length;
    const total = steps.filter(s => s.status !== "pending" || s.message).length || steps.length;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    // Approximate live word count from streamed content
    const liveWords = streamedContent.trim().split(" ").filter(Boolean).length;
    const runningStep = steps.find(s => s.status === "running");

    return (
      <div className="h-full flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-border bg-card flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-primary" />
            <span className="font-bold tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
              LIGHT SPEED AI
            </span>
          </div>
          <span className="text-muted-foreground text-sm hidden sm:inline">— Working on your paper</span>
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            {liveWords > 0 && (
              <span className="tabular-nums">{liveWords.toLocaleString()} words written</span>
            )}
            <span>{pct}%</span>
          </div>
        </div>

        {/* Slim progress bar */}
        <div className="h-0.5 bg-muted shrink-0">
          <div
            className="h-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-700"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Left: narrative activity feed */}
          <div className="shrink-0 border-b md:border-b-0 md:w-80 md:border-r border-border flex flex-col overflow-hidden max-h-44 md:max-h-none">
            {/* Current action headline */}
            <div className="px-5 py-4 border-b border-border bg-muted/20 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Currently</p>
              <p className="text-sm font-medium text-foreground leading-snug min-h-[2.5rem]">
                {runningStep?.message ?? (doneCount === total && total > 0 ? "Finalising paper…" : "Preparing to start…")}
              </p>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0">
              {steps.map((step, i) => (
                <div key={step.id} className="relative">
                  {/* Vertical connector */}
                  {i < steps.length - 1 && (
                    <div className="absolute left-[7px] top-5 w-px h-full bg-border" />
                  )}

                  <div className="flex items-start gap-3 py-2.5">
                    {/* Status indicator — no spinner, just dots and marks */}
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
                      {step.status === "error" && (
                        <div className="w-3.5 h-3.5 rounded-full bg-destructive/20 border border-destructive" />
                      )}
                    </div>

                    <p className={cn(
                      "text-xs leading-relaxed flex-1",
                      step.status === "done"    && "text-muted-foreground",
                      step.status === "running" && "text-foreground font-medium",
                      step.status === "pending" && "text-muted-foreground/35",
                      step.status === "error"   && "text-destructive",
                    )}>
                      {step.message || (step.status === "pending" ? "Queued…" : "—")}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-border shrink-0">
              <p className="text-[10px] text-muted-foreground/50">Keep this window open while LightSpeed AI works</p>
            </div>
          </div>

          {/* Right: live paper stream */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-muted/10 shrink-0 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Live Paper Preview</span>
              {streamedContent && (
                <span className="text-[10px] text-muted-foreground/60 ml-auto">{liveWords.toLocaleString()} words</span>
              )}
            </div>
            <div
              ref={streamRef}
              className="flex-1 p-5 overflow-y-auto"
            >
              {streamedContent ? (
                <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground leading-relaxed">
                  {streamedContent}
                  <span className="inline-block w-0.5 h-3.5 bg-primary align-middle ml-0.5 animate-pulse" />
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground/30">
                  <Zap size={32} className="text-primary/20" />
                  <p className="text-sm">Paper will appear here as it is written…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS PHASE ─────────────────────────────────────────────────────────

  if (phase === "results" && result) {
    const { stats } = result;
    const targetWords = targetWordCountRef.current;
    const maxWords     = Math.ceil(targetWords * 1.05);
    const gradePassing = stats.grade >= 92;
    const aiPassing    = stats.aiScore === 0;
    const plagPassing  = stats.plagiarismScore <= 8;
    const minWords     = Math.floor(targetWords * 0.95);
    const wordsPassing = stats.bodyWordCount >= minWords && stats.bodyWordCount <= maxWords;
    const citePassing  = result.citations.length >= 5;
    const gradeColor = gradePassing
      ? "border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400"
      : "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400";
    const aiColor  = aiPassing  ? "border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400" : "border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400";
    const plagColor= plagPassing ? "border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400" : "border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400";

    return (
      <div className="h-full flex flex-col bg-background overflow-hidden">
        {/* Stats header */}
        <div className="shrink-0 px-3 sm:px-5 py-2 sm:py-3 border-b border-border bg-card flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 sm:gap-2 flex-wrap overflow-x-auto">
            <StatCard label="Est. Grade" value={`${stats.grade}%`} color={gradeColor} sublabel="Academic quality" passing={gradePassing} />
            <StatCard label="AI Score" value={`${stats.aiScore}%`} color={aiColor} sublabel="AI detection est." passing={aiPassing} />
            <StatCard label="Plagiarism" value={`${stats.plagiarismScore}%`} color={plagColor} sublabel="Originality est." passing={plagPassing} />
            <StatCard label="Body Words" value={stats.bodyWordCount.toLocaleString()} color="border-border bg-muted/30 text-foreground" sublabel={`${minWords.toLocaleString()}–${maxWords.toLocaleString()} words`} passing={wordsPassing} />
            <StatCard label="Citations" value={String(result.citations.length)} color="border-border bg-muted/30 text-foreground" sublabel="Verified sources" passing={citePassing} />
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {saveMsg && (
              <span className={cn("text-xs px-2 py-1 rounded", saveMsg.includes("fail") ? "text-destructive" : "text-green-600 dark:text-green-400")}>
                {saveMsg}
              </span>
            )}
            {resultTab === "paper" && viewMode === "edit" && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
            )}
            <ExportButtons
              getHtml={() => wrapDocHtml(result.title, mdToBodyHtml(result.content) + (result.bibliography ? `<hr class="section-rule"><h2>References</h2><p>${result.bibliography.replace(/\n/g, "<br>")}</p>` : ""))}
              getText={() => `${result.content}\n\nReferences:\n${result.bibliography}`}
              filename={makeLsgFilename("paper", result.title || "PAPER")}
              formats={["docx", "pdf", "copy"]}
            />
            <button
              onClick={() => { setPhase("config"); setResult(null); setStreamedContent(""); }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
            >
              <RotateCcw size={12} />
              New Paper
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="shrink-0 px-3 sm:px-5 py-2 border-b border-border bg-card flex items-center justify-between overflow-x-auto">
          <div className="flex gap-1 flex-nowrap shrink-0">
            {([
              { id: "paper", label: "Paper", icon: FileText },
              { id: "citations", label: `Citations (${result.citations.length})`, icon: BookMarked },
              { id: "bibliography", label: "Bibliography", icon: ListOrdered },
              { id: "stats", label: "Quality Report", icon: BarChart3 },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setResultTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  resultTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>
          {resultTab === "paper" && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode("view")}
                className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs", viewMode === "view" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <Eye size={11} /> View
              </button>
              <button
                onClick={() => setViewMode("edit")}
                className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs", viewMode === "edit" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <Edit3 size={11} /> Edit
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Paper tab ── */}
          {resultTab === "paper" && viewMode === "view" && (
            <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 sm:py-6">
              <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 text-xs text-green-700 dark:text-green-400">
                <CheckCircle size={12} />
                All citations verified from Semantic Scholar & arXiv — no hallucinated references
              </div>
              {renderMarkdown(result.content)}
            </div>
          )}

          {resultTab === "paper" && viewMode === "edit" && (
            <div className="h-full p-4">
              <p className="text-xs text-muted-foreground mb-2 px-1">Edit the paper below. Click Save Changes when done to persist your edits.</p>
              <textarea
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                className="w-full h-[calc(100%-2rem)] p-4 font-mono text-sm bg-muted/20 border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                spellCheck
              />
            </div>
          )}

          {/* ── Citations tab ── */}
          {resultTab === "citations" && (
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-3">
              {result.citations.map((citation) => (
                <div key={citation.id} className="p-4 bg-muted/30 rounded-xl border border-border hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">[{citation.index}]</span>
                      <CheckCircle size={12} className="text-green-500" />
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Verified · {citation.source}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{citation.year}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-snug">{citation.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{citation.authors}</p>
                  {citation.url && (
                    <a href={citation.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                      View paper <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Bibliography tab ── */}
          {resultTab === "bibliography" && (
            <div className="max-w-3xl mx-auto px-6 py-6">
              <div className="text-sm text-foreground leading-relaxed font-mono whitespace-pre-wrap bg-muted/20 rounded-xl p-5 border border-border">
                {result.bibliography}
              </div>
            </div>
          )}

          {/* ── Stats tab ── */}
          {resultTab === "stats" && (
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className={cn("rounded-xl border p-2.5 sm:p-4 text-center", gradeColor)}>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    {gradePassing ? <CheckCircle size={11} /> : <XCircle size={11} className="text-red-400" />}
                    <div className="text-xl sm:text-3xl font-bold leading-none">{stats.grade}%</div>
                  </div>
                  <div className="text-[10px] sm:text-xs mt-1 opacity-70">Estimated Grade</div>
                  <div className="text-[9px] sm:text-[10px] mt-0.5 font-semibold">
                    {stats.grade >= 95 ? "Distinction" : stats.grade >= 92 ? "High Merit" : stats.grade >= 85 ? "Merit" : "Pass"}
                  </div>
                </div>
                <div className={cn("rounded-xl border p-2.5 sm:p-4 text-center", aiColor)}>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    {aiPassing ? <CheckCircle size={11} /> : <XCircle size={11} className="text-red-400" />}
                    <div className="text-xl sm:text-3xl font-bold leading-none">{stats.aiScore}%</div>
                  </div>
                  <div className="text-[10px] sm:text-xs mt-1 opacity-70">AI Detection</div>
                  <div className="text-[9px] sm:text-[10px] mt-0.5 font-semibold">
                    {stats.aiScore === 0 ? "Undetectable" : stats.aiScore <= 5 ? "Excellent" : "Review"}
                  </div>
                </div>
                <div className={cn("rounded-xl border p-2.5 sm:p-4 text-center", plagColor)}>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    {plagPassing ? <CheckCircle size={11} /> : <XCircle size={11} className="text-red-400" />}
                    <div className="text-xl sm:text-3xl font-bold leading-none">{stats.plagiarismScore}%</div>
                  </div>
                  <div className="text-[10px] sm:text-xs mt-1 opacity-70">Plagiarism Risk</div>
                  <div className="text-[9px] sm:text-[10px] mt-0.5 font-semibold">
                    {stats.plagiarismScore <= 4 ? "Original" : stats.plagiarismScore <= 8 ? "Acceptable" : "High Risk"}
                  </div>
                </div>
              </div>

              {stats.feedback.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3">AI Quality Feedback</h3>
                  <ul className="space-y-2">
                    {stats.feedback.map((fb, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle size={14} className="text-primary shrink-0 mt-0.5" />
                        {fb}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-muted/20 border border-border rounded-xl p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Important note on estimates</p>
                These scores are AI-estimated quality indicators, not results from a live plagiarism scanner or certified AI detector. For final submission, run your paper through Turnitin or Copyleaks for authoritative results.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── CONFIG PHASE ──────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6">

          {/* Page header */}
          <div className="text-center space-y-1.5 pt-2">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Zap size={16} className="text-primary" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Write a Paper</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real verified citations · Live generation · Grade &amp; plagiarism estimates
            </p>
          </div>

        {fromPlagiarism && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-primary/10 border border-primary/30 rounded-xl text-sm text-primary">
            <div className="flex items-center gap-2">
              <Zap size={14} className="shrink-0" />
              <span>Topic and subject pre-filled from your AI & Plagiarism check — review and add any missing details below</span>
            </div>
            <button onClick={() => setFromPlagiarism(false)} className="shrink-0 hover:opacity-60 transition-opacity text-base leading-none">&times;</button>
          </div>
        )}

        {genError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
            <AlertTriangle size={14} />
            {genError}
          </div>
        )}

        {/* ── File uploads ── */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Assignment Instructions</label>
            <FileUploadZone
              onExtracted={handleBriefExtracted}
              accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
              label="Upload brief / instructions"
              hint="PDF, Word, image — auto-fills form fields"
              compact
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Marking Rubric (optional)</label>
            <FileUploadZone
              onExtracted={handleRubricExtracted}
              accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
              label="Upload grading criteria"
              hint="Used to optimise grade estimation"
              compact
            />
            {rubricText && (
              <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                <CheckCircle size={10} /> Rubric loaded ({rubricText.trim().split(" ").filter(Boolean).length} words)
              </p>
            )}
          </div>
        </div>

        {/* ── Reference / Reading Materials ── */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
            Class Materials &amp; Reading References
            <span className="text-[10px] font-normal ml-1 text-muted-foreground/60">(optional — AI will draw on these when writing)</span>
          </label>
          <FileUploadZone
            onExtracted={handleReferenceExtracted}
            accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
            label="Upload class notes, textbook excerpts, recommended studies…"
            hint="Lecture slides, required readings, journal articles — the AI uses these as source material"
          />
          {referenceText && (
            <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
              <CheckCircle size={10} /> Reference materials loaded ({referenceText.trim().split(" ").filter(Boolean).length.toLocaleString()} words) — AI will draw on these while writing
            </p>
          )}
        </div>

        {/* ── Dataset upload (quantitative paper types only) ── */}
        {DATA_PAPER_TYPES.has(paperType) && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
              Your Dataset
              <span className="text-[10px] font-normal ml-1 text-muted-foreground/60">(optional — for Results/Findings sections)</span>
            </label>
            <FileUploadZone
              onExtracted={handleDatasetUpload}
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              label="Upload your data file (CSV, TSV, Excel)…"
              hint="The AI computes descriptive statistics and writes your Results section from actual data"
            />
            <div className="mt-2">
              <textarea
                value={datasetText}
                onChange={e => {
                  const raw = e.target.value;
                  setDatasetText(raw);
                  const lines = raw.trim().split("\n").filter(Boolean);
                  if (lines.length > 1) {
                    const sep = lines[0].split("\t").length > lines[0].split(",").length ? "\t" : ",";
                    setDatasetPreview(lines.slice(0, 4).map(l => l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""))));
                  } else {
                    setDatasetPreview([]);
                  }
                }}
                rows={3}
                placeholder={"Or paste CSV / tab-separated data directly here…\ne.g.  Group,Score,Age\n      Control,72.3,21\n      Treatment,84.1,23"}
                className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            {datasetPreview.length > 1 && (
              <div className="mt-1.5 rounded-lg border border-green-500/30 bg-green-500/5 p-2 overflow-x-auto">
                <p className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1 mb-1.5 font-medium">
                  <CheckCircle size={10} /> Dataset ready — {datasetText.trim().split("\n").length - 1} rows × {datasetPreview[0]?.length ?? 0} variables
                </p>
                <table className="text-[10px] w-full border-collapse">
                  <thead>
                    <tr>
                      {datasetPreview[0]?.map((h, i) => (
                        <th key={i} className="text-left px-2 py-0.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datasetPreview.slice(1).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-0.5 text-muted-foreground whitespace-nowrap">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {datasetText && (
              <p className="text-[10px] text-muted-foreground mt-1">
                AI will compute means, medians, and standard deviations — your Results section will cite real numbers
              </p>
            )}
          </div>
        )}

        {/* ── Topic & Subject ── */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Topic *</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g., Impact of social media on mental health"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Subject *</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g., Psychology, Computer Science"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* ── Paper type ── */}
        <div>
          <label className="text-sm font-medium mb-2 block">Paper Type</label>
          <div className="flex gap-2 flex-wrap">
            {PAPER_TYPES.map(pt => (
              <button
                key={pt.value}
                type="button"
                onClick={() => setPaperType(pt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                  paperType === pt.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Word count ── */}
        <div>
          <label className="text-sm font-medium mb-2 block">Word Count</label>
          <input
            type="number"
            min={100}
            max={15000}
            value={wordCount}
            onChange={e => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) setWordCount(v);
            }}
            className="w-44 px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Paper will be written to exactly <strong>{wordCount.toLocaleString()}</strong> words (±5%).
          </p>
        </div>

        {/* ── Citation style ── */}
        <div>
          <label className="text-sm font-medium mb-2 block">Citation Style</label>
          {/* Citation confirmation banner */}
          {detectedStyle && !styleConfirmed && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs">
              <BookMarked size={11} className="text-primary" />
              <span>Detected <strong>{detectedStyle.toUpperCase()}</strong> from your instructions.</span>
              <button
                onClick={() => { setCitationStyle(detectedStyle); setStyleConfirmed(true); }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary text-primary-foreground font-medium ml-1"
              >
                <Check size={10} /> Confirm
              </button>
              <button onClick={() => setDetectedStyle(null)} className="text-muted-foreground hover:text-foreground ml-1">
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {CITATION_STYLES.map(style => (
              <button
                key={style}
                type="button"
                onClick={() => { setCitationStyle(style); setStyleConfirmed(true); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-all",
                  citationStyle === style ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        {/* ── Academic level ── */}
        <div>
          <label className="text-sm font-medium mb-2 flex items-center gap-1.5 block">
            <GraduationCap size={14} />
            Academic Level
          </label>
          <div className="flex gap-2 flex-wrap">
            {ACADEMIC_LEVELS.map(lvl => (
              <button
                key={lvl.value}
                type="button"
                onClick={() => setAcademicLevel(lvl.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                  academicLevel === lvl.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── STEM toggle ── */}
        <button
          type="button"
          onClick={() => setIsStem(!isStem)}
          className={cn(
            "flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all text-left",
            isStem ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
          )}
        >
          <div className={cn("relative w-9 h-5 rounded-full transition-colors", isStem ? "bg-primary" : "bg-muted")}>
            <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", isStem ? "translate-x-4" : "")} />
          </div>
          <FlaskConical size={15} className={isStem ? "text-primary" : "text-muted-foreground"} />
          <div>
            <p className="text-sm font-medium">STEM Paper</p>
            <p className="text-[11px] text-muted-foreground">Activates equations, derivations & technical analysis module</p>
          </div>
        </button>

        {/* ── Additional instructions ── */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Additional Instructions</label>
          <textarea
            value={additionalInstructions}
            onChange={e => setAdditionalInstructions(e.target.value)}
            rows={3}
            placeholder="Specific requirements, key arguments to cover, formatting preferences…"
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* ── Generate button ── */}
        <div className="pt-2">
          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || !subject.trim()}
            className="w-full flex items-center justify-center gap-2.5 bg-primary text-primary-foreground px-4 py-4 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <Zap size={18} className="shrink-0" />
            Generate Paper with LightSpeed AI
          </button>
          {(!topic.trim() || !subject.trim()) && (
            <p className="text-center text-xs text-muted-foreground mt-2">Enter a topic and subject to continue</p>
          )}
          <p className="text-center text-[11px] text-muted-foreground/50 mt-1.5">
            or{" "}
            <button type="button" onClick={() => openBuy("paper")} className="text-orange-400 hover:text-orange-300 transition-colors font-medium">
              buy a single paper →
            </button>
          </p>
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
