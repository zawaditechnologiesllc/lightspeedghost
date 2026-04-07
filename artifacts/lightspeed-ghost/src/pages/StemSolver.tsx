import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSolveStem, useGetStemSubjects } from "@workspace/api-client-react";
import {
  FlaskConical, CheckCircle, ExternalLink, Search,
  ChevronDown, ChevronUp, Dna, Sparkles, ShieldCheck,
  AlertTriangle, XCircle, Lightbulb, Copy, CheckCheck,
  Download, Loader2, RotateCcw, Camera, FileText, Zap,
  BookOpen, Atom, Calculator, Cpu, BarChart2, Layers,
  Database,
} from "lucide-react";
import type { StemSolution } from "@workspace/api-client-react";
import StemImageOcr from "@/components/StemImageOcr";
import MathRenderer from "@/components/MathRenderer";
import { ExportButtons } from "@/components/ExportButtons";
import { wrapDocHtml, makeLsgFilename } from "@/lib/exportUtils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { stemResourcesBySubject, toolTypeColors } from "@/data/stemResources";
import { cn } from "@/lib/utils";
import { usePaywallGuard } from "@/hooks/usePaywallGuard";
import { PaywallFlow } from "@/components/checkout/PaywallFlow";

const schema = z.object({
  problem: z.string().min(5, "Please describe your problem"),
  subject: z.enum(["mathematics", "physics", "chemistry", "biology", "engineering", "computer_science", "statistics"]),
  showSteps: z.boolean().optional(),
  generateGraph: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

interface Paper {
  paperId: string; title: string; authors: string;
  year: number | null; abstract: string | null;
  url: string | null; citationCount: number;
}
interface BioModel {
  id: string; name: string; description: string | null;
  lastModified: string | null; publicationCount: number;
  format: string; url: string;
}
interface MoleculeData {
  cid: number; iupacName: string | null; commonName: string | null;
  casNumber: string | null; smiles: string | null; formula: string | null;
  molecularWeight: number | null; xLogP: number | null;
  hBondDonors: number | null; hBondAcceptors: number | null;
  rotatableBonds: number | null; tpsa: number | null;
  ghsHazards: string[]; pubchemUrl: string; synonyms: string[];
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

function buildSolutionText(result: StemSolution, problem: string): string {
  return [
    `STEM SOLUTION — ${result.subject.toUpperCase()}`,
    "─".repeat(52), "",
    "Problem:", problem, "",
    "Answer:", result.answer, "",
    ...(result.corrections?.length ? ["Corrections:", ...result.corrections.map(c => `  • ${c}`), ""] : []),
    ...(result.steps.length > 0
      ? ["Step-by-Step:", ...result.steps.flatMap(s => [
          `  Step ${s.stepNumber}: ${s.description}`,
          ...(s.expression ? [`    ${s.expression}`] : []),
          `    ${s.explanation}`, "",
        ])]
      : []),
  ].join("\n");
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

const SUBJECT_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  mathematics: { label: "Math", icon: <Calculator size={13} />, color: "blue" },
  physics: { label: "Physics", icon: <Atom size={13} />, color: "violet" },
  chemistry: { label: "Chemistry", icon: <FlaskConical size={13} />, color: "green" },
  biology: { label: "Biology", icon: <Dna size={13} />, color: "emerald" },
  engineering: { label: "Engineering", icon: <Layers size={13} />, color: "orange" },
  computer_science: { label: "CS", icon: <Cpu size={13} />, color: "cyan" },
  statistics: { label: "Stats", icon: <BarChart2 size={13} />, color: "rose" },
};

const API = import.meta.env.VITE_API_URL ?? "";

export default function StemSolver() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFileExtracting, setIsFileExtracting] = useState(false);
  const [fileExtractError, setFileExtractError] = useState<string | null>(null);
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
  const [solveStep, setSolveStep] = useState(0);
  const solveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const solveStem = useSolveStem();
  const { data: subjects } = useGetStemSubjects();
  const { guard, openBuy, plan, isAtLimit, pickerState, checkoutState, closePicker, closeCheckout, chooseSubscription, choosePayg } = usePaywallGuard();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { subject: "mathematics", showSteps: true, generateGraph: false },
  });

  const selectedSubject = form.watch("subject");
  const resources = stemResourcesBySubject[selectedSubject] ?? [];
  const showBioModels = selectedSubject === "biology" || selectedSubject === "chemistry";
  const showMolecule = selectedSubject === "chemistry";

  const handleStemFileExtracted = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsFileExtracting(true);
    setFileExtractError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API}/api/files/extract`, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const data = await res.json();
      if (data.isImage) {
        setFileExtractError("Image files are not supported here — use the camera/OCR button instead.");
        return;
      }
      const extracted: string = data.text ?? "";
      form.setValue("problem", extracted.slice(0, 2000));
    } catch (err) {
      setFileExtractError(err instanceof Error ? err.message : "Failed to extract file text");
    } finally {
      setIsFileExtracting(false);
    }
  };

  const handleStemImageOcr = (text: string) => form.setValue("problem", text.slice(0, 1000));

  const onSubmit = async (data: FormData) => {
    if (isAtLimit("stem")) { guard("stem", () => {}); return; }
    setPapers([]);
    setBioModels([]);
    setRecommendations({});
    setSolvedProblem(data.problem);
    setExpandedSteps({});
    setSolveStep(0);

    const STEP_COUNT = 8;
    solveIntervalRef.current = setInterval(() => {
      setSolveStep(prev => (prev < STEP_COUNT - 1 ? prev + 1 : prev));
    }, 1100);

    let res;
    try {
      res = await solveStem.mutateAsync(data);
    } catch {
      // error is stored in solveStem.error by React Query — form will re-render with error shown
      return;
    } finally {
      if (solveIntervalRef.current) { clearInterval(solveIntervalRef.current); solveIntervalRef.current = null; }
    }
    if (!res) return;
    setResult(res);
    setActiveTab("papers");
    setShowInput(false);

    setPapersLoading(true);
    const foundPapers = await searchPapers(data.problem.slice(0, 100), data.subject);
    setPapers(foundPapers);
    setPapersLoading(false);

    if (showBioModels) {
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
    a.download = `${makeLsgFilename("stem", result.subject + "-SOLUTION")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleStep = (n: number) => setExpandedSteps(p => ({ ...p, [n]: !(p[n] ?? true) }));
  const toggleGroup = (label: string) => setExpandedGroups(p => ({ ...p, [label]: !p[label] }));

  // ── Solving progress panel ─────────────────────────────────────────────────
  const SOLVE_STEPS = [
    "Parsing problem — identifying knowns and unknowns",
    "THOUGHT — understanding domain scope and constraints",
    "ACTION — selecting strategy, theorem, or formula",
    "OBSERVATION — setting up equations and expressions",
    "THOUGHT 2 — executing calculation with full working",
    "Chain-of-Verification — checking solution for errors",
    "Applying critic corrections if needed",
    "Building step-by-step explanation",
  ];

  if (solveStem.isPending) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background px-6 gap-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap size={16} className="text-primary" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <FlaskConical size={24} className="text-primary" />
          </div>
          <h2 className="text-xl font-bold">Solving your problem…</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Multi-agent reasoning with step-by-step verification
          </p>
        </div>

        <div className="w-full max-w-sm">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${Math.round(((solveStep + 1) / SOLVE_STEPS.length) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground/60">ReAct loop running</span>
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">
              {Math.round(((solveStep + 1) / SOLVE_STEPS.length) * 100)}%
            </span>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-2">
          {SOLVE_STEPS.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all duration-500 ${
                i < solveStep
                  ? "bg-primary/5 border-primary/20 text-foreground"
                  : i === solveStep
                    ? "bg-card border-border text-foreground shadow-sm"
                    : "bg-muted/30 border-transparent text-muted-foreground/40"
              }`}
            >
              {i < solveStep ? (
                <CheckCircle size={13} className="text-primary shrink-0" />
              ) : i === solveStep ? (
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20 shrink-0" />
              )}
              <span className="text-xs">{step}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Shared subject pills ──────────────────────────────────────────────────
  const SubjectPills = (
    <div className="flex flex-wrap gap-2 justify-center">
      {subjects
        ? subjects.subjects.map((sub) => {
            const meta = SUBJECT_META[sub.id];
            const isActive = selectedSubject === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => { form.setValue("subject", sub.id as FormData["subject"]); setExpandedGroups({}); }}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25 scale-105"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground hover:scale-[1.02]"
                )}
              >
                {meta?.icon}
                {meta?.label ?? sub.name}
              </button>
            );
          })
        : ["Math","Physics","Chemistry","Biology","Engineering","CS","Stats"].map(s => (
            <div key={s} className="h-8 w-20 rounded-full bg-muted animate-pulse" />
          ))}
    </div>
  );

  // ── Shared input form ─────────────────────────────────────────────────────
  const InputForm = (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {solveStem.isError && (
        <div className="mb-3 flex items-start gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Solve failed</p>
            <p className="opacity-80 mt-0.5">
              {solveStem.error instanceof Error ? solveStem.error.message : "Something went wrong — please check your problem and try again."}
            </p>
          </div>
        </div>
      )}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm ring-1 ring-transparent focus-within:ring-primary/30 transition-all">
        {/* Upload tools row */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-0 flex-wrap">
          <StemImageOcr onExtracted={handleStemImageOcr} compact />
          <input ref={fileInputRef} type="file" accept=".txt,.pdf,.docx,.doc,.md" className="sr-only" onChange={handleStemFileExtracted} />
          <button
            type="button"
            disabled={isFileExtracting}
            onClick={() => { setFileExtractError(null); fileInputRef.current?.click(); }}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 bg-card transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFileExtracting
              ? <><Loader2 size={12} className="animate-spin" /> Extracting…</>
              : <><FileText size={12} /> Upload file</>}
          </button>
          {fileExtractError && (
            <span className="text-xs text-destructive">{fileExtractError}</span>
          )}
        </div>
        {/* Textarea */}
        <textarea
          {...form.register("problem")}
          rows={5}
          placeholder={`Type your ${SUBJECT_META[selectedSubject]?.label ?? "STEM"} problem here…\n\ne.g.  Find the definite integral of x·sin(x) from 0 to π\ne.g.  A 5kg mass on a 30° incline with μ = 0.3. Find acceleration.`}
          className="w-full px-4 pt-3 pb-2 bg-transparent text-sm focus:outline-none resize-none font-mono leading-relaxed placeholder:text-muted-foreground/40 placeholder:font-sans"
        />
        {form.formState.errors.problem && (
          <p className="text-destructive text-xs px-4 pb-1">{form.formState.errors.problem.message}</p>
        )}
        {/* Bottom action row */}
        <div className="flex items-center gap-4 px-4 py-3 border-t border-border bg-muted/20">
          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
            <input type="checkbox" {...form.register("showSteps")} className="accent-primary w-3.5 h-3.5 cursor-pointer" />
            <span className="text-xs text-muted-foreground">Show steps</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
            <input type="checkbox" {...form.register("generateGraph")} className="accent-primary w-3.5 h-3.5 cursor-pointer" />
            <span className="text-xs text-muted-foreground">Generate graph</span>
          </label>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => openBuy("stem")}
              className="text-[11px] text-orange-400 hover:text-orange-300 transition-colors font-medium"
            >
              Buy one solve →
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/25"
            >
              <Zap size={14} /> Solve
            </button>
          </div>
        </div>
      </div>
    </form>
  );

  return (
    <>
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── Top bar — only shown when results exist ────────────────────────── */}
      {result && (
        <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-primary" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">STEM Solver</span>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 rounded-lg px-3 py-1.5 transition-all"
            >
              <RotateCcw size={11} /> New problem
            </button>
          </div>
        </div>
      )}

      {/* ── Input state (no result) ───────────────────────────────────────── */}
      {!result && (
        <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-5">

            {/* LightSpeed AI brand */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Zap size={18} className="text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">STEM Solver</h1>
              <p className="text-sm text-muted-foreground">
                Solve any problem instantly — Math · Physics · Chemistry · Biology · Engineering · CS · Statistics
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary">
                  <Zap size={9} /> ReAct Loop
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400">
                  <ShieldCheck size={9} /> Chain-of-Verification
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground">
                  <Database size={9} /> Research-backed
                </span>
              </div>
            </div>

            {/* Subject pills */}
            {SubjectPills}

            {/* Input form */}
            {InputForm}

          </div>
        </div>
      )}

      {/* ── RESULTS state (scrollable from top) ──────────────────────────── */}
      {result && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

            {/* Collapsed edit bar or expanded form */}
            {showInput ? (
              <div className="space-y-4">
                {SubjectPills}
                {InputForm}
              </div>
            ) : (
              <button
                onClick={() => setShowInput(true)}
                className="w-full flex items-center gap-3 bg-card border border-border hover:border-primary/40 rounded-2xl px-4 py-3 text-left transition-all group"
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                  {SUBJECT_META[selectedSubject]?.icon}
                </div>
                <span className="text-sm text-muted-foreground line-clamp-1 flex-1 font-mono">{solvedProblem}</span>
                <span className="text-[10px] text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0 font-medium">Edit →</span>
              </button>
            )}

          {/* ── Results ─────────────────────────────────────────────────────── */}
          <div className="space-y-3">

              {/* Method badges row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-primary/30 bg-primary/8 text-primary">
                  <Zap size={9} /> ReAct Loop
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400">
                  <ShieldCheck size={9} /> Chain-of-Verification
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground capitalize">
                  {SUBJECT_META[result.subject]?.icon} {result.subject.replace(/_/g, " ")}
                </span>
                {result.confidence !== undefined && <ConfidenceBadge confidence={result.confidence} />}
                {result.passedVerification !== undefined && (
                  result.passedVerification ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 px-2.5 py-1 rounded-full">
                      <ShieldCheck size={9} /> Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2.5 py-1 rounded-full">
                      <AlertTriangle size={9} /> Auto-corrected
                    </span>
                  )
                )}
              </div>

              {/* ── Answer card ── */}
              <div className="bg-card border border-green-200 dark:border-green-800/50 rounded-2xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-5 py-3 bg-green-50 dark:bg-green-950/20 border-b border-green-200 dark:border-green-800/50">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-500 shrink-0" />
                    <span className="text-sm font-bold text-green-800 dark:text-green-200">Answer</span>
                  </div>
                  <ExportButtons
                    getHtml={() => wrapDocHtml(`STEM Solution — ${result.subject}`, [
                      `<p><strong>Problem:</strong> ${solvedProblem}</p>`,
                      `<p><strong>Answer:</strong></p><p>${result.answer.replace(/\n/g, "<br>")}</p>`,
                      result.corrections?.length ? `<h2>Corrections</h2><ul>${result.corrections.map((c: string) => `<li>${c}</li>`).join("")}</ul>` : "",
                      result.steps.length ? `<h2>Step-by-Step Solution</h2>${result.steps.map((s: { stepNumber: number; description: string; expression?: string; explanation: string }) => `<div style="margin-bottom:12px"><p><strong>Step ${s.stepNumber}: ${s.description}</strong></p>${s.expression ? `<p style="font-family:monospace">${s.expression}</p>` : ""}<p>${s.explanation}</p></div>`).join("")}` : "",
                    ].join(""))}
                    getText={() => buildSolutionText(result, solvedProblem)}
                    filename={makeLsgFilename("stem", result.subject + "-SOLUTION")}
                  />
                </div>
                <div className="px-5 py-5">
                  <div className="handwritten-block">
                    <MathRenderer text={result.answer} className="text-base" />
                  </div>
                </div>
                {result.corrections && result.corrections.length > 0 && (
                  <div className="mx-5 mb-5 p-3.5 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                      <Lightbulb size={11} />
                      Critic Agent fixed {result.corrections.length} issue{result.corrections.length > 1 ? "s" : ""}
                    </div>
                    <ul className="space-y-1">
                      {result.corrections.map((c, i) => (
                        <li key={i} className="text-xs text-amber-800 dark:text-amber-300 flex gap-1.5">
                          <span className="shrink-0 text-amber-400 mt-0.5">•</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* ── Graph ── */}
              {result.graphData && (
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold text-sm mb-4 text-foreground">{result.graphData.labels?.title ?? "Graph"}</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.graphData.data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="x" tick={{ fontSize: 11 }} label={{ value: result.graphData.labels?.x ?? "x", position: "insideBottom", offset: -2, fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} label={{ value: result.graphData.labels?.y ?? "y", angle: -90, position: "insideLeft", fontSize: 11 }} />
                        <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                        <Line type="monotone" dataKey="y" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── Steps accordion ── */}
              {result.steps.length > 0 && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-primary" />
                      <h3 className="font-bold text-sm">Step-by-Step Solution</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{result.steps.length} steps</span>
                      <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">ReAct</span>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {result.steps.map((step) => {
                      const isOpen = expandedSteps[step.stepNumber] ?? true;
                      return (
                        <div key={step.stepNumber}>
                          <button
                            onClick={() => toggleStep(step.stepNumber)}
                            className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/20 transition-colors"
                          >
                            <span className="handwritten-step-num shrink-0">{step.stepNumber}</span>
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              <span className="text-xs font-semibold text-foreground truncate">{step.description}</span>
                              <StepTypeBadge desc={step.description} />
                            </div>
                            {isOpen
                              ? <ChevronUp size={13} className="text-muted-foreground shrink-0" />
                              : <ChevronDown size={13} className="text-muted-foreground shrink-0" />}
                          </button>
                          {isOpen && (
                            <div className="px-5 pb-5 pl-14 space-y-2.5">
                              {step.expression && (
                                <div className="handwritten-expression">
                                  <MathRenderer text={step.expression} className="text-sm" />
                                </div>
                              )}
                              <div className="handwritten-block">
                                <MathRenderer text={step.explanation} className="text-sm" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Research Stack ── */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Database size={14} className="text-primary" />
                    <h3 className="font-bold text-sm">Research Stack</h3>
                  </div>
                  {/* Live data source badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <LiveBadge label="Semantic Scholar" href="https://www.semanticscholar.org/" />
                    {showBioModels && <LiveBadge label="EBI BioModels" href="https://www.ebi.ac.uk/biomodels/" />}
                    {showMolecule && <LiveBadge label="PubChem" href="https://pubchem.ncbi.nlm.nih.gov/" />}
                  </div>
                </div>

                {/* Tab row */}
                <div className="flex border-b border-border overflow-x-auto scrollbar-none">
                  {([
                    { key: "papers", label: "Papers", icon: <Search size={12} />, badge: papersLoading ? "…" : papers.length > 0 ? String(papers.length) : null, always: true },
                    { key: "biomodels", label: "BioModels", icon: <Dna size={12} />, badge: bioModelsLoading ? "…" : bioModels.length > 0 ? String(bioModels.length) : null, always: showBioModels },
                    { key: "molecule", label: "Molecule", icon: <Atom size={12} />, badge: null, always: showMolecule },
                    { key: "tools", label: "AI Toolkit", icon: <Sparkles size={12} />, badge: null, always: true },
                  ] as Array<{ key: string; label: string; icon: React.ReactNode; badge: string | null; always: boolean }>)
                    .filter(t => t.always)
                    .map(tab => (
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

                {/* Papers tab */}
                {activeTab === "papers" && (
                  <PapersPanel
                    papers={papers}
                    loading={papersLoading}
                    recommendingFor={recommendingFor}
                    recommendations={recommendations}
                    onRecommend={handleGetRecommendations}
                  />
                )}

                {/* BioModels tab */}
                {activeTab === "biomodels" && showBioModels && (
                  <BioModelsPanel models={bioModels} total={bioModelsTotal} loading={bioModelsLoading} />
                )}

                {/* Molecule tab */}
                {activeTab === "molecule" && showMolecule && (
                  <MoleculePanel
                    query={moleculeQuery}
                    onQueryChange={setMoleculeQuery}
                    onSubmit={handleMoleculeLookup}
                    loading={moleculeLoading}
                    data={moleculeData}
                    error={moleculeError}
                  />
                )}

                {/* AI Toolkit tab */}
                {activeTab === "tools" && (
                  <ToolkitPanel resources={resources} expandedGroups={expandedGroups} onToggle={toggleGroup} />
                )}
              </div>

              {/* Repo attribution */}
              <div className="px-1 pb-1">
                <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed">
                  Tool index from{" "}
                  <a href="https://github.com/zawaditechnologiesllc/awesome-ai-for-science" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary underline underline-offset-2">awesome-ai-for-science</a>
                  {" · "}
                  <a href="https://github.com/zawaditechnologiesllc/AIAgents4Pharmabio" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary underline underline-offset-2">AIAgents4Pharmabio</a>
                  {" · "}
                  <a href="https://github.com/wu-yc/LabClaw" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary underline underline-offset-2">LabClaw (Stanford)</a>
                </p>
              </div>
            </div>

          <div className="h-6" />
        </div>
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

// ── Sub-panels ─────────────────────────────────────────────────────────────

function LiveBadge({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 text-[9px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-1.5 py-0.5 rounded-full hover:opacity-80 transition-opacity"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      {label}
    </a>
  );
}

function PapersPanel({
  papers, loading, recommendingFor, recommendations, onRecommend,
}: {
  papers: Paper[]; loading: boolean;
  recommendingFor: string | null;
  recommendations: Record<string, Paper[]>;
  onRecommend: (id: string) => void;
}) {
  return (
    <div>
      {loading && (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
          <Loader2 size={15} className="animate-spin" />
          <span className="text-sm">Searching Semantic Scholar…</span>
        </div>
      )}
      {!loading && papers.length === 0 && (
        <div className="flex flex-col items-center py-10 text-muted-foreground/40">
          <Search size={28} className="mb-2" />
          <p className="text-sm">No papers found</p>
        </div>
      )}
      {!loading && papers.length > 0 && (
        <div className="divide-y divide-border">
          {papers.map((paper) => (
            <div key={paper.paperId} className="px-5 py-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <a
                    href={paper.url ?? `https://www.semanticscholar.org/paper/${paper.paperId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors leading-snug block"
                  >
                    {paper.title}
                  </a>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {paper.authors && (
                      <span className="text-xs text-muted-foreground">
                        {paper.authors.split(",").slice(0, 2).join(", ")}{paper.authors.split(",").length > 2 ? " et al." : ""}
                      </span>
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
                onClick={() => onRecommend(paper.paperId)}
                disabled={!!recommendations[paper.paperId] || recommendingFor === paper.paperId}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary border border-border hover:border-primary/40 px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
              >
                {recommendingFor === paper.paperId
                  ? <><Loader2 size={10} className="animate-spin" /> Finding similar…</>
                  : recommendations[paper.paperId]
                  ? <><Sparkles size={10} className="text-primary" /> {recommendations[paper.paperId].length} similar shown</>
                  : <><Sparkles size={10} /> Find similar papers</>}
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
          <a href="https://www.semanticscholar.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Semantic Scholar</a>
          {" "}&amp; <a href="https://github.com/Future-House/paper-qa" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Talk2Scholars</a> pattern — 200M+ papers (Allen AI)
        </p>
      </div>
    </div>
  );
}

function BioModelsPanel({ models, total, loading }: { models: BioModel[]; total: number; loading: boolean }) {
  return (
    <div>
      {loading && (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
          <Loader2 size={15} className="animate-spin" />
          <span className="text-sm">Searching EBI BioModels…</span>
        </div>
      )}
      {!loading && models.length === 0 && (
        <div className="flex flex-col items-center py-10 text-muted-foreground/40">
          <Dna size={28} className="mb-2" />
          <p className="text-sm">No curated models found</p>
        </div>
      )}
      {!loading && models.length > 0 && (
        <>
          {total > 0 && (
            <div className="px-5 py-2 border-b border-border bg-muted/20">
              <span className="text-xs text-muted-foreground">{total.toLocaleString()} total matches — top {models.length}</span>
            </div>
          )}
          <div className="divide-y divide-border">
            {models.map((model) => (
              <div key={model.id} className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <a href={model.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors block">{model.name}</a>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono font-medium">{model.id}</span>
                    <span className="text-[10px] bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded font-medium">{model.format}</span>
                    {model.publicationCount > 0 && (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
                        {model.publicationCount} pub{model.publicationCount > 1 ? "s" : ""}
                      </span>
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
          <a href="https://www.ebi.ac.uk/biomodels/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">EBI BioModels</a>
          {" "}&amp; <a href="https://github.com/zawaditechnologiesllc/AIAgents4Pharmabio" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Talk2BioModels</a> pattern — curated SBML models
        </p>
      </div>
    </div>
  );
}

function MoleculePanel({
  query, onQueryChange, onSubmit, loading, data, error,
}: {
  query: string; onQueryChange: (v: string) => void; onSubmit: (e: React.FormEvent) => void;
  loading: boolean; data: MoleculeData | null; error: string | null;
}) {
  return (
    <div>
      <div className="px-5 py-4 border-b border-border">
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Name or SMILES — e.g. aspirin, caffeine, C8H10N4O2"
            className="flex-1 px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono placeholder:font-sans placeholder:text-muted-foreground/50"
          />
          <button type="submit" disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Lookup
          </button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Powered by <a href="https://pubchem.ncbi.nlm.nih.gov/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PubChem</a>
          {" "}&amp; <a href="https://github.com/zawaditechnologiesllc/chemcrow-public" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ChemCrow</a> pattern
        </p>
      </div>
      {error && (
        <div className="px-5 py-4">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Try: aspirin, glucose, ethanol, C6H12O6</p>
        </div>
      )}
      {data && !loading && (
        <div className="px-5 py-5 space-y-4">
          <div>
            <h3 className="text-base font-bold">{data.commonName ?? data.iupacName ?? `CID ${data.cid}`}</h3>
            {data.iupacName && data.commonName && <p className="text-xs text-muted-foreground mt-0.5 font-mono">{data.iupacName}</p>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {data.casNumber && <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-mono">CAS {data.casNumber}</span>}
              {data.formula && <span className="text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded font-mono font-bold">{data.formula}</span>}
              <a href={data.pubchemUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                PubChem CID {data.cid} <ExternalLink size={9} />
              </a>
            </div>
          </div>
          {data.smiles && (
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">SMILES</label>
              <div className="px-3 py-2.5 bg-muted rounded-xl font-mono text-xs border border-border break-all select-all leading-relaxed">{data.smiles}</div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "Mol. Weight", val: data.molecularWeight != null ? `${data.molecularWeight} g/mol` : null },
              { label: "XLogP", val: data.xLogP != null ? String(data.xLogP) : null },
              { label: "H-Bond Donors", val: data.hBondDonors != null ? String(data.hBondDonors) : null },
              { label: "H-Bond Acceptors", val: data.hBondAcceptors != null ? String(data.hBondAcceptors) : null },
              { label: "Rotatable Bonds", val: data.rotatableBonds != null ? String(data.rotatableBonds) : null },
              { label: "TPSA (Å²)", val: data.tpsa != null ? String(data.tpsa) : null },
            ].filter(d => d.val != null).map(d => (
              <div key={d.label} className="bg-muted/50 rounded-xl p-3 border border-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{d.label}</div>
                <div className="text-sm font-bold mt-0.5">{d.val}</div>
              </div>
            ))}
          </div>
          {data.ghsHazards.length > 0 && (
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">GHS Safety Hazards</label>
              <div className="flex flex-wrap gap-1.5">
                {data.ghsHazards.map(h => (
                  <span key={h} className={`text-[11px] px-2 py-0.5 rounded border font-medium ${ghsColor(h)}`}>{h}</span>
                ))}
              </div>
            </div>
          )}
          {data.synonyms.length > 0 && (
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Known Names</label>
              <div className="flex flex-wrap gap-1.5">
                {data.synonyms.map(s => (
                  <span key={s} className="text-[11px] px-2 py-0.5 bg-muted text-muted-foreground rounded border border-border">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center py-8 text-muted-foreground/40">
          <Atom size={28} className="mb-2" />
          <p className="text-sm">Look up any molecule by name or SMILES</p>
        </div>
      )}
    </div>
  );
}

function ToolkitPanel({
  resources, expandedGroups, onToggle,
}: {
  resources: ReturnType<typeof stemResourcesBySubject[string]>;
  expandedGroups: Record<string, boolean>;
  onToggle: (label: string) => void;
}) {
  if (resources.length === 0) {
    return <div className="px-5 py-8 text-center text-sm text-muted-foreground/40">No tools for this subject</div>;
  }
  return (
    <div>
      <div className="px-5 py-3 border-b border-border bg-muted/10">
        <p className="text-[10px] text-muted-foreground">
          Curated from{" "}
          <a href="https://github.com/zawaditechnologiesllc/awesome-ai-for-science" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">awesome-ai-for-science</a>
          {" "}&amp;{" "}
          <a href="https://github.com/zawaditechnologiesllc/AIAgents4Pharmabio" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">AIAgents4Pharmabio</a>
        </p>
      </div>
      <div className="divide-y divide-border">
        {resources.map((group) => {
          const isOpen = expandedGroups[group.label] ?? true;
          return (
            <div key={group.label}>
              <button
                onClick={() => onToggle(group.label)}
                className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-muted/20 transition-colors"
              >
                <span className="text-xs font-bold text-foreground">{group.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">{group.tools.length}</span>
                  {isOpen ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                </div>
              </button>
              {isOpen && (
                <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.tools.map((tool) => (
                    <a
                      key={tool.name}
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col gap-1 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/40 transition-all group"
                    >
                      <div className="flex items-center gap-1.5 justify-between">
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors leading-tight">{tool.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wide ${toolTypeColors[tool.type]}`}>{tool.type}</span>
                          <ExternalLink size={10} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">{tool.description}</p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  if (pct >= 85) return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 px-2.5 py-1 rounded-full">
      <CheckCircle size={9} /> {pct}% confidence
    </span>
  );
  if (pct >= 65) return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2.5 py-1 rounded-full">
      <AlertTriangle size={9} /> {pct}% confidence
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 px-2.5 py-1 rounded-full">
      <XCircle size={9} /> {pct}% confidence
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
