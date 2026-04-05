import { useState, useCallback } from "react";
import {
  ListTree, ChevronRight, Copy, CheckCheck, PenLine, ChevronDown,
  BookOpen, FileText, Zap, CheckCircle, AlertTriangle,
} from "lucide-react";
import FullscreenLoader from "@/components/FullscreenLoader";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import FileUploadZone, { type ExtractedFile } from "@/components/FileUploadZone";
import { detectPaperType, extractTopic, extractSubject } from "@/lib/autofill";
import { usePaywallGuard } from "@/hooks/usePaywallGuard";
import { PaywallFlow } from "@/components/checkout/PaywallFlow";

// ── Types ──────────────────────────────────────────────────────────────────────

type PaperType = "research" | "essay" | "thesis" | "literature_review" | "report";

interface OutlineSection {
  heading: string;
  subsections: string[];
}

interface OutlineResult {
  title: string;
  sections: OutlineSection[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PAPER_TYPES: { value: PaperType; label: string }[] = [
  { value: "research",          label: "Research Paper" },
  { value: "essay",             label: "Essay" },
  { value: "thesis",            label: "Thesis" },
  { value: "literature_review", label: "Lit. Review" },
  { value: "report",            label: "Report" },
];

const SECTION_COLORS = [
  "border-l-blue-500 bg-blue-500/5",
  "border-l-indigo-500 bg-indigo-500/5",
  "border-l-violet-500 bg-violet-500/5",
  "border-l-cyan-500 bg-cyan-500/5",
  "border-l-sky-500 bg-sky-500/5",
  "border-l-purple-500 bg-purple-500/5",
  "border-l-blue-400 bg-blue-400/5",
  "border-l-indigo-400 bg-indigo-400/5",
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function Outline() {
  const { session } = useAuth();
  const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";
  const { guard, openBuy, plan, isAtLimit, pickerState, checkoutState, closePicker, closeCheckout, chooseSubscription, choosePayg } = usePaywallGuard();

  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [paperType, setPaperType] = useState<PaperType>("research");
  const [instructionsText, setInstructionsText] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [instructionsLoaded, setInstructionsLoaded] = useState(false);
  const [referenceWordCount, setReferenceWordCount] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [_loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<OutlineResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  // ── autofill from instructions upload
  const handleInstructionsExtracted = useCallback((file: ExtractedFile) => {
    const text = file.text;
    if (!topic) setTopic(extractTopic(text) ?? "");
    if (!subject) setSubject(extractSubject(text) ?? "");
    setPaperType((detectPaperType(text) as PaperType) || "essay");
    setInstructionsText(text.slice(0, 3000));
    setInstructionsLoaded(true);
  }, [topic, subject]);

  // ── accumulate reading materials
  const handleReferenceExtracted = useCallback((file: ExtractedFile) => {
    setReferenceText(prev => {
      const next = (prev ? prev + "\n\n" : "") + file.text.slice(0, 5000);
      setReferenceWordCount(next.split(/\s+/).filter(Boolean).length);
      return next;
    });
  }, []);

  const toggleSection = (i: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const copyOutline = () => {
    if (!result) return;
    const text = [
      result.title,
      "",
      ...result.sections.flatMap((s, i) => [
        `${i + 1}. ${s.heading}`,
        ...s.subsections.map((sub, j) => `   ${i + 1}.${j + 1} ${sub}`),
      ]),
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleGenerate = async () => {
    if (!topic.trim() || !subject.trim()) return;
    if (isAtLimit("outline")) { guard("outline", () => {}); return; }
    setIsLoading(true);
    setError("");
    setLoadingMsg("Analysing your topic and crafting a structured outline…");

    try {
      const token = session?.access_token;
      const resp = await fetch(`${API_BASE}/writing/outline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic: topic.trim(),
          subject: subject.trim(),
          paperType,
          instructionsText: instructionsText || undefined,
          referenceText: referenceText || undefined,
        }),
      });

      if (!resp.ok) throw new Error("Failed to generate outline — please try again");
      const data: OutlineResult = await resp.json();
      setResult(data);
      setExpandedSections(new Set(data.sections.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
    setIsLoading(false);
    setLoadingMsg("");
  };

  // ── LAYOUT ─────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <FullscreenLoader
          icon={<ListTree size={32} />}
          title="Generating your outline…"
          subtitle={`Building a structured plan for "${topic}" in ${subject}`}
          steps={[
            "Analysing topic scope and academic depth requirements",
            "Designing section hierarchy and argument flow",
            "Generating section titles and sub-headings",
            "Mapping thesis statement and conclusion arc",
            "Adding research angle and evidence prompts per section",
            "Finalising outline — ready to write",
          ]}
        />
      ) : (
      <div className={cn(
        "flex-1 min-h-0",
        result ? "flex flex-col md:flex-row overflow-hidden" : "overflow-y-auto"
      )}>

        {/* ── Form panel ─────────────────────────────────────────────────── */}
        <div className={cn(
          "flex flex-col bg-card/50",
          result
            ? "shrink-0 overflow-hidden border-b md:border-b-0 md:border-r border-border md:w-80 max-h-[40vh] md:max-h-none"
            : "max-w-xl mx-auto w-full"
        )}>
          <div className={cn("px-5 py-5 space-y-5", result && "flex-1 overflow-y-auto")}>

            {/* Page header — only shown before outline is generated */}
            {!result && (
              <div className="text-center space-y-1.5 pt-2 pb-1">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Zap size={16} className="text-primary" />
                  <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Outline Generator</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Structure your paper before writing — 0% AI · &lt;8% plagiarism · one click to full paper
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                <AlertTriangle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Upload: assignment instructions */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block flex items-center gap-1.5">
                <FileText size={11} />
                Assignment Instructions
                <span className="font-normal lowercase tracking-normal text-muted-foreground/60">(auto-fills fields)</span>
              </label>
              <FileUploadZone
                onExtracted={handleInstructionsExtracted}
                accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
                label="Upload brief or assignment sheet"
                hint="PDF, Word, image — topic, subject & type will be detected"
                compact
              />
              {instructionsLoaded && (
                <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle size={10} /> Instructions loaded — fields auto-filled below
                </p>
              )}
            </div>

            {/* Upload: reading materials */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block flex items-center gap-1.5">
                <BookOpen size={11} />
                Reading Materials
                <span className="font-normal lowercase tracking-normal text-muted-foreground/60">(optional)</span>
              </label>
              <FileUploadZone
                onExtracted={handleReferenceExtracted}
                accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
                label="Upload lecture notes, textbook excerpts, articles…"
                hint="AI will use these to build a deeper, more accurate outline"
                compact
              />
              {referenceWordCount > 0 && (
                <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle size={10} /> {referenceWordCount.toLocaleString()} words of reading material loaded
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center">
                <span className="px-2 text-[10px] text-muted-foreground bg-card/50">or fill manually</span>
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Topic *</label>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g., Neural Networks in Medical Diagnosis"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject *</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g., Computer Science, Medicine"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Paper type */}
            <div>
              <label className="text-sm font-medium mb-2 block">Paper Type</label>
              <div className="flex flex-wrap gap-2">
                {PAPER_TYPES.map(pt => (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => setPaperType(pt.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                      paperType === pt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality badge */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-green-500/5 border border-green-500/20 text-[11px] text-green-700 dark:text-green-400">
              <CheckCircle size={13} className="shrink-0" />
              <span>Outline is engineered for <strong>0% AI detection</strong> and <strong>&lt;8% plagiarism risk</strong> when written</span>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || !subject.trim()}
              className="w-full flex items-center justify-center gap-2.5 bg-primary text-primary-foreground px-4 py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <ListTree size={16} />
              Generate Outline
            </button>

            {(!topic.trim() || !subject.trim()) && !isLoading && (
              <p className="text-center text-xs text-muted-foreground -mt-2">Enter a topic and subject to continue</p>
            )}
            <p className="text-center text-[11px] text-muted-foreground/50">
              or{" "}
              <button type="button" onClick={() => openBuy("outline")} className="text-orange-400 hover:text-orange-300 transition-colors font-medium">
                buy a single outline →
              </button>
            </p>
          </div>
        </div>

        {/* ── Result panel ───────────────────────────────────────────────── */}
        {result && (
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Result header */}
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border bg-muted/10">
              <div>
                <h2 className="font-bold text-sm text-foreground leading-tight">{result.title}</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">{result.sections.length} sections</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={copyOutline}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  {copied ? <CheckCheck size={12} className="text-green-500" /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <Link href={`/write?topic=${encodeURIComponent(topic)}&subject=${encodeURIComponent(subject)}&type=${paperType}`}>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-80 border border-primary/30 bg-primary/5 rounded-lg px-2.5 py-1.5 transition-all cursor-pointer">
                    <PenLine size={12} />
                    Write paper
                  </div>
                </Link>
              </div>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-border">
                {result.sections.map((section, i) => {
                  const isExpanded = expandedSections.has(i);
                  const colorClass = SECTION_COLORS[i % SECTION_COLORS.length];
                  return (
                    <div key={i}>
                      <button
                        onClick={() => toggleSection(i)}
                        className="w-full text-left px-5 py-3.5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold border-l-2 shrink-0", colorClass)}>
                            {i + 1}
                          </div>
                          <span className="text-sm font-semibold flex-1 text-foreground">{section.heading}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {section.subsections.length > 0 && (
                              <span className="text-[10px] text-muted-foreground hidden sm:block">
                                {section.subsections.length} subsections
                              </span>
                            )}
                            {isExpanded
                              ? <ChevronDown size={14} className="text-muted-foreground" />
                              : <ChevronRight size={14} className="text-muted-foreground" />}
                          </div>
                        </div>
                      </button>

                      {isExpanded && section.subsections.length > 0 && (
                        <div className="px-5 pb-3 space-y-1 bg-muted/5">
                          {section.subsections.map((sub, j) => (
                            <div key={j} className="flex items-start gap-2 py-1 pl-10">
                              <span className="text-[10px] text-primary font-mono mt-0.5 shrink-0 w-7">
                                {i + 1}.{j + 1}
                              </span>
                              <ChevronRight size={11} className="text-primary/50 mt-0.5 shrink-0" />
                              <span className="text-sm text-muted-foreground">{sub}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Write paper CTA */}
              <div className="p-5">
                <Link href={`/write?topic=${encodeURIComponent(topic)}&subject=${encodeURIComponent(subject)}&type=${paperType}`}>
                  <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-5 py-4 hover:bg-primary/10 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <PenLine size={15} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-primary">Write the full paper</div>
                      <div className="text-xs text-muted-foreground">Generate the complete paper using this outline — topic and subject will be pre-filled</div>
                    </div>
                    <ChevronRight size={16} className="text-primary group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
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
    </>
  );
}
