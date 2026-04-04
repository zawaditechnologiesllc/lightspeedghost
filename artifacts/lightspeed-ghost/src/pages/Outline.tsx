import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGenerateOutline } from "@workspace/api-client-react";
import { Loader2, ListTree, ChevronRight, Copy, CheckCheck, PenLine, ChevronDown } from "lucide-react";
import type { GeneratedOutline } from "@workspace/api-client-react";
import { Link } from "wouter";

const schema = z.object({
  topic: z.string().min(5, "Topic must be at least 5 characters"),
  subject: z.string().min(2, "Subject is required"),
  paperType: z.enum(["research", "essay", "thesis", "literature_review", "report"]),
});

type FormData = z.infer<typeof schema>;

const PAPER_TYPE_LABELS: Record<string, string> = {
  research: "Research Paper",
  essay: "Essay",
  thesis: "Thesis",
  literature_review: "Literature Review",
  report: "Report",
};

export default function Outline() {
  const [result, setResult] = useState<GeneratedOutline | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const generateOutline = useGenerateOutline();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { paperType: "research" },
  });

  const onSubmit = async (data: FormData) => {
    const res = await generateOutline.mutateAsync(data);
    setResult(res);
    // Expand all sections by default
    setExpandedSections(new Set(res.sections.map((_, i) => i)));
  };

  const toggleSection = (i: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
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
    setTimeout(() => setCopied(false), 2000);
  };

  const sectionColors = [
    "border-l-blue-500 bg-blue-500/5",
    "border-l-indigo-500 bg-indigo-500/5",
    "border-l-violet-500 bg-violet-500/5",
    "border-l-cyan-500 bg-cyan-500/5",
    "border-l-sky-500 bg-sky-500/5",
    "border-l-purple-500 bg-purple-500/5",
    "border-l-blue-400 bg-blue-400/5",
    "border-l-indigo-400 bg-indigo-400/5",
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Outline Generator</h1>
        <p className="text-muted-foreground text-sm mt-1">Structure your paper before writing — then generate it with one click</p>
      </div>

      <div className={`grid gap-6 ${result ? "lg:grid-cols-[380px_1fr]" : "max-w-xl"}`}>
        {/* Form */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <ListTree size={14} />
            Configuration
          </h2>
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
              {form.formState.errors.subject && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.subject.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Paper Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(["research", "essay", "thesis", "literature_review", "report"] as const).map((type) => {
                  const watched = form.watch("paperType");
                  return (
                    <label
                      key={type}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-all ${
                        watched === type
                          ? "border-primary bg-primary/5 text-primary font-medium"
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

        {/* Outline result */}
        {result && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
                <div>
                  <h2 className="font-bold text-sm">{result.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{result.sections.length} sections</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyOutline}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    {copied ? <CheckCheck size={12} className="text-green-500" /> : <Copy size={12} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="divide-y divide-border">
                {result.sections.map((section, i) => {
                  const isExpanded = expandedSections.has(i);
                  const colorClass = sectionColors[i % sectionColors.length];
                  return (
                    <div key={i}>
                      <button
                        onClick={() => toggleSection(i)}
                        className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold border-l-2 shrink-0 ${colorClass}`}>
                            {i + 1}
                          </div>
                          <span className="text-sm font-semibold flex-1 text-foreground">{section.heading}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {section.subsections.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">{section.subsections.length} sections</span>
                            )}
                            {isExpanded
                              ? <ChevronDown size={14} className="text-muted-foreground" />
                              : <ChevronRight size={14} className="text-muted-foreground" />}
                          </div>
                        </div>
                      </button>

                      {isExpanded && section.subsections.length > 0 && (
                        <div className="px-4 pb-3 space-y-1 bg-muted/10">
                          {section.subsections.map((sub, j) => (
                            <div key={j} className="flex items-start gap-2 py-1">
                              <span className="text-[10px] text-primary font-mono mt-0.5 shrink-0 w-8">
                                {i + 1}.{j + 1}
                              </span>
                              <ChevronRight size={11} className="text-primary/60 mt-0.5 shrink-0" />
                              <span className="text-sm text-muted-foreground">{sub}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CTA to write the paper */}
            <Link href={`/write?topic=${encodeURIComponent(form.getValues("topic"))}&subject=${encodeURIComponent(form.getValues("subject"))}&type=${form.getValues("paperType")}`}>
              <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-5 py-4 hover:bg-primary/10 transition-colors cursor-pointer group">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <PenLine size={15} className="text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-primary">Write this paper</div>
                  <div className="text-xs text-muted-foreground">Generate the full paper using this outline structure</div>
                </div>
                <ChevronRight size={16} className="text-primary group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
