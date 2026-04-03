import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGeneratePaper } from "@workspace/api-client-react";
import { Loader2, Wand2, Copy, Download, BookMarked } from "lucide-react";
import type { GeneratedPaper } from "@workspace/api-client-react";

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

export default function WritePaper() {
  const [result, setResult] = useState<GeneratedPaper | null>(null);
  const [activeTab, setActiveTab] = useState<"paper" | "citations" | "bibliography">("paper");
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
  };

  const copyToClipboard = () => {
    if (result) navigator.clipboard.writeText(result.content);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Write a Paper</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate a complete academic paper with citations and bibliography</p>
      </div>

      <div className={`grid gap-6 ${result ? "lg:grid-cols-2" : ""}`}>
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Configuration</h2>
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

            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className="text-sm font-medium mb-1.5 block">Length</label>
                <select {...form.register("length")} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="short">Short (~1,000 words)</option>
                  <option value="medium">Medium (~2,500 words)</option>
                  <option value="long">Long (~5,000 words)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Citation Style</label>
              <div className="flex gap-2 flex-wrap">
                {(["apa", "mla", "chicago", "harvard", "ieee"] as const).map((style) => (
                  <label key={style} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" value={style} {...form.register("citationStyle")} className="accent-primary" />
                    <span className="text-sm uppercase font-medium">{style}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...form.register("isStem")} className="accent-primary" />
                <span className="text-sm font-medium">This is a STEM paper (enables advanced scientific tools)</span>
              </label>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Additional Instructions</label>
              <textarea
                {...form.register("additionalInstructions")}
                rows={3}
                placeholder="Any specific requirements, formatting preferences, or key points to cover..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={generatePaper.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {generatePaper.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Generating Paper...</>
              ) : (
                <><Wand2 size={16} /> Generate Paper</>
              )}
            </button>
          </form>
        </div>

        {result && (
          <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex gap-1">
                {(["paper", "citations", "bibliography"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                      activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab} {tab === "citations" && `(${result.citations.length})`}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={copyToClipboard} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
              {activeTab === "paper" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <BookMarked size={12} />
                      <span>{result.wordCount.toLocaleString()} words</span>
                      <span>·</span>
                      <span>{result.citations.length} citations</span>
                    </div>
                  </div>
                  <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {result.content}
                  </div>
                </div>
              )}
              {activeTab === "citations" && (
                <div className="space-y-3">
                  {result.citations.map((citation, i) => (
                    <div key={citation.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground mb-1">[{i + 1}]</div>
                      <div className="text-sm font-medium">{citation.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{citation.authors} · {citation.year} · {citation.source}</div>
                      {citation.url && (
                        <a href={citation.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 block">
                          {citation.url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {activeTab === "bibliography" && (
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-mono">
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
