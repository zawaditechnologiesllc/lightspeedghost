import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSolveStem, useGetStemSubjects } from "@workspace/api-client-react";
import {
  FlaskConical, CheckCircle, BookOpen, ExternalLink,
  Search, ChevronDown, ChevronUp, Dna, Sparkles, ShieldCheck,
  AlertTriangle, XCircle, Lightbulb, Copy, CheckCheck, Download,
  Loader2, RotateCcw,
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
function ghsColor(h: string) {
  for (const [key, val] of Object.entries(GHS_HAZARD_COLORS)) {
    if (h.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return "text-muted-foreground border-border bg-muted";
}

function buildSolutionText(result: StemSolution, problem: string): string {
  return [
    `STEM PROBLEM — ${result.subject.toUpperCase()}`,
    "─".repeat(52),
    "",
    "Problem:",
    problem,
    "",
    "Answer:",
    result.answer,
    "",
    ...(result.corrections && result.corrections.length > 0
      ? ["Corrections applied by Critic Agent:", ...result.corrections.map(c => `  • ${c}`), ""]
      : []),
    ...(result.steps.length > 0
      ? ["Step-by-Step Solution:",
        ...result.steps.flatMap(s => [
          `  Step ${s.stepNumber}: ${s.description}`,
          ...(s.expression ? [`    ${s.expression}`] : []),
          `    ${s.explanation}`,
          "",
        ])]
      : []),
  ].join("\n");
}

const SUBJECT_LABELS: Record<string, string> = {
  mathematics: "Mathematics",
  physics: "Physics",
  chemistry: "Chemistry",
  biology: "Biology",
  engineering: "Engineering",
  computer_science: "Computer Sci",
  statistics: "Statistics",
};

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
  const [activeTab, setActiveTab] = useState<"papers" | "biomodels" | "molecule" | "tools">("papers");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [solvedProblem, setSolvedProblem] = useState("");
  const [showInput, setShowInput] = useState(true);

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
    setExpandedSteps({});

    const res = await solveStem.mutateAsync(data);
    setResult(res);
    setActiveTab("papers");
    setShowInput(false);

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

  const handleReset = () => {
    setResult(null);
    setPapers([]);
    setBioModels([]);
    setRecommendations({});
    setSolvedProblem("");
    setExpandedSteps({});
    setShowInput(true);
    form.reset({ subject: selectedSubject, showSteps: true, generateGraph: false });
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

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(buildSolutionText(result, solvedProblem));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([buildSolutionText(result, solvedProblem)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stem-solution-${result.subject}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleStep = (n: number) => setExpandedSteps(p => ({ ...p, [n]: !p[n] }));
  const toggleGroup = (label: string) => setExpandedGroups(p => ({ ...p, [label]: !p[label] }));

  // ── Full-screen solving animation ──────────────────────────────────────────
  if (solveStem.isPending) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <FullscreenLoader
          icon={<FlaskConical size={32} />}
          title="Solving your problem…"
          subtitle="ReAct reasoning loop with Chain-of-Verification"
          steps={[
            "Parsing problem — identifying knowns and unknowns",
            "THOUGHT 1 — understanding problem scope and domain",
            "ACTION 1 — selecting formula / theorem / strategy",
            "OBSERVATION 1 — setting up equations",
            "THOUGHT 2 — executing calculation with full LaTeX",
            "Critic Agent verifying solution for errors (CoVe)",
            "Applying corrections if needed",
            "Building step-by-step explanation",
          ]}
          stepInterval={1100}
        />
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <FlaskConical size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">STEM Solver</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">ReAct · Chain-of-Verification · Claude Sonnet</p>
            </div>
          </div>
          {result && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
            >
              <RotateCcw size={12} /> New problem
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          {/* ── Subject pills ──────────────────────────────────────────── */}
          {subjects && (
            <div className="flex flex-wrap gap-2 justify-center">
              {subjects.subjects.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => {
                    form.setValue("subject", sub.id as FormData["subject"]);
                    setExpandedGroups({});
                  }}
                  className={cn(
                    "px-4 py-1.5 rounded-full border text-xs font-semibold transition-all",
                    selectedSubject === sub.id
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
                      : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {SUBJECT_LABELS[sub.id] ?? sub.name}
                </button>
              ))}
            </div>
          )}

          {/* ── Input card ─────────────────────────────────────────────── */}
          {(!result || showInput) && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              {/* Upload row */}
              <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                <div className="flex-1">
                  <StemImageOcr onExtracted={handleStemImageOcr} />
                </div>
                <div className="flex-1">
                  <FileUploadZone
                    onExtracted={handleStemFileExtracted}
                    accept=".pdf,.docx,.doc,.txt"
                    label="Upload problem"
                    hint="PDF or Word"
                    compact
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="mx-4 border-t border-border" />

              {/* Textarea */}
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <textarea
                  {...form.register("problem")}
                  rows={4}
                  placeholder={`Type your ${SUBJECT_LABELS[selectedSubject] ?? "STEM"} problem here…\ne.g. Find the integral of x·sin(x) dx`}
                  className="w-full px-4 py-3 bg-transparent text-sm focus:outline-none resize-none font-mono leading-relaxed placeholder:text-muted-foreground/50"
                />
                {form.formState.errors.problem && (
                  <p className="text-destructive text-xs px-4 pb-1">{form.formState.errors.problem.message}</p>
                )}

                {/* Options + button row */}
                <div className="flex items-center gap-3 px-4 pb-4 pt-1 border-t border-border">
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <input type="checkbox" {...form.register("showSteps")} className="accent-primary w-3.5 h-3.5" />
                    <span className="text-xs text-muted-foreground">Steps</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <input type="checkbox" {...form.register("generateGraph")} className="accent-primary w-3.5 h-3.5" />
                    <span className="text-xs text-muted-foreground">Graph</span>
                  </label>
                  <button
                    type="submit"
                    className="ml-auto flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-xl font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                  >
                    <FlaskConical size={15} />
                    Solve
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Collapsed input bar (when results exist and input is hidden) */}
          {result && !showInput && (
            <button
              onClick={() => setShowInput(true)}
              className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3 text-left hover:border-primary/40 transition-colors group"
            >
              <FlaskConical size={14} className="text-primary shrink-0" />
              <span className="text-sm text-muted-foreground line-clamp-1 flex-1">{solvedProblem}</span>
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors shrink-0">Edit</span>
            </button>
          )}

          {/* ── Results ────────────────────────────────────────────────── */}
          {result && (
            <div className="space-y-3">

              {/* ── Answer card ── */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                {/* Header strip */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-green-500/5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle size={15} className="text-green-500 shrink-0" />
                    <span className="text-sm font-bold text-foreground">Answer</span>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium capitalize">{result.subject}</span>
                    {result.confidence !== undefined && <ConfidenceBadge confidence={result.confidence} />}
                    {result.passedVerification !== undefined && (
                      result.passedVerification ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-2 py-0.5 rounded-full">
                          <ShieldCheck size={9} /> Verified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={9} /> Corrected
                        </span>
                      )
                    )}
                  </div>
                  {/* Copy + Download */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={handleCopy} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1 transition-colors">
                      {copied ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button onClick={handleDownload} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1 transition-colors">
                      <Download size={11} /> Save
                    </button>
                  </div>
                </div>

                {/* Answer body */}
                <div className="px-5 py-4">
                  <MathRenderer text={result.answer} className="text-base text-foreground leading-relaxed" />
                </div>

                {/* CoVe corrections */}
                {result.corrections && result.corrections.length > 0 && (
                  <div className="mx-5 mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
                    <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      <Lightbulb size={11} />
                      Critic Agent corrected {result.corrections.length} issue{result.corrections.length > 1 ? "s" : ""}:
                    </div>
                    <ul className="space-y-1">
                      {result.corrections.map((c, i) => (
                        <li key={i} className="text-xs text-amber-800 dark:text-amber-300 flex gap-1.5">
                          <span className="shrink-0 text-amber-500">•</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* ── Graph ── */}
              {result.graphData && (
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
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

              {/* ── Steps ── */}
              {result.steps.length > 0 && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                    <h3 className="font-bold text-sm">Step-by-Step Solution</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{result.steps.length} steps</span>
                      <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">ReAct Loop</span>
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {result.steps.map((step) => {
                      const isOpen = expandedSteps[step.stepNumber] ?? true;
                      return (
                        <div key={step.stepNumber}>
                          <button
                            onClick={() => toggleStep(step.stepNumber)}
                            className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
                          >
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-primary-foreground">{step.stepNumber}</span>
                            </div>
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              <span className="text-xs font-semibold text-foreground truncate">{step.description}</span>
                              <StepTypeBadge desc={step.description} />
                            </div>
                            {isOpen ? <ChevronUp size={13} className="text-muted-foreground shrink-0" /> : <ChevronDown size={13} className="text-muted-foreground shrink-0" />}
                          </button>
                          {isOpen && (
                            <div className="px-5 pb-4 pl-14 space-y-2">
                              {step.expression && (
                                <div className="px-3 py-2.5 bg-muted/60 rounded-xl border border-border">
                                  <MathRenderer text={step.expression} className="text-sm font-mono" />
                                </div>
                              )}
                              <MathRenderer text={step.explanation} className="text-sm text-muted-foreground leading-relaxed" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Extra tabs: Papers / BioModels / Molecule / AI Tools ── */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                {/* Tab row */}
                <div className="flex border-b border-border overflow-x-auto">
                  {(
                    [
                      { key: "papers", label: "Papers", icon: <Search size={12} />, badge: papersLoading ? "…" : papers.length > 0 ? String(papers.length) : null },
                      ...(selectedSubject === "biology" || selectedSubject === "chemistry"
                        ? [{ key: "biomodels", label: "BioModels", icon: <Dna size={12} />, badge: bioModelsLoading ? "…" : bioModels.length > 0 ? String(bioModels.length) : null }]
                        : []),
                      ...(selectedSubject === "chemistry"
                        ? [{ key: "molecule", label: "Molecule", icon: <FlaskConical size={12} />, badge: null }]
                        : []),
                      { key: "tools", label: "AI Tools", icon: <Sparkles size={12} />, badge: null },
                    ] as Array<{ key: string; label: string; icon: React.ReactNode; badge: string | null }>
                  ).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as typeof activeTab)}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all shrink-0",
                        activeTab === tab.key
                          ? "border-primary text-primary bg-primary/5"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                      {tab.badge && (
                        <span className="bg-primary/15 text-primary text-[9px] px-1.5 py-0.5 rounded-full font-bold">{tab.badge}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Papers */}
                {activeTab === "papers" && (
                  <div>
                    {papersLoading && (
                      <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                        <Loader2 size={15} className="animate-spin" />
                        <span className="text-sm">Searching Semantic Scholar…</span>
                      </div>
                    )}
                    {!papersLoading && papers.length === 0 && (
                      <div className="flex flex-col items-center py-10 text-muted-foreground/40">
                        <Search size={32} className="mb-2" />
                        <p className="text-sm">No papers found</p>
                      </div>
                    )}
                    {!papersLoading && papers.length > 0 && (
                      <div className="divide-y divide-border">
                        {papers.map((paper) => (
                          <div key={paper.paperId} className="px-5 py-4 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <a href={paper.url ?? `https://www.semanticscholar.org/paper/${paper.paperId}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-sm font-semibold text-foreground hover:text-primary transition-colors leading-snug block">
                                  {paper.title}
                                </a>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {paper.authors && (
                                    <span className="text-xs text-muted-foreground">{paper.authors.split(",").slice(0, 2).join(", ")}{paper.authors.split(",").length > 2 ? " et al." : ""}</span>
                                  )}
                                  {paper.year && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">{paper.year}</span>}
                                  {paper.citationCount > 0 && (
                                    <span className="text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
                                      {paper.citationCount.toLocaleString()} cites
                                    </span>
                                  )}
                                </div>
                                {paper.abstract && (
                                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{paper.abstract}</p>
                                )}
                              </div>
                              {paper.url && (
                                <a href={paper.url} target="_blank" rel="noopener noreferrer"
                                  className="shrink-0 p-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-all text-muted-foreground">
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                            <button
                              onClick={() => handleGetRecommendations(paper.paperId)}
                              disabled={!!recommendations[paper.paperId] || recommendingFor === paper.paperId}
                              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary border border-border hover:border-primary/40 px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                            >
                              {recommendingFor === paper.paperId ? (
                                <><Loader2 size={10} className="animate-spin" /> Finding similar…</>
                              ) : recommendations[paper.paperId] ? (
                                <><Sparkles size={10} className="text-primary" /> {recommendations[paper.paperId].length} similar shown</>
                              ) : (
                                <><Sparkles size={10} /> Find similar papers</>
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
                                      {rec.citationCount > 0 && <span className="text-[10px] text-muted-foreground">· {rec.citationCount.toLocaleString()} cites</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="px-5 py-2.5 border-t border-border bg-muted/20">
                      <p className="text-[10px] text-muted-foreground">
                        <a href="https://www.semanticscholar.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Semantic Scholar</a> (Allen AI) · Talk2Scholars pattern
                      </p>
                    </div>
                  </div>
                )}

                {/* BioModels */}
                {activeTab === "biomodels" && (
                  <div>
                    {bioModelsLoading && (
                      <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                        <Loader2 size={15} className="animate-spin" />
                        <span className="text-sm">Searching EBI BioModels…</span>
                      </div>
                    )}
                    {!bioModelsLoading && bioModels.length === 0 && (
                      <div className="flex flex-col items-center py-10 text-muted-foreground/40">
                        <Dna size={32} className="mb-2" />
                        <p className="text-sm">No curated models found</p>
                      </div>
                    )}
                    {!bioModelsLoading && bioModels.length > 0 && (
                      <>
                        {bioModelsTotal > 0 && (
                          <div className="px-5 py-2 border-b border-border bg-muted/20">
                            <span className="text-xs text-muted-foreground">{bioModelsTotal.toLocaleString()} total matches — showing top {bioModels.length}</span>
                          </div>
                        )}
                        <div className="divide-y divide-border">
                          {bioModels.map((model) => (
                            <div key={model.id} className="px-5 py-4 flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <a href={model.url} target="_blank" rel="noopener noreferrer"
                                  className="text-sm font-semibold text-foreground hover:text-primary transition-colors block">{model.name}</a>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono font-medium">{model.id}</span>
                                  <span className="text-[10px] bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded font-medium">{model.format}</span>
                                  {model.publicationCount > 0 && (
                                    <span className="text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">{model.publicationCount} pub{model.publicationCount > 1 ? "s" : ""}</span>
                                  )}
                                </div>
                                {model.description && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{model.description}</p>}
                              </div>
                              <a href={model.url} target="_blank" rel="noopener noreferrer"
                                className="shrink-0 p-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-all text-muted-foreground">
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="px-5 py-2.5 border-t border-border bg-muted/20">
                      <p className="text-[10px] text-muted-foreground">
                        <a href="https://www.ebi.ac.uk/biomodels/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">EBI BioModels</a> (EMBL-EBI) · Talk2BioModels pattern
                      </p>
                    </div>
                  </div>
                )}

                {/* Molecule */}
                {activeTab === "molecule" && selectedSubject === "chemistry" && (
                  <div>
                    <div className="px-5 py-4">
                      <form onSubmit={handleMoleculeLookup} className="flex gap-2">
                        <input
                          value={moleculeQuery}
                          onChange={(e) => setMoleculeQuery(e.target.value)}
                          placeholder="Molecule name or SMILES (e.g. aspirin, caffeine)"
                          className="flex-1 px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                        />
                        <button type="submit" disabled={moleculeLoading || !moleculeQuery.trim()}
                          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-50">
                          {moleculeLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                          Lookup
                        </button>
                      </form>
                    </div>
                    {moleculeError && (
                      <div className="px-5 pb-4">
                        <p className="text-sm text-destructive">{moleculeError}</p>
                        <p className="text-xs text-muted-foreground mt-1">Try a common name or a valid SMILES string</p>
                      </div>
                    )}
                    {moleculeData && !moleculeLoading && (
                      <div className="border-t border-border px-5 py-4 space-y-4">
                        <div>
                          <h3 className="text-base font-bold">{moleculeData.commonName ?? moleculeData.iupacName ?? `CID ${moleculeData.cid}`}</h3>
                          {moleculeData.iupacName && moleculeData.commonName && <p className="text-xs text-muted-foreground mt-0.5">{moleculeData.iupacName}</p>}
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {moleculeData.casNumber && <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-mono font-medium">CAS {moleculeData.casNumber}</span>}
                            {moleculeData.formula && <span className="text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded font-mono font-medium">{moleculeData.formula}</span>}
                            <a href={moleculeData.pubchemUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                              PubChem CID {moleculeData.cid} <ExternalLink size={9} />
                            </a>
                          </div>
                        </div>
                        {moleculeData.smiles && (
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">SMILES</label>
                            <div className="px-3 py-2 bg-muted rounded-xl font-mono text-xs border border-border break-all select-all">{moleculeData.smiles}</div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {[
                            { label: "Mol. Weight", val: moleculeData.molecularWeight != null ? `${moleculeData.molecularWeight} g/mol` : null },
                            { label: "XLogP", val: moleculeData.xLogP != null ? String(moleculeData.xLogP) : null },
                            { label: "H-Bond Donors", val: moleculeData.hBondDonors != null ? String(moleculeData.hBondDonors) : null },
                            { label: "H-Bond Acceptors", val: moleculeData.hBondAcceptors != null ? String(moleculeData.hBondAcceptors) : null },
                            { label: "Rotatable Bonds", val: moleculeData.rotatableBonds != null ? String(moleculeData.rotatableBonds) : null },
                            { label: "TPSA (Å²)", val: moleculeData.tpsa != null ? String(moleculeData.tpsa) : null },
                          ].filter(d => d.val != null).map(d => (
                            <div key={d.label} className="bg-muted/40 rounded-xl p-3 border border-border">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{d.label}</div>
                              <div className="text-sm font-bold mt-0.5">{d.val}</div>
                            </div>
                          ))}
                        </div>
                        {moleculeData.ghsHazards.length > 0 && (
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">GHS Safety</label>
                            <div className="flex flex-wrap gap-1.5">
                              {moleculeData.ghsHazards.map(h => (
                                <span key={h} className={`text-[11px] px-2 py-0.5 rounded border font-medium ${ghsColor(h)}`}>{h}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {moleculeData.synonyms.length > 0 && (
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Known Names</label>
                            <div className="flex flex-wrap gap-1.5">
                              {moleculeData.synonyms.map(s => (
                                <span key={s} className="text-[11px] px-2 py-0.5 bg-muted text-muted-foreground rounded border border-border">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground border-t border-border pt-2">
                          Data from <a href="https://pubchem.ncbi.nlm.nih.gov/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PubChem</a> · <a href="https://github.com/zawaditechnologiesllc/chemcrow-public" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ChemCrow</a> pattern
                        </p>
                      </div>
                    )}
                    {!moleculeData && !moleculeLoading && !moleculeError && (
                      <div className="flex flex-col items-center py-8 text-muted-foreground/40 border-t border-border">
                        <FlaskConical size={28} className="mb-2" />
                        <p className="text-sm">Try: aspirin, caffeine, glucose, ethanol</p>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Tools */}
                {activeTab === "tools" && (
                  <div className="divide-y divide-border">
                    {resources.length === 0 ? (
                      <div className="px-5 py-8 text-center text-muted-foreground/40 text-sm">No tools for this subject</div>
                    ) : resources.map((group) => {
                      const isOpen = expandedGroups[group.label] ?? false;
                      return (
                        <div key={group.label}>
                          <button onClick={() => toggleGroup(group.label)}
                            className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-muted/30 transition-colors">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.label}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">{group.tools.length}</span>
                              {isOpen ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                            </div>
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-3 space-y-2">
                              {group.tools.map((tool) => (
                                <a key={tool.name} href={tool.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/40 transition-all group">
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
                    <div className="px-5 py-2.5 bg-muted/20">
                      <p className="text-[10px] text-muted-foreground">
                        Source: <a href="https://github.com/zawaditechnologiesllc/awesome-ai-for-science" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">awesome-ai-for-science</a>
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── Empty state ─────────────────────────────────────────────── */}
          {!result && (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground/30">
              <FlaskConical size={36} />
              <p className="text-sm font-medium">Enter a problem above to get started</p>
            </div>
          )}

          {/* Bottom padding */}
          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  if (pct >= 85) return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-2 py-0.5 rounded-full">
      <CheckCircle size={9} /> {pct}%
    </span>
  );
  if (pct >= 65) return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
      <AlertTriangle size={9} /> {pct}%
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full">
      <XCircle size={9} /> {pct}%
    </span>
  );
}

function StepTypeBadge({ desc }: { desc: string }) {
  const lower = desc.toLowerCase();
  if (lower.includes("observe") || lower.includes("observation"))
    return <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 shrink-0">Observe</span>;
  if (lower.includes("think") || lower.includes("thought") || lower.includes("reason"))
    return <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">Thought</span>;
  if (lower.includes("act") || lower.includes("action") || lower.includes("compute") || lower.includes("calculat"))
    return <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0">Action</span>;
  if (lower.includes("final") || lower.includes("answer") || lower.includes("result"))
    return <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 shrink-0">Final</span>;
  return null;
}
