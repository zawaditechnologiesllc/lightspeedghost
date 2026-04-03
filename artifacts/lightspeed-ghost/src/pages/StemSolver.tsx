import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSolveStem, useGetStemSubjects } from "@workspace/api-client-react";
import { Loader2, FlaskConical, CheckCircle, BookOpen, Wrench, ExternalLink, Search, ChevronDown, ChevronUp } from "lucide-react";
import type { StemSolution } from "@workspace/api-client-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { stemResourcesBySubject, toolTypeColors } from "@/data/stemResources";

const schema = z.object({
  problem: z.string().min(5, "Please describe your problem"),
  subject: z.enum(["mathematics", "physics", "chemistry", "biology", "engineering", "computer_science", "statistics"]),
  showSteps: z.boolean().optional(),
  generateGraph: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

interface Paper {
  paperId: string;
  title: string;
  authors: string;
  year: number | null;
  abstract: string | null;
  url: string | null;
  citationCount: number;
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function searchPapers(query: string, subject: string): Promise<Paper[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/stem/papers?q=${encodeURIComponent(query)}&subject=${encodeURIComponent(subject)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.papers ?? [];
  } catch {
    return [];
  }
}

export default function StemSolver() {
  const [result, setResult] = useState<StemSolution | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [papersLoading, setPapersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"solution" | "resources">("solution");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const solveStem = useSolveStem();
  const { data: subjects } = useGetStemSubjects();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: "mathematics",
      showSteps: true,
      generateGraph: false,
    },
  });

  const selectedSubject = form.watch("subject");
  const resources = stemResourcesBySubject[selectedSubject] ?? [];

  const onSubmit = async (data: FormData) => {
    const [res] = await Promise.all([
      solveStem.mutateAsync(data),
    ]);
    setResult(res);
    setActiveTab("solution");

    setPapersLoading(true);
    const foundPapers = await searchPapers(data.problem.slice(0, 100), data.subject);
    setPapers(foundPapers);
    setPapersLoading(false);
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">STEM Solver</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Solve complex STEM problems with step-by-step explanations, visualizations, and real research papers
        </p>
      </div>

      {subjects && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {subjects.subjects.map((sub) => (
            <button
              key={sub.id}
              onClick={() => {
                form.setValue("subject", sub.id as FormData["subject"]);
                setExpandedGroups({});
              }}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all text-center ${
                selectedSubject === sub.id
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50"
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid xl:grid-cols-[420px_1fr] gap-6 items-start">
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Problem *</label>
                <textarea
                  {...form.register("problem")}
                  rows={5}
                  placeholder="Enter your STEM problem here. e.g., 'Find the integral of x·sin(x) dx' or 'Calculate the velocity of a projectile launched at 45° with v₀ = 20 m/s after 2 seconds'"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono leading-relaxed"
                />
                {form.formState.errors.problem && (
                  <p className="text-destructive text-xs mt-1">{form.formState.errors.problem.message}</p>
                )}
              </div>

              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...form.register("showSteps")} className="accent-primary" />
                  <span className="text-sm">Show step-by-step</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...form.register("generateGraph")} className="accent-primary" />
                  <span className="text-sm">Generate graph</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={solveStem.isPending}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {solveStem.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Solving...</>
                ) : (
                  <><FlaskConical size={16} /> Solve Problem</>
                )}
              </button>
            </form>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Wrench size={14} className="text-primary" />
              <span className="text-sm font-semibold">AI Tools for {subjects?.subjects.find(s => s.id === selectedSubject)?.name ?? "STEM"}</span>
            </div>
            <div className="divide-y divide-border">
              {resources.map((group) => {
                const isOpen = expandedGroups[group.label] ?? false;
                return (
                  <div key={group.label}>
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{group.tools.length}</span>
                        {isOpen ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3 space-y-2">
                        {group.tools.map((tool) => (
                          <a
                            key={tool.name}
                            href={tool.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-all group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                                  {tool.name}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${toolTypeColors[tool.type]}`}>
                                  {tool.type}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{tool.description}</p>
                            </div>
                            <ExternalLink size={11} className="text-muted-foreground mt-0.5 shrink-0 group-hover:text-primary" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-2.5 border-t border-border bg-muted/30">
              <p className="text-[10px] text-muted-foreground">
                Source: <a href="https://github.com/zawaditechnologiesllc/awesome-ai-for-science" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">awesome-ai-for-science</a>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {(result || papersLoading) && (
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("solution")}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  activeTab === "solution"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <FlaskConical size={13} /> Solution
                </div>
              </button>
              <button
                onClick={() => setActiveTab("resources")}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  activeTab === "resources"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Search size={13} />
                  Related Papers
                  {papers.length > 0 && (
                    <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {papers.length}
                    </span>
                  )}
                </div>
              </button>
            </div>
          )}

          {result && activeTab === "solution" && (
            <>
              <div className="bg-card border border-primary/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={16} className="text-green-500" />
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Answer</span>
                  <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">{result.subject}</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{result.answer}</p>
              </div>

              {result.graphData && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-sm mb-3">{result.graphData.labels?.title ?? "Visualization"}</h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.graphData.data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="x" tick={{ fontSize: 11 }} label={{ value: result.graphData.labels?.x ?? "x", position: "insideBottom", offset: -2, fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} label={{ value: result.graphData.labels?.y ?? "y", angle: -90, position: "insideLeft", fontSize: 11 }} />
                        <Tooltip contentStyle={{ fontSize: "12px" }} />
                        <Line type="monotone" dataKey="y" stroke="hsl(211 100% 50%)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {result.steps.length > 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-border">
                    <h3 className="font-semibold text-sm">Step-by-Step Solution</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {result.steps.map((step) => (
                      <div key={step.stepNumber} className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-primary-foreground">{step.stepNumber}</span>
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold">{step.description}</div>
                            {step.expression && (
                              <div className="mt-1 px-3 py-1.5 bg-muted rounded font-mono text-xs border border-border">
                                {step.expression}
                              </div>
                            )}
                            <div className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{step.explanation}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "resources" && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <BookOpen size={14} className="text-primary" />
                <span className="text-sm font-semibold">Related Research Papers</span>
                <span className="text-xs text-muted-foreground ml-auto">via Semantic Scholar</span>
              </div>

              {papersLoading && (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Searching Semantic Scholar...</span>
                </div>
              )}

              {!papersLoading && papers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">Solve a problem to find related papers</p>
                </div>
              )}

              {!papersLoading && papers.length > 0 && (
                <div className="divide-y divide-border">
                  {papers.map((paper) => (
                    <div key={paper.paperId} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <a
                            href={paper.url ?? `https://www.semanticscholar.org/paper/${paper.paperId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-foreground hover:text-primary transition-colors leading-tight block"
                          >
                            {paper.title}
                          </a>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {paper.authors && (
                              <span className="text-xs text-muted-foreground">{paper.authors.split(",").slice(0, 3).join(", ")}{paper.authors.split(",").length > 3 ? " et al." : ""}</span>
                            )}
                            {paper.year && (
                              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">{paper.year}</span>
                            )}
                            {paper.citationCount > 0 && (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
                                {paper.citationCount.toLocaleString()} citations
                              </span>
                            )}
                          </div>
                          {paper.abstract && (
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{paper.abstract}</p>
                          )}
                        </div>
                        {paper.url && (
                          <a
                            href={paper.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-all text-muted-foreground"
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-5 py-2.5 border-t border-border bg-muted/30">
                <p className="text-[10px] text-muted-foreground">
                  Papers sourced from <a href="https://www.semanticscholar.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Semantic Scholar</a> (Allen AI) — 200M+ academic papers
                </p>
              </div>
            </div>
          )}

          {!result && !papersLoading && (
            <div className="bg-card border border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-muted-foreground">
              <FlaskConical size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Enter a problem and click Solve</p>
              <p className="text-xs mt-1">Your step-by-step solution will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
