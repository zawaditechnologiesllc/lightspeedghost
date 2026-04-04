import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSolveStem, useGetStemSubjects } from "@workspace/api-client-react";
import {
  Loader2, FlaskConical, CheckCircle, BookOpen, Wrench, ExternalLink,
  Search, ChevronDown, ChevronUp, Dna, Sparkles, ShieldCheck, AlertTriangle,
  XCircle, Lightbulb, Copy, CheckCheck, Download,
} from "lucide-react";
import type { StemSolution } from "@workspace/api-client-react";
import FileUploadZone, { type ExtractedFile } from "@/components/FileUploadZone";
import StemImageOcr from "@/components/StemImageOcr";
import MathRenderer from "@/components/MathRenderer";
import FullscreenLoader from "@/components/FullscreenLoader";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { stemResourcesBySubject, toolTypeColors } from "@/data/stemResources";
import { cn } from "@/lib/utils";

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

interface BioModel {
  id: string;
  name: string;
  description: string | null;
  lastModified: string | null;
  publicationCount: number;
  format: string;
  url: string;
}

interface MoleculeData {
  cid: number;
  iupacName: string | null;
  commonName: string | null;
  casNumber: string | null;
  smiles: string | null;
  formula: string | null;
  molecularWeight: number | null;
  xLogP: number | null;
  hBondDonors: number | null;
  hBondAcceptors: number | null;
  rotatableBonds: number | null;
  tpsa: number | null;
  ghsHazards: string[];
  pubchemUrl: string;
  synonyms: string[];
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function searchPapers(query: string, subject: string): Promise<Paper[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/stem/papers?q=${encodeURIComponent(query)}&subject=${encodeURIComponent(subject)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.papers ?? [];
  } catch { return []; }
}

async function searchBioModels(query: string): Promise<{ models: BioModel[]; total: number }> {
  try {
    const res = await fetch(`${BASE_URL}/api/stem/biomodels?q=${encodeURIComponent(query)}`);
    if (!res.ok) return { models: [], total: 0 };
    return await res.json();
  } catch { return { models: [], total: 0 }; }
}

async function getPaperRecommendations(paperId: string): Promise<Paper[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/stem/papers/recommend?paperId=${encodeURIComponent(paperId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.papers ?? [];
  } catch { return []; }
}

async function lookupMolecule(query: string): Promise<MoleculeData | { error: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/stem/molecule?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Molecule not found" };
    return data as MoleculeData;
  } catch { return { error: "Request failed. Check your connection." }; }
}

const GHS_HAZARD_COLORS: Record<string, string> = {
  "Flammable": "text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/40",
  "Toxic": "text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40",
  "Health Hazard": "text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/40",
  "Corrosive": "text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/40",
  "Irritant": "text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40",
  "Environmental Hazard": "text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40",
};
function ghsColor(hazard: string) {
  for (const [key, val] of Object.entries(GHS_HAZARD_COLORS)) {
    if (hazard.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return "text-muted-foreground border-border bg-muted";
}

function buildSolutionText(result: StemSolution, problem: string): string {
  const lines: string[] = [
    `STEM PROBLEM — ${result.subject.toUpperCase()}`,
    `${"─".repeat(50)}`,
    "",
    `Problem:`,
    problem,
    "",
    `Answer:`,
    result.answer,
    "",
  ];
  if (result.corrections && result.corrections.length > 0) {
    lines.push("Corrections applied by Critic Agent:");
    result.corrections.forEach((c) => lines.push(`  • ${c}`));
    lines.push("");
  }
  if (result.steps.length > 0) {
    lines.push("Step-by-Step Solution:");
    result.steps.forEach((s) => {
      lines.push(`  Step ${s.stepNumber}: ${s.description}`);
      if (s.expression) lines.push(`    ${s.expression}`);
      lines.push(`    ${s.explanation}`);
      lines.push("");
    });
  }
  return lines.join("\n");
}

export default function StemSolver() {
  const [result, setResult] = useState<StemSolution | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [papersLoading, setPapersLoading] = useState(false);
  const [bioModels, setBioModels] = useState<BioModel[]>([]);
  const [bioModelsTotal, setBioModelsTotal] = useState(0);
  const [bioModelsLoading, setBioModelsLoading] = useState(false);
  const [recommendingFor, setRecommendingFor] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Record<string, Paper[]>>({});
  const [moleculeQuery, setMoleculeQuery] = useState("");
  const [moleculeData, setMoleculeData] = useState<MoleculeData | null>(null);
  const [moleculeError, setMoleculeError] = useState<string | null>(null);
  const [moleculeLoading, setMoleculeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"solution" | "papers" | "biomodels" | "molecule">("solution");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [solvedProblem, setSolvedProblem] = useState("");

  const solveStem = useSolveStem();
  const { data: subjects } = useGetStemSubjects();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { subject: "mathematics", showSteps: true, generateGraph: false },
  });

  const selectedSubject = form.watch("subject");
  const resources = stemResourcesBySubject[selectedSubject] ?? [];

  const handleStemFileExtracted = (file: ExtractedFile) => {
    const cleaned = file.text
      .replace(/^(name|student|date|course|class|professor|instructor|due\s*date)[\s:].*/gim, "")
      .replace(/^\s*page\s+\d+\s*$/gim, "")
      .trim();
    form.setValue("problem", cleaned.slice(0, 1000));
  };

  const handleStemImageOcr = (text: string) => {
    form.setValue("problem", text.slice(0, 1000));
  };

  const onSubmit = async (data: FormData) => {
    setPapers([]);
    setBioModels([]);
    setRecommendations({});
    setSolvedProblem(data.problem);
    const res = await solveStem.mutateAsync(data);
    setResult(res);
    setActiveTab("solution");

    setPapersLoading(true);
    const foundPapers = await searchPapers(data.problem.slice(0, 100), data.subject);
    setPapers(foundPapers);
    setPapersLoading(false);

    if (data.subject === "biology" || data.subject === "chemistry") {
      setBioModelsLoading(true);
      const bioResult = await searchBioModels(data.problem.slice(0, 80));
      setBioModels(bioResult.models);
      setBioModelsTotal(bioResult.total);
      setBioModelsLoading(false);
    }
  };

  const handleGetRecommendations = async (paperId: string) => {
    if (recommendations[paperId] || recommendingFor === paperId) return;
    setRecommendingFor(paperId);
    const recs = await getPaperRecommendations(paperId);
    setRecommendations((prev) => ({ ...prev, [paperId]: recs }));
    setRecommendingFor(null);
  };

  const handleMoleculeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moleculeQuery.trim()) return;
    setMoleculeLoading(true);
    setMoleculeData(null);
    setMoleculeError(null);
    const res = await lookupMolecule(moleculeQuery.trim());
    if ("error" in res) setMoleculeError(res.error);
    else setMoleculeData(res);
    setMoleculeLoading(false);
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(buildSolutionText(result, solvedProblem));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const text = buildSolutionText(result, solvedProblem);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stem-solution-${result.subject}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TAB_BTN = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
    }`;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <FlaskConical size={16} className="text-primary" />
          <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-center">STEM Solver</h1>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          ReAct loop · Chain-of-Verification · Step-by-step solutions
        </p>
        {subjects && (
          <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
            {subjects.subjects.map((sub) => (
              <button
                key={sub.id}
                onClick={() => { form.setValue("subject", sub.id as FormData["subject"]); setExpandedGroups({}); }}
                className={cn(
                  "px-3 py-1 rounded-full border text-xs font-medium transition-all",
                  selectedSubject === sub.id
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/50"
                )}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {solveStem.isPending ? (
        <FullscreenLoader
          icon={<FlaskConical size={32} />}
          title="Solving your problem…"
          subtitle="ReAct reasoning loop with Chain-of-Verification running"
          steps={[
            "Parsing problem — identifying knowns and unknowns",
            "THOUGHT 1 — understanding problem scope and domain",
            "ACTION 1 — selecting formula / theorem / strategy",
            "OBSERVATION 1 — setting up equations and working",
            "THOUGHT 2 — executing calculation with full LaTeX",
            "Critic Agent verifying solution for errors (CoVe)",
            "Applying corrections if needed — finalising answer",
            "Building step-by-step explanation",
          ]}
          stepInterval={1100}
        />
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* ── Left: Form panel ───────────────────────────────────────── */}
          <div className={cn(
            "flex flex-col overflow-y-auto shrink-0 border-r border-border bg-card/50",
            result ? "w-[320px]" : "w-full max-w-xl mx-auto border-r-0"
          )}>

            {/* Collapsed problem summary */}
            {result && (
              <div className="px-4 py-3 border-b border-border bg-muted/20 shrink-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Problem solved</p>
                <p className="text-xs text-foreground leading-relaxed line-clamp-3">{solvedProblem}</p>
                <span className="inline-block mt-1.5 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">{result.subject}</span>
              </div>
            )}

            <div className="flex-1 px-5 py-5 space-y-4">
              {!result && (
                <div className="space-y-1">
                  <h2 className="font-bold text-base">Enter your problem</h2>
                  <p className="text-xs text-muted-foreground">Supports LaTeX notation — upload a photo or PDF, or paste directly</p>
                </div>
              )}

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <StemImageOcr onExtracted={handleStemImageOcr} />
                  <FileUploadZone
                    onExtracted={handleStemFileExtracted}
                    accept=".pdf,.docx,.doc,.txt"
                    label="Or upload a text problem"
                    hint="PDF or Word homework sheet → auto-fills problem"
                    compact
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Problem *</label>
                  <textarea
                    {...form.register("problem")}
                    rows={result ? 6 : 7}
                    placeholder="e.g. Find the integral of x·sin(x) dx"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono leading-relaxed"
                  />
                  {form.formState.errors.problem && (
                    <p className="text-destructive text-xs mt-1">{form.formState.errors.problem.message}</p>
                  )}
                </div>

                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...form.register("showSteps")} className="accent-primary" />
                    <span className="text-xs text-muted-foreground">Step-by-step</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...form.register("generateGraph")} className="accent-primary" />
                    <span className="text-xs text-muted-foreground">Generate graph</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
                >
                  <FlaskConical size={15} /> {result ? "Re-solve" : "Solve Problem"}
                </button>
              </form>

              {/* AI Tools — compact when sidebar */}
              {result ? (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                    <Wrench size={13} className="text-primary" />
                    <span className="text-xs font-semibold">AI Tools</span>
                  </div>
                  <div className="divide-y divide-border">
                    {resources.map((group) => {
                      const isOpen = expandedGroups[group.label] ?? false;
                      return (
                        <div key={group.label}>
                          <button
                            onClick={() => toggleGroup(group.label)}
                            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{group.label}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">{group.tools.length}</span>
                              {isOpen ? <ChevronUp size={11} className="text-muted-foreground" /> : <ChevronDown size={11} className="text-muted-foreground" />}
                            </div>
                          </button>
                          {isOpen && (
                            <div className="px-3 pb-2.5 space-y-1.5">
                              {group.tools.map((tool) => (
                                <a
                                  key={tool.name}
                                  href={tool.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-start gap-2 p-2 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-all group"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="text-[11px] font-semibold text-foreground group-hover:text-primary transition-colors">{tool.name}</span>
                                      <span className={`text-[9px] px-1 py-0.5 rounded border font-medium ${toolTypeColors[tool.type]}`}>{tool.type}</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{tool.description}</p>
                                  </div>
                                  <ExternalLink size={10} className="text-muted-foreground mt-0.5 shrink-0 group-hover:text-primary" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
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
                                      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{tool.name}</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${toolTypeColors[tool.type]}`}>{tool.type}</span>
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
              )}
            </div>
          </div>

          {/* ── Right: Results or empty state ──────────────────────────── */}
          {result ? (
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

              {/* Results header: tabs + copy/download */}
              <div className="shrink-0 border-b border-border bg-card/30 px-5 py-2.5 flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  <button onClick={() => setActiveTab("solution")} className={TAB_BTN(activeTab === "solution")}>
                    <FlaskConical size={12} /> Solution
                  </button>
                  <button onClick={() => setActiveTab("papers")} className={TAB_BTN(activeTab === "papers")}>
                    <Search size={12} />
                    Related Papers
                    {papersLoading
                      ? <Loader2 size={10} className="animate-spin" />
                      : papers.length > 0 && (
                        <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded-full font-bold">{papers.length}</span>
                      )}
                  </button>
                  {(selectedSubject === "biology" || selectedSubject === "chemistry") && (
                    <button onClick={() => setActiveTab("biomodels")} className={TAB_BTN(activeTab === "biomodels")}>
                      <Dna size={12} />
                      EBI BioModels
                      {bioModelsLoading
                        ? <Loader2 size={10} className="animate-spin" />
                        : bioModels.length > 0 && (
                          <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded-full font-bold">{bioModels.length}</span>
                        )}
                    </button>
                  )}
                  {selectedSubject === "chemistry" && (
                    <button onClick={() => setActiveTab("molecule")} className={TAB_BTN(activeTab === "molecule")}>
                      <FlaskConical size={12} /> Molecule Lookup
                    </button>
                  )}
                </div>

                {/* Copy + Download */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    {copied ? <CheckCheck size={12} className="text-green-500" /> : <Copy size={12} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              </div>

              {/* Scrollable results content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                {/* ── SOLUTION TAB ── */}
                {activeTab === "solution" && (
                  <>
                    {/* Answer card with badges */}
                    <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CheckCircle size={15} className="text-green-500 shrink-0" />
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Answer</span>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">{result.subject}</span>

                        {result.confidence !== undefined && (
                          <ConfidenceBadge confidence={result.confidence} />
                        )}

                        {result.passedVerification !== undefined && (
                          result.passedVerification ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-2 py-0.5 rounded-full">
                              <ShieldCheck size={10} /> Chain-of-Verification Passed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                              <AlertTriangle size={10} /> Corrected by Critic Agent
                            </span>
                          )
                        )}
                      </div>

                      <MathRenderer text={result.answer} className="text-sm text-foreground" />

                      {result.corrections && result.corrections.length > 0 && (
                        <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
                          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                            <Lightbulb size={11} />
                            Critic Agent found and corrected {result.corrections.length} issue{result.corrections.length > 1 ? "s" : ""}:
                          </div>
                          <ul className="space-y-1">
                            {result.corrections.map((c, i) => (
                              <li key={i} className="text-xs text-amber-800 dark:text-amber-300 flex gap-1.5">
                                <span className="shrink-0 text-amber-500">•</span>
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
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
                        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                          <h3 className="font-semibold text-sm">Step-by-Step Solution</h3>
                          <span className="text-xs text-muted-foreground">({result.steps.length} steps)</span>
                          <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">ReAct Loop</span>
                        </div>
                        <div className="divide-y divide-border">
                          {result.steps.map((step) => (
                            <div key={step.stepNumber} className="px-5 py-4">
                              <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="text-[10px] font-bold text-primary-foreground">{step.stepNumber}</span>
                                </div>
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-foreground">{step.description}</span>
                                    <StepTypeBadge desc={step.description} />
                                  </div>
                                  {step.expression && (
                                    <div className="px-3 py-2 bg-muted/60 rounded-lg border border-border">
                                      <MathRenderer text={step.expression} className="text-xs font-mono" />
                                    </div>
                                  )}
                                  <MathRenderer text={step.explanation} className="text-xs text-muted-foreground leading-relaxed" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ── PAPERS TAB ── */}
                {activeTab === "papers" && (
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
                        <p className="text-sm">No papers found for this problem</p>
                      </div>
                    )}
                    {!papersLoading && papers.length > 0 && (
                      <div className="divide-y divide-border">
                        {papers.map((paper) => (
                          <div key={paper.paperId} className="px-5 py-4 space-y-2">
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
                                  {paper.year && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">{paper.year}</span>}
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
                                <a href={paper.url} target="_blank" rel="noopener noreferrer"
                                  className="shrink-0 p-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-all text-muted-foreground">
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                            <button
                              onClick={() => handleGetRecommendations(paper.paperId)}
                              disabled={!!recommendations[paper.paperId] || recommendingFor === paper.paperId}
                              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary border border-border hover:border-primary/40 px-2.5 py-1 rounded-md transition-all disabled:opacity-40"
                            >
                              {recommendingFor === paper.paperId ? (
                                <><Loader2 size={10} className="animate-spin" /> Finding similar...</>
                              ) : recommendations[paper.paperId] ? (
                                <><Sparkles size={10} className="text-primary" /> {recommendations[paper.paperId].length} similar papers shown</>
                              ) : (
                                <><Sparkles size={10} /> Get similar papers</>
                              )}
                            </button>
                            {recommendations[paper.paperId] && recommendations[paper.paperId].length > 0 && (
                              <div className="ml-4 border-l-2 border-primary/20 pl-3 space-y-2">
                                {recommendations[paper.paperId].map((rec) => (
                                  <div key={rec.paperId}>
                                    <a href={rec.url ?? `https://www.semanticscholar.org/paper/${rec.paperId}`}
                                      target="_blank" rel="noopener noreferrer"
                                      className="text-xs font-medium text-foreground hover:text-primary transition-colors block">
                                      {rec.title}
                                    </a>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      {rec.year && <span className="text-[10px] text-muted-foreground">{rec.year}</span>}
                                      {rec.citationCount > 0 && <span className="text-[10px] text-muted-foreground">· {rec.citationCount.toLocaleString()} citations</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="px-5 py-2.5 border-t border-border bg-muted/30">
                      <p className="text-[10px] text-muted-foreground">
                        Papers from <a href="https://www.semanticscholar.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Semantic Scholar</a> (Allen AI) · Recommendations inspired by <a href="https://github.com/zawaditechnologiesllc/AIAgents4Pharmabio" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">AIAgents4Pharmabio / Talk2Scholars</a>
                      </p>
                    </div>
                  </div>
                )}

                {/* ── BIOMODELS TAB ── */}
                {activeTab === "biomodels" && (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                      <Dna size={14} className="text-primary" />
                      <span className="text-sm font-semibold">EBI BioModels Database</span>
                      {bioModelsTotal > 0 && <span className="text-xs text-muted-foreground ml-auto">{bioModelsTotal.toLocaleString()} total matches</span>}
                    </div>
                    {bioModelsLoading && (
                      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-sm">Searching EBI BioModels...</span>
                      </div>
                    )}
                    {!bioModelsLoading && bioModels.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Dna size={32} className="mb-2 opacity-30" />
                        <p className="text-sm">No curated models found for this problem</p>
                      </div>
                    )}
                    {!bioModelsLoading && bioModels.length > 0 && (
                      <div className="divide-y divide-border">
                        {bioModels.map((model) => (
                          <div key={model.id} className="px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <a href={model.url} target="_blank" rel="noopener noreferrer"
                                  className="text-sm font-semibold text-foreground hover:text-primary transition-colors block">
                                  {model.name}
                                </a>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium font-mono">{model.id}</span>
                                  <span className="text-[10px] bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded font-medium">{model.format}</span>
                                  {model.publicationCount > 0 && (
                                    <span className="text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
                                      {model.publicationCount} {model.publicationCount === 1 ? "publication" : "publications"}
                                    </span>
                                  )}
                                </div>
                                {model.description && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{model.description}</p>}
                              </div>
                              <a href={model.url} target="_blank" rel="noopener noreferrer"
                                className="shrink-0 p-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-all text-muted-foreground">
                                <ExternalLink size={13} />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="px-5 py-2.5 border-t border-border bg-muted/30">
                      <p className="text-[10px] text-muted-foreground">
                        Curated mathematical models from <a href="https://www.ebi.ac.uk/biomodels/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">EBI BioModels</a> (EMBL-EBI) · Inspired by <a href="https://github.com/zawaditechnologiesllc/AIAgents4Pharmabio" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">AIAgents4Pharmabio / Talk2BioModels</a>
                      </p>
                    </div>
                  </div>
                )}

                {/* ── MOLECULE TAB ── */}
                {activeTab === "molecule" && selectedSubject === "chemistry" && (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                      <FlaskConical size={14} className="text-primary" />
                      <span className="text-sm font-semibold">Molecule Lookup</span>
                      <span className="text-xs text-muted-foreground ml-auto">via PubChem · ChemCrow toolset</span>
                    </div>
                    <div className="px-5 py-4">
                      <form onSubmit={handleMoleculeLookup} className="flex gap-2">
                        <input
                          value={moleculeQuery}
                          onChange={(e) => setMoleculeQuery(e.target.value)}
                          placeholder="Enter molecule name or SMILES (e.g. aspirin, caffeine, CCO)"
                          className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                        />
                        <button
                          type="submit"
                          disabled={moleculeLoading || !moleculeQuery.trim()}
                          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {moleculeLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                          Lookup
                        </button>
                      </form>
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Searches PubChem for SMILES, CAS number, molecular weight, formula, LogP, H-bond data, and GHS safety classification
                      </p>
                    </div>

                    {moleculeLoading && (
                      <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground border-t border-border">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-sm">Querying PubChem...</span>
                      </div>
                    )}
                    {moleculeError && (
                      <div className="px-5 py-4 border-t border-border">
                        <p className="text-sm text-destructive">{moleculeError}</p>
                        <p className="text-xs text-muted-foreground mt-1">Try a common name (e.g. "aspirin") or a valid SMILES string</p>
                      </div>
                    )}
                    {moleculeData && !moleculeLoading && (
                      <div className="border-t border-border">
                        <div className="px-5 py-4 space-y-4">
                          <div>
                            <h3 className="text-base font-bold text-foreground">{moleculeData.commonName ?? moleculeData.iupacName ?? `PubChem CID ${moleculeData.cid}`}</h3>
                            {moleculeData.iupacName && moleculeData.commonName && (
                              <p className="text-xs text-muted-foreground mt-0.5">{moleculeData.iupacName}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {moleculeData.casNumber && (
                                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono font-medium">CAS {moleculeData.casNumber}</span>
                              )}
                              {moleculeData.formula && (
                                <span className="text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded font-mono font-medium">{moleculeData.formula}</span>
                              )}
                              <a href={moleculeData.pubchemUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                                PubChem CID {moleculeData.cid} <ExternalLink size={9} />
                              </a>
                            </div>
                          </div>

                          {moleculeData.smiles && (
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">SMILES</label>
                              <div className="px-3 py-2 bg-muted rounded-lg font-mono text-xs border border-border break-all select-all">{moleculeData.smiles}</div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {moleculeData.molecularWeight != null && (
                              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Mol. Weight</div>
                                <div className="text-sm font-bold mt-0.5">{moleculeData.molecularWeight} g/mol</div>
                              </div>
                            )}
                            {moleculeData.xLogP != null && (
                              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">XLogP</div>
                                <div className="text-sm font-bold mt-0.5">{moleculeData.xLogP}</div>
                              </div>
                            )}
                            {moleculeData.hBondDonors != null && (
                              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">H-Bond Donors</div>
                                <div className="text-sm font-bold mt-0.5">{moleculeData.hBondDonors}</div>
                              </div>
                            )}
                            {moleculeData.hBondAcceptors != null && (
                              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">H-Bond Acceptors</div>
                                <div className="text-sm font-bold mt-0.5">{moleculeData.hBondAcceptors}</div>
                              </div>
                            )}
                            {moleculeData.rotatableBonds != null && (
                              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Rotatable Bonds</div>
                                <div className="text-sm font-bold mt-0.5">{moleculeData.rotatableBonds}</div>
                              </div>
                            )}
                            {moleculeData.tpsa != null && (
                              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">TPSA (Å²)</div>
                                <div className="text-sm font-bold mt-0.5">{moleculeData.tpsa}</div>
                              </div>
                            )}
                          </div>

                          {moleculeData.ghsHazards.length > 0 && (
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">GHS Safety Classification</label>
                              <div className="flex flex-wrap gap-1.5">
                                {moleculeData.ghsHazards.map((h) => (
                                  <span key={h} className={`text-[11px] px-2 py-0.5 rounded border font-medium ${ghsColor(h)}`}>{h}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {moleculeData.synonyms.length > 0 && (
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Known Names</label>
                              <div className="flex flex-wrap gap-1.5">
                                {moleculeData.synonyms.map((s) => (
                                  <span key={s} className="text-[11px] px-2 py-0.5 bg-muted text-muted-foreground rounded border border-border">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="px-5 py-2.5 border-t border-border bg-muted/30">
                          <p className="text-[10px] text-muted-foreground">
                            Data from <a href="https://pubchem.ncbi.nlm.nih.gov/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PubChem</a> (NCBI) · Lookup pipeline from <a href="https://github.com/zawaditechnologiesllc/chemcrow-public" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ChemCrow</a>
                          </p>
                        </div>
                      </div>
                    )}
                    {!moleculeData && !moleculeLoading && !moleculeError && (
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border-t border-border">
                        <FlaskConical size={32} className="mb-2 opacity-30" />
                        <p className="text-sm">Enter a molecule name or SMILES to look it up</p>
                        <p className="text-xs mt-1 text-center max-w-xs">Try: aspirin, caffeine, glucose, ethanol, CC(=O)Oc1ccccc1C(=O)O</p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40">
              <FlaskConical size={44} className="mb-3" />
              <p className="text-sm font-medium text-muted-foreground/60">Enter a problem and click Solve</p>
              <p className="text-xs mt-1">Your step-by-step solution will appear here</p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  if (pct >= 85) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-2 py-0.5 rounded-full">
        <CheckCircle size={9} /> {pct}% Confidence
      </span>
    );
  }
  if (pct >= 65) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
        <AlertTriangle size={9} /> {pct}% Confidence
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full">
      <XCircle size={9} /> {pct}% Confidence
    </span>
  );
}

function StepTypeBadge({ desc }: { desc: string }) {
  const lower = desc.toLowerCase();
  if (lower.includes("observe") || lower.includes("observation")) {
    return <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">Observe</span>;
  }
  if (lower.includes("think") || lower.includes("thought") || lower.includes("reason") || lower.includes("consider")) {
    return <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">Thought</span>;
  }
  if (lower.includes("act") || lower.includes("action") || lower.includes("apply") || lower.includes("compute") || lower.includes("calculat")) {
    return <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">Action</span>;
  }
  if (lower.includes("final") || lower.includes("answer") || lower.includes("result") || lower.includes("conclusion")) {
    return <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400">Final</span>;
  }
  return null;
}
