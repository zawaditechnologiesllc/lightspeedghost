import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSubmitRevision } from "@workspace/api-client-react";
import { Loader2, FileEdit, CheckCircle, ArrowRight } from "lucide-react";
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

export default function Revision() {
  const [result, setResult] = useState<RevisionResult | null>(null);
  const [activeSection, setActiveSection] = useState<"revised" | "changes" | "feedback">("revised");
  const submitRevision = useSubmitRevision();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    const res = await submitRevision.mutateAsync(data);
    setResult(res);
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paper Revision</h1>
        <p className="text-muted-foreground text-sm mt-1">Submit your paper for AI-powered revision with grade improvement</p>
      </div>

      <div className={`grid gap-6 ${result ? "xl:grid-cols-2" : ""}`}>
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Paper Details</h2>
          <FileUploadZone
            onExtracted={handlePaperUploaded}
            accept=".pdf,.docx,.doc,.txt"
            label="Upload your paper"
            hint="PDF or Word — fills paper text automatically (or rubric if short)"
          />
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Original Paper Text *</label>
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
              <textarea
                {...form.register("instructions")}
                rows={3}
                placeholder="What should be improved? e.g., 'Improve academic tone, strengthen arguments, fix grammar'"
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
              <label className="text-sm font-medium mb-1.5 block">A-Grade Marking Criteria</label>
              <FileUploadZone
                onExtracted={handleRubricUploaded}
                accept=".pdf,.docx,.doc,.txt"
                label="Upload marking rubric"
                hint="Auto-fills criteria below"
                compact
                className="mb-2"
              />
              <textarea
                {...form.register("gradingCriteria")}
                rows={3}
                placeholder="Paste the grading rubric or marking criteria here for more targeted revision..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitRevision.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitRevision.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Revising Paper...</>
              ) : (
                <><FileEdit size={16} /> Revise Paper</>
              )}
            </button>
          </form>
        </div>

        {result && (
          <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-border">
              {result.gradeEstimate && (
                <div className="flex items-center gap-2 text-sm bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-3 py-2 rounded-lg border border-green-200 dark:border-green-900 mb-3">
                  <CheckCircle size={14} />
                  <span className="font-medium">{result.gradeEstimate}</span>
                </div>
              )}
              <div className="flex gap-1">
                {(["revised", "changes", "feedback"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveSection(tab)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                      activeSection === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab} {tab === "changes" && `(${result.changes.length})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
              {activeSection === "revised" && (
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {result.revisedText}
                </div>
              )}
              {activeSection === "changes" && (
                <div className="space-y-4">
                  {result.changes.map((change, i) => (
                    <div key={i} className="border border-border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
                        {change.section}
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded border-l-2 border-red-400 text-sm text-red-700 dark:text-red-400">
                          <span className="font-medium text-xs uppercase tracking-wide block mb-1">Original</span>
                          {change.original}
                        </div>
                        <div className="flex items-center justify-center text-muted-foreground">
                          <ArrowRight size={14} />
                        </div>
                        <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded border-l-2 border-green-400 text-sm text-green-700 dark:text-green-400">
                          <span className="font-medium text-xs uppercase tracking-wide block mb-1">Revised</span>
                          {change.revised}
                        </div>
                        <div className="text-xs text-muted-foreground italic">{change.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeSection === "feedback" && (
                <div className="text-sm text-foreground leading-relaxed">{result.feedback}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
