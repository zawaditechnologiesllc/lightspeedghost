import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSubmitRevision } from "@workspace/api-client-react";
import {
  Loader2, FileEdit, CheckCircle, ArrowRight, Copy, CheckCheck,
  TrendingUp, AlertCircle, BookOpen,
} from "lucide-react";
import type { RevisionResult } from "@workspace/api-client-react";
import FileUploadZone, { type ExtractedFile } from "@/components/FileUploadZone";

const schema = z.object({
  originalText: z.string().min(50, "Please provide at least 50 characters of text"),
  instructions: z.string().min(10, "Please provide revision instructions"),
  marksScored: z.string().optional(),
  gradingCriteria: z.string().optional(),
  targetGrade: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const QUICK_INSTRUCTIONS = [
  "Improve academic tone and vocabulary",
  "Strengthen argument structure",
  "Fix grammar and clarity",
  "Add stronger evidence and citations",
];

export default function Revision() {
  const [result, setResult] = useState<RevisionResult | null>(null);
  const [activeSection, setActiveSection] = useState<"revised" | "changes" | "feedback">("revised");
  const [copied, setCopied] = useState(false);
  const submitRevision = useSubmitRevision();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    const res = await submitRevision.mutateAsync(data);
    setResult(res);
    setActiveSection("revised");
  };

  const handlePaperUploaded = (file: ExtractedFile) => {
    if (file.wordCount > 300) {
      form.setValue("originalText", file.text);
    } else {
      form.setValue("gradingCriteria", file.text);
    }
  };

  const handleRubricUploaded = (file: ExtractedFile) => {
    form.setValue("gradingCriteria", file.text);
  };

  const copyRevised = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.revisedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addInstruction = (instruction: string) => {
    const current = form.getValues("instructions") ?? "";
    form.setValue("instructions", current ? `${current}; ${instruction}` : instruction);
  };

  const wordCount = form.watch("originalText")?.split(/\s+/).filter(Boolean).length ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paper Revision</h1>
        <p className="text-muted-foreground text-sm mt-1">AI-powered revision with tracked changes and grade improvement estimate</p>
      </div>

      <div className={`grid gap-6 ${result ? "xl:grid-cols-[420px_1fr]" : "max-w-xl"}`}>
        {/* Input panel */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <BookOpen size={13} />
            Paper Details
          </h2>

          <FileUploadZone
            onExtracted={handlePaperUploaded}
            accept=".pdf,.docx,.doc,.txt"
            label="Upload your paper"
            hint="PDF or Word — auto-fills the text area below"
          />

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">Original Paper Text *</label>
                {wordCount > 0 && (
                  <span className="text-xs text-muted-foreground">{wordCount.toLocaleString()} words</span>
                )}
              </div>
              <textarea
                {...form.register("originalText")}
                rows={8}
                placeholder="Paste your paper text here..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono leading-relaxed"
              />
              {form.formState.errors.originalText && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.originalText.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Revision Instructions *</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_INSTRUCTIONS.map((ins) => (
                  <button
                    key={ins}
                    type="button"
                    onClick={() => addInstruction(ins)}
                    className="text-xs px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                  >
                    + {ins}
                  </button>
                ))}
              </div>
              <textarea
                {...form.register("instructions")}
                rows={3}
                placeholder="What should be improved? Click the quick tags above or type here..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              {form.formState.errors.instructions && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.instructions.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Marks Scored</label>
                <input
                  {...form.register("marksScored")}
                  placeholder="e.g., 65 or 65/100"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Target Grade</label>
                <input
                  {...form.register("targetGrade")}
                  placeholder="e.g., A, 85%, First Class"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Marking Criteria / Rubric</label>
              <FileUploadZone
                onExtracted={handleRubricUploaded}
                accept=".pdf,.docx,.doc,.txt"
                label="Upload rubric"
                hint="Auto-fills criteria"
                compact
                className="mb-2"
              />
              <textarea
                {...form.register("gradingCriteria")}
                rows={3}
                placeholder="Paste grading rubric here for targeted revision..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitRevision.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitRevision.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Revising with Claude...</>
              ) : (
                <><FileEdit size={16} /> Revise Paper</>
              )}
            </button>
          </form>
        </div>

        {/* Result panel */}
        {result && (
          <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col min-h-[600px]">
            {/* Grade estimate banner */}
            {result.gradeEstimate && (
              <div className="px-5 py-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-b border-green-200 dark:border-green-900/50 flex items-center gap-3">
                <TrendingUp size={16} className="text-green-600 dark:text-green-400 shrink-0" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">{result.gradeEstimate}</span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20 shrink-0">
              <div className="flex gap-1">
                {(["revised", "changes", "feedback"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveSection(tab)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                      activeSection === tab
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {tab} {tab === "changes" && result.changes.length > 0 && (
                      <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                        {result.changes.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {activeSection === "revised" && (
                <button
                  onClick={copyRevised}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <CheckCheck size={12} className="text-green-500" /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              )}
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
              {activeSection === "revised" && (
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {result.revisedText}
                </div>
              )}

              {activeSection === "changes" && (
                <div className="space-y-4">
                  {result.changes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No tracked changes — see the Revised tab for the improved paper
                    </div>
                  ) : (
                    result.changes.map((change, i) => (
                      <div key={i} className="border border-border rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                          {change.section}
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border-l-3 border-red-400">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-red-500 mb-1 flex items-center gap-1">
                              <AlertCircle size={9} /> Original
                            </div>
                            <div className="text-sm text-red-700 dark:text-red-300 leading-relaxed">{change.original}</div>
                          </div>
                          <div className="flex items-center justify-center">
                            <ArrowRight size={14} className="text-muted-foreground" />
                          </div>
                          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border-l-3 border-green-400">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-green-600 mb-1 flex items-center gap-1">
                              <CheckCircle size={9} /> Revised
                            </div>
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

              {activeSection === "feedback" && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/50">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen size={14} className="text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Overall Feedback</span>
                    </div>
                    <div className="text-sm text-foreground leading-relaxed">{result.feedback}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
