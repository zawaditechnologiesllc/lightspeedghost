import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGeneratePaper } from "@workspace/api-client-react";
import {
  Loader2, Wand2, Copy, BookMarked, CheckCircle, ExternalLink,
  FileText, ListOrdered, AlignLeft, CheckCheck, Sparkles,
} from "lucide-react";
import type { GeneratedPaper } from "@workspace/api-client-react";
import FileUploadZone, { type ExtractedFile } from "@/components/FileUploadZone";
import { detectPaperType, detectCitationStyle, detectLength, extractTopic, extractSubject } from "@/lib/autofill";

const schema = z.object({
  topic: z.string().min(5, "Topic must be at least 5 characters"),
  subject: z.string().min(2, "Subject is required"),
  paperType: z.enum(["research", "essay", "thesis", "literature_review", "report"]),
  length: z.enum(["short", "medium", "long"]),
  citationStyle: z.enum(["apa", "mla", "chicago", "harvard", "ieee"]),
  additionalInstructions: z.string().optional(),
  isStem: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

const PAPER_TYPE_LABELS: Record<string, string> = {
  research: "Research Paper",
  essay: "Essay",
  thesis: "Thesis",
  literature_review: "Literature Review",
  report: "Report",
};

const LENGTH_LABELS: Record<string, { label: string; words: string }> = {
  short: { label: "Short", words: "~800 words" },
  medium: { label: "Medium", words: "~1,500 words" },
  long: { label: "Long", words: "~3,000 words" },
};

/**
 * Minimal markdown renderer — converts ## headings and **bold** to styled JSX.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return <h2 key={i} className="text-base font-bold mt-5 mb-2 text-foreground">{line.slice(3)}</h2>;
    }
    if (line.startsWith("### ")) {
      return <h3 key={i} className="text-sm font-semibold mt-3 mb-1 text-foreground">{line.slice(4)}</h3>;
    }
    if (line.startsWith("# ")) {
      return <h1 key={i} className="text-lg font-bold mt-5 mb-2 text-foreground">{line.slice(2)}</h1>;
    }
    if (line.startsWith("**") && line.endsWith("**")) {
      return <p key={i} className="font-semibold text-sm text-foreground mb-1">{line.slice(2, -2)}</p>;
    }
    if (line.trim() === "") {
      return <div key={i} className="h-2" />;
    }
    // Inline bold
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <p key={i} className="text-sm text-foreground leading-relaxed mb-1">
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    );
  });
}

export default function WritePaper() {
  const [result, setResult] = useState<GeneratedPaper | null>(null);
  const [activeTab, setActiveTab] = useState<"paper" | "citations" | "bibliography">("paper");
  const [copied, setCopied] = useState(false);
  const generatePaper = useGeneratePaper();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      paperType: "research",
      length: "medium",
      citationStyle: "apa",
      isStem: false,
    },
  });

  const onSubmit = async (data: FormData) => {
    const res = await generatePaper.mutateAsync(data);
    setResult(res);
    setActiveTab("paper");
  };

  const handleFileExtracted = (file: ExtractedFile) => {
    const { text } = file;
    const topic = extractTopic(text);
    if (topic) form.setValue("topic", topic);
    const subject = extractSubject(text);
    if (subject) form.setValue("subject", subject);
    form.setValue("paperType", detectPaperType(text));
    form.setValue("citationStyle", detectCitationStyle(text));
    form.setValue("length", detectLength(text));
    form.setValue("additionalInstructions", text.slice(0, 1500));
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: "paper" as const, label: "Paper", icon: FileText },
    { id: "citations" as const, label: `Citations (${result?.citations.length ?? 0})`, icon: BookMarked },
    { id: "bibliography" as const, label: "Bibliography", icon: ListOrdered },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Write a Paper</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real citations from Semantic Scholar & arXiv — no hallucinated references
        </p>
      </div>

      <div className={`grid gap-6 ${result ? "xl:grid-cols-[400px_1fr]" : "max-w-xl"}`}>
        {/* Configuration panel */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <AlignLeft size={13} />
            Configuration
          </h2>

          <FileUploadZone
            onExtracted={handleFileExtracted}
            accept=".pdf,.docx,.doc,.txt,.md"
            label="Upload assignment brief"
            hint="PDF or Word — auto-fills topic, type & length"
          />

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Topic *</label>
              <input
                {...form.register("topic")}
                placeholder="e.g., The impact of social media on mental health"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {form.formState.errors.topic && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.topic.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject *</label>
              <input
                {...form.register("subject")}
                placeholder="e.g., Psychology, Computer Science, Biology"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Paper type — pill buttons */}
            <div>
              <label className="text-sm font-medium mb-2 block">Paper Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(["research", "essay", "thesis", "literature_review", "report"] as const).map((type) => {
                  const watched = form.watch("paperType");
                  return (
                    <label
                      key={type}
                      className={`flex items-center justify-center text-center px-3 py-2 rounded-lg border cursor-pointer text-xs font-medium transition-all ${
                        watched === type
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <input type="radio" value={type} {...form.register("paperType")} className="hidden" />
                      {PAPER_TYPE_LABELS[type]}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Length */}
            <div>
              <label className="text-sm font-medium mb-2 block">Length</label>
              <div className="flex gap-2">
                {(["short", "medium", "long"] as const).map((len) => {
                  const watched = form.watch("length");
                  return (
                    <label
                      key={len}
                      className={`flex-1 text-center px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                        watched === len
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <input type="radio" value={len} {...form.register("length")} className="hidden" />
                      <div className="text-xs font-semibold">{LENGTH_LABELS[len].label}</div>
                      <div className="text-[10px] mt-0.5 opacity-70">{LENGTH_LABELS[len].words}</div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Citation style */}
            <div>
              <label className="text-sm font-medium mb-2 block">Citation Style</label>
              <div className="flex gap-2 flex-wrap">
                {(["apa", "mla", "chicago", "harvard", "ieee"] as const).map((style) => {
                  const watched = form.watch("citationStyle");
                  return (
                    <label
                      key={style}
                      className={`px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-semibold uppercase transition-all ${
                        watched === style
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <input type="radio" value={style} {...form.register("citationStyle")} className="hidden" />
                      {style}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* STEM toggle */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`relative w-8 h-4.5 rounded-full transition-colors ${form.watch("isStem") ? "bg-primary" : "bg-muted"}`}>
                <input type="checkbox" {...form.register("isStem")} className="sr-only" />
                <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${form.watch("isStem") ? "translate-x-3.5" : ""}`} />
              </div>
              <span className="text-sm font-medium">STEM paper (scientific tools)</span>
            </label>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Additional Instructions</label>
              <textarea
                {...form.register("additionalInstructions")}
                rows={3}
                placeholder="Specific requirements, formatting preferences, key points to cover..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={generatePaper.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {generatePaper.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Fetching citations & writing...</span>
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  <span>Generate Paper</span>
                </>
              )}
            </button>

            {generatePaper.isPending && (
              <div className="space-y-1.5">
                {[
                  { step: "Fetching real citations from Semantic Scholar & arXiv", done: true },
                  { step: "Generating paper with Claude 3.5 Sonnet", done: false },
                  { step: "Formatting bibliography", done: false },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    {s.done
                      ? <CheckCircle size={11} className="text-green-500 shrink-0" />
                      : <Loader2 size={11} className="animate-spin text-primary shrink-0" />}
                    {s.step}
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Result panel */}
        {result && (
          <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col min-h-[600px]">
            {/* Tabs header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20 shrink-0">
              <div className="flex gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <tab.icon size={13} />
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BookMarked size={11} />
                  {result.wordCount.toLocaleString()} words
                  <span>·</span>
                  {result.citations.length} verified citations
                </div>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <CheckCheck size={12} className="text-green-500" /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 p-5 overflow-y-auto">
              {activeTab === "paper" && (
                <div className="prose-sm">
                  {/* Verified citation notice */}
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 text-xs text-green-700 dark:text-green-400">
                    <Sparkles size={12} />
                    <span>All citations verified from Semantic Scholar & arXiv — no hallucinated references</span>
                  </div>
                  {renderMarkdown(result.content)}
                </div>
              )}

              {activeTab === "citations" && (
                <div className="space-y-3">
                  {result.citations.map((citation, i) => (
                    <div key={citation.id} className="p-4 bg-muted/30 rounded-xl border border-border hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">[{i + 1}]</span>
                          <CheckCircle size={12} className="text-green-500" />
                          <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Verified • {citation.source}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{citation.year}</span>
                      </div>
                      <div className="text-sm font-semibold text-foreground leading-snug">{citation.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{citation.authors}</div>
                      {citation.url && (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                        >
                          View paper <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "bibliography" && (
                <div className="text-sm text-foreground leading-relaxed font-mono whitespace-pre-wrap bg-muted/20 rounded-lg p-4 border border-border">
                  {result.bibliography}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
