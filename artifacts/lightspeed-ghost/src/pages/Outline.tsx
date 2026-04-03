import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGenerateOutline } from "@workspace/api-client-react";
import { Loader2, ListTree, ChevronRight } from "lucide-react";
import type { GeneratedOutline } from "@workspace/api-client-react";

const schema = z.object({
  topic: z.string().min(5, "Topic must be at least 5 characters"),
  subject: z.string().min(2, "Subject is required"),
  paperType: z.enum(["research", "essay", "thesis", "literature_review", "report"]),
});

type FormData = z.infer<typeof schema>;

export default function Outline() {
  const [result, setResult] = useState<GeneratedOutline | null>(null);
  const generateOutline = useGenerateOutline();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { paperType: "research" },
  });

  const onSubmit = async (data: FormData) => {
    const res = await generateOutline.mutateAsync(data);
    setResult(res);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Outline Generator</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate a structured outline before writing your paper</p>
      </div>

      <div className={`grid gap-6 ${result ? "lg:grid-cols-2" : ""}`}>
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Topic *</label>
              <input
                {...form.register("topic")}
                placeholder="e.g., Neural Networks in Medical Diagnosis"
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
                placeholder="e.g., Computer Science, Medicine"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Paper Type</label>
              <select {...form.register("paperType")} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="research">Research Paper</option>
                <option value="essay">Essay</option>
                <option value="thesis">Thesis</option>
                <option value="literature_review">Literature Review</option>
                <option value="report">Report</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={generateOutline.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {generateOutline.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Generating Outline...</>
              ) : (
                <><ListTree size={16} /> Generate Outline</>
              )}
            </button>
          </form>
        </div>

        {result && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-bold text-base mb-4">{result.title}</h2>
            <div className="space-y-3">
              {result.sections.map((section, i) => (
                <div key={i} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                    <span className="text-xs font-bold text-primary w-5 text-center">{i + 1}</span>
                    <span className="text-sm font-semibold">{section.heading}</span>
                  </div>
                  {section.subsections && section.subsections.length > 0 && (
                    <div className="px-3 py-2 space-y-1">
                      {section.subsections.map((sub, j) => (
                        <div key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <ChevronRight size={12} className="text-primary shrink-0" />
                          <span>{sub}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
