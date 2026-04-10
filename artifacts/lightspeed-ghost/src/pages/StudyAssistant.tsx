import { useState, useRef, useEffect, useCallback } from "react";
import {
  useAskStudyAssistant,
  useListStudySessions,
  getListStudySessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Send, Loader2, Zap, Upload, FileText,
  ChevronLeft, ChevronRight, RotateCcw, CheckCircle2, XCircle,
  BookOpen, Brain, GraduationCap, AlertTriangle,
  Presentation, ChevronDown, ChevronUp,
  Star, Target, BookMarked, FlipHorizontal2,
  Image as ImageIcon, Plus, Sparkles, MessageSquare, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MathRenderer from "@/components/MathRenderer";
import { ExportButtons } from "@/components/ExportButtons";
import { wrapDocHtml, mdToBodyHtml, makeLsgFilename } from "@/lib/exportUtils";
import { renderInlineMd } from "@/lib/renderInline";
import { apiFetch } from "@/lib/apiFetch";
import { usePaywallGuard } from "@/hooks/usePaywallGuard";
import { PaywallFlow } from "@/components/checkout/PaywallFlow";


// ── Types ──────────────────────────────────────────────────────────────────

type SourceType = "doc" | "image" | "text";
interface StudySource {
  id: string; name: string; type: SourceType;
  content: string; wordCount: number;
  base64?: string; mimeType?: string;
}

interface Flashcard { front: string; back: string; tag?: string }
interface QuizQuestion {
  question: string; options: string[]; correct: number;
  explanation: string; targetsTopic?: string;
}
interface SummaryData {
  title: string; overview: string;
  sections: { heading: string; points: string[]; keyTerms?: { term: string; definition: string }[] }[];
  takeaways: string[]; relatedConcepts: string[];
}
interface StudyGuideData {
  title: string;
  sections: Array<
    | { type: "overview";  heading: string; content: string }
    | { type: "concepts"; heading: string; items: { name: string; explanation: string; example?: string }[] }
    | { type: "process";  heading: string; steps: string[] }
    | { type: "tips";     heading: string; tips: string[] }
  >;
  quickRef?: { label: string; value: string }[];
}
interface Slide {
  slideNum: number; type: "title" | "agenda" | "content" | "conclusion";
  title: string; subtitle?: string; bullets?: string[]; notes?: string;
}
interface SlideData { title: string; slides: Slide[] }

type OutputType = "flashcards" | "quiz" | "summary" | "studyguide" | "slides";
type ActiveView = OutputType | "weakpoints" | null;
type ChatMsg = { role: "user" | "assistant"; content: string; followUpQuestions?: string[] };

// ── Constants ─────────────────────────────────────────────────────────────

const OUTPUT_TYPES: { key: OutputType; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "flashcards", label: "Flashcards",  icon: <FlipHorizontal2 size={15} />, desc: "Interactive flip cards" },
  { key: "quiz",       label: "Quiz",        icon: <GraduationCap size={15} />,   desc: "Multiple-choice test" },
  { key: "summary",    label: "Summary",     icon: <BookMarked size={15} />,      desc: "Key points overview" },
  { key: "studyguide", label: "Study Guide", icon: <BookOpen size={15} />,        desc: "Full learning guide" },
  { key: "slides",     label: "Slides",      icon: <Presentation size={15} />,   desc: "Presentation deck" },
];

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "History",
  "English Literature", "Geography", "Computer Science", "Economics",
  "Psychology", "Sociology", "Business Studies", "Art & Design",
  "Music", "Languages", "Political Science", "Philosophy",
  "Environmental Science", "Statistics", "Medicine", "Law", "General",
];

const MODE_DESCRIPTIONS: Record<string, string> = {
  flashcards: "Converts your material into interactive flip cards to help memorise key terms and concepts",
  quiz:       "Creates multiple-choice questions that test your understanding at mixed difficulty levels",
  summary:    "Extracts the most important ideas and organises them into a clean, readable overview",
  studyguide: "Builds a full structured guide with concepts, steps, exam tips, and a quick-reference section",
  slides:     "Designs a presentation deck with title, agenda, content slides, and speaker notes",
};

const PROGRESS_STEPS: Record<OutputType, string[]> = {
  flashcards: [
    "Reading your material…",
    "Identifying key concepts and terms…",
    "Crafting question and answer pairs…",
    "Organising cards by topic…",
    "Flashcards ready ✓",
  ],
  quiz: [
    "Reading your material…",
    "Selecting the most testable concepts…",
    "Writing question stems and distractors…",
    "Calibrating difficulty (easy → hard)…",
    "Quiz ready ✓",
  ],
  summary: [
    "Reading your material…",
    "Extracting core ideas and arguments…",
    "Structuring sections and key terms…",
    "Composing key takeaways…",
    "Summary ready ✓",
  ],
  studyguide: [
    "Reading your material…",
    "Mapping the core concepts…",
    "Building step-by-step explanations…",
    "Writing exam tips and quick reference…",
    "Study guide ready ✓",
  ],
  slides: [
    "Reading your material…",
    "Designing slide structure…",
    "Writing headlines and bullets…",
    "Adding speaker notes…",
    "Slide deck ready ✓",
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function mergedContent(topic: string, sources: StudySource[]) {
  const parts: string[] = [];
  if (topic.trim()) parts.push(`[Topic / Notes]\n${topic.trim()}`);
  sources.forEach((s) => {
    if (s.type !== "image" || s.content) {
      parts.push(`[${s.name}]\n${s.content}`);
    }
  });
  return parts.join("\n\n---\n\n");
}

async function callGenerate(
  content: string,
  type: OutputType | "weakpoints",
  subject: string,
  images: { base64: string; mimeType: string }[],
  weakTopics?: string[],
) {
  const res = await apiFetch(`/study/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, type, subject, weakTopics, images }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Main component ─────────────────────────────────────────────────────────

export default function StudyAssistant() {
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const imageInputRef   = useRef<HTMLInputElement>(null);
  const { guard, openBuy, plan, isAtLimit, pickerState, checkoutState, closePicker, closeCheckout, chooseSubscription, choosePayg } = usePaywallGuard();
  const chatEndRef      = useRef<HTMLDivElement>(null);
  const chatInputRef    = useRef<HTMLTextAreaElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const queryClient     = useQueryClient();
  const askAssistant    = useAskStudyAssistant();
  const { data: sessions } = useListStudySessions();

  // Input state
  const [topic,           setTopic]           = useState("");
  const [selectedType,    setSelectedType]    = useState<OutputType>("flashcards");
  const [selectedSubject, setSelectedSubject] = useState("General");
  const [subjectQuery,    setSubjectQuery]    = useState("General");
  const [subjectFocused,  setSubjectFocused]  = useState(false);

  // Sources (uploaded files + images)
  const [sources,   setSources]   = useState<StudySource[]>([]);
  const [uploading, setUploading] = useState(false);

  // Generation state
  const [isGenerating,  setIsGenerating]  = useState(false);
  const [progressStep,  setProgressStep]  = useState(0);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [activeView,    setActiveView]    = useState<ActiveView>(null);

  // Output data
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quiz,       setQuiz]       = useState<QuizQuestion[]>([]);
  const [summary,    setSummary]    = useState<SummaryData | null>(null);
  const [studyGuide, setStudyGuide] = useState<StudyGuideData | null>(null);
  const [slides,     setSlides]     = useState<SlideData | null>(null);
  const [weakQuiz,   setWeakQuiz]   = useState<QuizQuestion[]>([]);

  // Flashcard state
  const [cardIdx,       setCardIdx]       = useState(0);
  const [cardFlipped,   setCardFlipped]   = useState(false);
  const [masteredCards, setMasteredCards] = useState<Set<number>>(new Set());

  // Quiz state
  const [quizAnswers,   setQuizAnswers]   = useState<(number | null)[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [currentQ,      setCurrentQ]      = useState(0);
  const [wrongTopics,   setWrongTopics]   = useState<string[]>([]);

  // Slide state
  const [slideIdx, setSlideIdx] = useState(0);

  // Weak quiz state
  const [weakAnswers,   setWeakAnswers]   = useState<(number | null)[]>([]);
  const [weakSubmitted, setWeakSubmitted] = useState(false);
  const [weakCurrentQ,  setWeakCurrentQ]  = useState(0);

  // Floating chat state
  const [chatOpen,      setChatOpen]      = useState(false);
  const [chatInput,     setChatInput]     = useState("");
  const [chatMessages,  setChatMessages]  = useState<ChatMsg[]>([]);
  const [chatSessionId, setChatSessionId] = useState<number | undefined>();
  const [chatMode,      setChatMode]      = useState<"tutor" | "explain" | "quiz" | "summarize">("tutor");

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, askAssistant.isPending, chatOpen]);

  useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = "auto";
      chatInputRef.current.style.height = Math.min(chatInputRef.current.scrollHeight, 130) + "px";
    }
  }, [chatInput]);

  // Progress ticker
  useEffect(() => {
    if (!isGenerating) { setProgressStep(0); return; }
    const steps = PROGRESS_STEPS[selectedType] ?? PROGRESS_STEPS.flashcards;
    const interval = setInterval(() => {
      setProgressStep((p) => (p < steps.length - 2 ? p + 1 : p));
    }, 1400);
    return () => clearInterval(interval);
  }, [isGenerating, selectedType]);

  // Filtered subjects for combobox
  const filteredSubjects = SUBJECTS.filter((s) =>
    s.toLowerCase().includes(subjectQuery.toLowerCase()) && s.toLowerCase() !== subjectQuery.toLowerCase()
  );

  // ── Upload ────────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch(`/files/extract`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Failed to extract");
      const data = await res.json() as {
        text?: string; wordCount?: number; isImage?: boolean;
        base64?: string; mimeType?: string; filename?: string;
      };

      if (data.isImage) {
        setSources((prev) => [...prev, {
          id: uid(), name: file.name, type: "image",
          content: "", wordCount: 0,
          base64: data.base64, mimeType: file.type,
        }]);
      } else {
        setSources((prev) => [...prev, {
          id: uid(), name: file.name, type: "doc",
          content: data.text ?? "", wordCount: data.wordCount ?? 0,
        }]);
      }
    } catch { /* silent */ } finally { setUploading(false); }
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const f of Array.from(e.target.files ?? [])) await uploadFile(f);
    e.target.value = "";
  }, [uploadFile]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    for (const f of Array.from(e.dataTransfer.files)) await uploadFile(f);
  }, [uploadFile]);

  // ── Generate ──────────────────────────────────────────────────────────

  const generate = useCallback(async (type: OutputType | "weakpoints" = selectedType) => {
    const content = mergedContent(topic, sources);
    const images = sources
      .filter((s) => s.type === "image" && s.base64)
      .map((s) => ({ base64: s.base64!, mimeType: s.mimeType ?? "image/jpeg" }));

    if (!content.trim() && images.length === 0) {
      setGenerateError("Enter a topic, paste notes, or upload a file first.");
      return;
    }
    setIsGenerating(true);
    setGenerateError(null);
    setProgressStep(0);
    setActiveView(type as ActiveView);
    try {
      const r = await callGenerate(
        content || "(See uploaded images for context)",
        type,
        selectedSubject,
        images,
        type === "weakpoints" ? wrongTopics : undefined,
      );
      if (type === "flashcards") { setFlashcards(r.data?.flashcards ?? []); setCardIdx(0); setCardFlipped(false); setMasteredCards(new Set()); }
      if (type === "quiz")       { setQuiz(r.data?.questions ?? []); setQuizAnswers([]); setQuizSubmitted(false); setCurrentQ(0); }
      if (type === "summary")    { setSummary(r.data); }
      if (type === "studyguide") { setStudyGuide(r.data); }
      if (type === "slides")     { setSlides(r.data); setSlideIdx(0); }
      if (type === "weakpoints") { setWeakQuiz(r.data?.questions ?? []); setWeakAnswers([]); setWeakSubmitted(false); setWeakCurrentQ(0); }
      setProgressStep((PROGRESS_STEPS[type as OutputType] ?? PROGRESS_STEPS.flashcards).length - 1);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Generation failed. Please try again.");
      setActiveView(null);
    } finally { setIsGenerating(false); }
  }, [topic, sources, selectedType, selectedSubject, wrongTopics]);

  // ── Chat ──────────────────────────────────────────────────────────────

  const sendChat = useCallback(async (override?: string) => {
    const msg = (override ?? chatInput).trim();
    if (!msg || askAssistant.isPending) return;
    if (isAtLimit("study")) { guard("study", () => {}); return; }
    setChatInput("");
    const ctx = mergedContent(topic, sources);
    const withCtx = ctx.trim()
      ? `[Study Context: ${selectedSubject}]\n${ctx.slice(0, 8000)}\n\n---\n\n${msg}`
      : msg;
    setChatMessages((prev) => [...prev, { role: "user", content: msg }]);
    try {
      const res = await askAssistant.mutateAsync({
        question: withCtx,
        sessionId: chatSessionId,
        mode: chatMode,
      });
      setChatSessionId(res.sessionId);
      setChatMessages((prev) => [...prev, { role: "assistant", content: res.answer, followUpQuestions: res.followUpQuestions }]);
      queryClient.invalidateQueries({ queryKey: getListStudySessionsQueryKey() });
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
    }
  }, [chatInput, chatSessionId, chatMode, topic, sources, selectedSubject, askAssistant, queryClient]);

  // ── Quiz helpers ──────────────────────────────────────────────────────

  const collectWrong = (answers: (number | null)[], questions: QuizQuestion[]) => {
    const bad = questions
      .filter((q, i) => answers[i] !== q.correct)
      .map((q) => q.targetsTopic ?? q.question.slice(0, 40));
    setWrongTopics((prev) => [...new Set([...prev, ...bad])]);
  };

  const quizScore = quizAnswers.filter((a, i) => a === quiz[i]?.correct).length;
  const weakScore = weakAnswers.filter((a, i) => a === weakQuiz[i]?.correct).length;

  const hasContent = topic.trim().length > 0 || sources.length > 0;
  const progressSteps = PROGRESS_STEPS[selectedType] ?? PROGRESS_STEPS.flashcards;
  const imageSources = sources.filter((s) => s.type === "image");
  const showingResults = !!activeView && !isGenerating;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
    <div className="relative h-full flex flex-col overflow-hidden bg-background">

      {/* ── SCROLLABLE MAIN AREA ──────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className={cn(
          "w-full mx-auto pb-20",
          showingResults
            ? activeView === "slides" ? "max-w-5xl px-4 sm:px-6" : "max-w-4xl px-4 sm:px-6"
            : "max-w-2xl px-6"
        )}>

          {/* ── RESULT BACK BAR (shown when viewing results) ──────────── */}
          {showingResults && (
            <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-background/95 backdrop-blur-sm border-b border-border/60 py-3 mb-8 flex items-center gap-3">
              <button
                onClick={() => setActiveView(null)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0 px-2.5 py-1.5 rounded-lg hover:bg-muted"
              >
                <ChevronLeft size={13} /> Edit
              </button>
              <div className="w-px h-4 bg-border shrink-0" />
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground shrink-0">
                  {OUTPUT_TYPES.find((t) => t.key === activeView)?.label ?? activeView}
                </span>
                {topic.trim() && (
                  <span className="text-xs text-muted-foreground/60 truncate hidden sm:block">
                    — {topic.trim().slice(0, 80)}{topic.trim().length > 80 ? "…" : ""}
                  </span>
                )}
              </div>
              <button
                onClick={() => generate(activeView as OutputType)}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors shrink-0"
              >
                <RotateCcw size={11} /> Regenerate
              </button>
            </div>
          )}

          {/* ── CENTERED HERO HEADER ──────────────────────────────────── */}
          {!showingResults && !isGenerating && (
          <div className="pt-10 pb-8 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Zap size={20} className="text-primary" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-primary uppercase tracking-[0.18em] mb-1">LightSpeed AI</p>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">AI Study Assistant</h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              {MODE_DESCRIPTIONS[selectedType]}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              {["Flashcards", "Quizzes", "Summaries", "Study Guides", "Slides", "AI Tutor"].map((f) => (
                <span key={f} className="text-[10px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{f}</span>
              ))}
            </div>
          </div>
          )}

          {/* ── GENERATING: show compact generating state instead of input ── */}
          {isGenerating && (
            <div className="mt-10 mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary/20 bg-primary/5">
              <Loader2 size={14} className="animate-spin text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary">
                  Generating {OUTPUT_TYPES.find((t) => t.key === selectedType)?.label ?? "content"}…
                </p>
                {topic.trim() && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{topic.trim().slice(0, 80)}</p>
                )}
              </div>
            </div>
          )}

          {!showingResults && !isGenerating && (
          <>
          {/* ── 1. MAIN TOPIC TEXTAREA ────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card shadow-sm focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.06)] transition-all">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={"Enter a topic, question, or paste your notes here…\n\nExample: Explain photosynthesis, or paste your chapter notes…"}
              rows={6}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none px-5 pt-4 pb-3 leading-relaxed"
            />
            <div className="flex items-center gap-2 px-4 pb-3 border-t border-border/40">
              <span className="text-[11px] text-muted-foreground/40">
                {topic.trim() ? `${topic.trim().split(" ").filter(Boolean).length} words` : "Type or paste above · or upload notes below"}
              </span>
              {topic.trim() && (
                <button onClick={() => setTopic("")} className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors ml-auto">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ── 2. UPLOAD NOTES ───────────────────────────────────────── */}
          <div className="mt-4 space-y-3">
            {/* Hidden inputs */}
            <input ref={fileInputRef} type="file" multiple className="sr-only"
              accept=".pdf,.docx,.doc,.txt,.md" onChange={handleFileInput} />
            <input ref={imageInputRef} type="file" multiple className="sr-only"
              accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleFileInput} />

            {/* Upload row */}
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-muted/20 text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
              >
                {uploading
                  ? <Loader2 size={14} className="animate-spin text-primary shrink-0" />
                  : <Upload size={14} className="shrink-0 text-muted-foreground/60" />}
                <span className="text-xs">{uploading ? "Uploading…" : "Upload notes"}</span>
                <span className="ml-auto text-[10px] text-muted-foreground/30">PDF · DOCX · TXT</span>
              </button>
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-blue-400/40 hover:bg-blue-50/5 text-sm text-muted-foreground hover:text-blue-400 transition-all disabled:opacity-50"
              >
                <ImageIcon size={14} className="shrink-0" />
                <span className="text-xs">Screenshot</span>
              </button>
            </div>

            {/* Source chips */}
            {sources.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sources.map((src) => (
                  <div key={src.id}
                    className={cn(
                      "group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs",
                      src.type === "image"
                        ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                        : "bg-muted text-muted-foreground"
                    )}>
                    {src.type === "image"
                      ? <ImageIcon size={11} />
                      : <FileText size={11} />}
                    <span className="max-w-[150px] truncate">{src.name}</span>
                    {src.wordCount > 0 && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="opacity-60">{src.wordCount.toLocaleString()}w</span>
                      </>
                    )}
                    <button
                      onClick={() => setSources((p) => p.filter((s) => s.id !== src.id))}
                      className="opacity-0 group-hover:opacity-100 ml-0.5 hover:text-destructive transition-all">
                      <XCircle size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Image preview strip */}
            {imageSources.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {imageSources.map((src) => src.base64 && (
                  <div key={src.id} className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border">
                    <img src={`data:${src.mimeType};base64,${src.base64}`} alt={src.name}
                      className="w-full h-full object-cover" />
                    <button
                      onClick={() => setSources((p) => p.filter((s) => s.id !== src.id))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black transition-colors">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 3. OUTPUT TYPE SELECTOR ───────────────────────────────── */}
          <div className="mt-6 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Generate</p>
            <div className="grid grid-cols-5 gap-2">
              {OUTPUT_TYPES.map(({ key, label, icon, desc }) => (
                <button
                  key={key}
                  onClick={() => setSelectedType(key)}
                  className={cn(
                    "flex flex-col items-center gap-2 px-2 py-3.5 rounded-2xl border text-center transition-all",
                    selectedType === key
                      ? "border-primary bg-primary/5 text-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  <span className={selectedType === key ? "text-primary" : ""}>{icon}</span>
                  <span className="text-[11px] font-semibold leading-tight">{label}</span>
                  <span className="text-[9px] text-muted-foreground/50 leading-tight hidden sm:block">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── 4. SUBJECT — SEARCHABLE COMBOBOX ─────────────────────── */}
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</p>
            <div className="relative">
              <input
                ref={subjectInputRef}
                type="text"
                value={subjectQuery}
                onChange={(e) => { setSubjectQuery(e.target.value); setSelectedSubject(e.target.value); }}
                onFocus={() => setSubjectFocused(true)}
                onBlur={() => setTimeout(() => setSubjectFocused(false), 150)}
                placeholder="Type or choose a subject…"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/8 transition-all"
              />
              {subjectFocused && filteredSubjects.length > 0 && (
                <div className="absolute z-30 top-full mt-1.5 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                  <div className="max-h-48 overflow-y-auto py-1">
                    {filteredSubjects.map((s) => (
                      <button
                        key={s}
                        onMouseDown={() => { setSelectedSubject(s); setSubjectQuery(s); subjectInputRef.current?.blur(); }}
                        className="w-full text-left px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Subject chip grid (always visible for quick selection) */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {SUBJECTS.filter((s) => s !== selectedSubject).slice(0, 12).map((s) => (
                <button
                  key={s}
                  onClick={() => { setSelectedSubject(s); setSubjectQuery(s); }}
                  className="text-[11px] px-3 py-1 rounded-full bg-muted text-muted-foreground hover:bg-primary/8 hover:text-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ── 5. GENERATE BUTTON ────────────────────────────────────── */}
          <div className="mt-6">
            <button
              onClick={() => generate()}
              disabled={isGenerating || !hasContent}
              className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 shadow-sm"
            >
              {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              {isGenerating ? "Generating…" : `Generate ${OUTPUT_TYPES.find((t) => t.key === selectedType)?.label ?? "Content"}`}
            </button>
            <p className="text-center text-[11px] text-muted-foreground/50 mt-2">
              or{" "}
              <button type="button" onClick={() => openBuy("study")} className="text-orange-400 hover:text-orange-300 transition-colors font-medium">
                buy a day pass →
              </button>
            </p>
          </div>
          </>)}

          {/* ── 6. PROGRESS DISPLAY ───────────────────────────────────── */}
          {isGenerating && (
            <div className="mt-4 rounded-2xl border border-border bg-muted/10 px-5 py-4 space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={11} className="text-primary animate-pulse" />
                <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI is working</span>
              </div>
              {progressSteps.map((step, i) => {
                const done   = i < progressStep;
                const active = i === progressStep;
                return (
                  <div key={i} className={cn("flex items-center gap-3 text-xs transition-all duration-300",
                    done ? "text-emerald-600 dark:text-emerald-400" :
                    active ? "text-foreground font-medium" :
                    "text-muted-foreground/30"
                  )}>
                    {done
                      ? <CheckCircle2 size={12} className="shrink-0" />
                      : active
                        ? <Loader2 size={12} className="animate-spin shrink-0 text-primary" />
                        : <div className="w-3 h-3 rounded-full border border-muted-foreground/20 shrink-0" />}
                    {step}
                  </div>
                );
              })}
            </div>
          )}

          {/* Error banner */}
          {generateError && (
            <div className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/8 text-destructive text-xs border border-destructive/20">
              <AlertTriangle size={13} className="shrink-0" />
              <span>{generateError}</span>
              <button onClick={() => setGenerateError(null)} className="ml-auto opacity-60 hover:opacity-100">
                <XCircle size={12} />
              </button>
            </div>
          )}

          {/* ── 7. OUTPUT AREA ────────────────────────────────────────── */}
          {activeView && !isGenerating && (
            <div className="space-y-6">
              {/* Output type switch tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                {OUTPUT_TYPES.map(({ key, label, icon }) => {
                  const hasData = (
                    (key === "flashcards" && flashcards.length > 0) ||
                    (key === "quiz" && quiz.length > 0) ||
                    (key === "summary" && summary !== null) ||
                    (key === "studyguide" && studyGuide !== null) ||
                    (key === "slides" && slides !== null)
                  );
                  if (!hasData) return null;
                  return (
                    <button key={key} onClick={() => setActiveView(key)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all",
                        activeView === key
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/30 hover:bg-muted/40"
                      )}>
                      {icon} {label}
                    </button>
                  );
                })}
                {weakQuiz.length > 0 && (
                  <button onClick={() => setActiveView("weakpoints")}
                    className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all",
                      activeView === "weakpoints"
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                        : "bg-card text-amber-600 border-amber-200 dark:border-amber-900 hover:bg-amber-50/10")}>
                    <Target size={11} /> Weak Points
                  </button>
                )}
              </div>

              {/* Export buttons for exportable views */}
              {activeView && activeView !== "weakpoints" && (
                <div className="flex justify-end -mt-1">
                  <ExportButtons
                    getHtml={() => {
                      if (activeView === "flashcards" && flashcards.length) {
                        return wrapDocHtml("Flashcards", flashcards.map((c, i) => `<div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;padding:12px"><p style="margin:0 0 6px 0"><strong>Card ${i + 1}${c.tag ? ` · ${c.tag}` : ""}:</strong></p><p style="margin:0 0 4px 0"><strong>Q:</strong> ${c.front}</p><p style="margin:0;color:#374151"><strong>A:</strong> ${c.back}</p></div>`).join(""));
                      }
                      if (activeView === "quiz" && quiz.length) {
                        return wrapDocHtml("Quiz", quiz.map((q, i) => `<div style="margin-bottom:16px"><p><strong>${i + 1}. ${q.question}</strong></p><ul>${q.options.map((o, oi) => `<li${oi === q.correct ? ' style="color:#059669;font-weight:bold"' : ""}>${o}</li>`).join("")}</ul><p style="color:#6b7280;font-size:10pt"><em>Explanation: ${q.explanation}</em></p></div>`).join(""));
                      }
                      if (activeView === "summary" && summary) {
                        const body = `<p>${summary.overview}</p>` + summary.sections.map(s => `<h2>${s.heading}</h2><ul>${s.points.map(p => `<li>${p}</li>`).join("")}</ul>${s.keyTerms?.length ? `<p>${s.keyTerms.map(t => `<strong>${t.term}:</strong> ${t.definition}`).join(" · ")}</p>` : ""}`).join("") + `<h2>Key Takeaways</h2><ul>${summary.takeaways.map(t => `<li>${t}</li>`).join("")}</ul>`;
                        return wrapDocHtml(summary.title, body);
                      }
                      if (activeView === "studyguide" && studyGuide) {
                        const body = studyGuide.sections.map(s => {
                          if (s.type === "overview") return `<h2>${s.heading}</h2><p>${s.content}</p>`;
                          if (s.type === "concepts") return `<h2>${s.heading}</h2>${s.items.map(item => `<p><strong>${item.name}:</strong> ${item.explanation}${item.example ? ` <em>(e.g. ${item.example})</em>` : ""}</p>`).join("")}`;
                          if (s.type === "process") return `<h2>${s.heading}</h2><ol>${s.steps.map(step => `<li>${step}</li>`).join("")}</ol>`;
                          if (s.type === "tips") return `<h2>${s.heading}</h2><ul>${s.tips.map(t => `<li>${t}</li>`).join("")}</ul>`;
                          return "";
                        }).join("") + (studyGuide.quickRef?.length ? `<h2>Quick Reference</h2><table><thead><tr><th>Term</th><th>Definition</th></tr></thead><tbody>${studyGuide.quickRef.map(r => `<tr><td><strong>${r.label}</strong></td><td>${r.value}</td></tr>`).join("")}</tbody></table>` : "");
                        return wrapDocHtml(studyGuide.title, body);
                      }
                      if (activeView === "slides" && slides) {
                        const body = slides.slides.map(s => `<h2>${s.type === "title" ? "" : `Slide ${s.slideNum}: `}${s.title}</h2>${s.subtitle ? `<p><em>${s.subtitle}</em></p>` : ""}${s.bullets?.length ? `<ul>${s.bullets.map(b => `<li>${b}</li>`).join("")}</ul>` : ""}${s.notes ? `<p style="color:#6b7280;font-size:10pt"><em>Notes: ${s.notes}</em></p>` : ""}`).join("<hr style='margin:20px 0'>");
                        return wrapDocHtml(slides.title, body);
                      }
                      return "";
                    }}
                    getText={() => {
                      if (activeView === "flashcards" && flashcards.length) return flashcards.map((c, i) => `${i + 1}. ${c.front}\n→ ${c.back}`).join("\n\n");
                      if (activeView === "quiz" && quiz.length) return quiz.map((q, i) => `${i + 1}. ${q.question}\n${q.options.map((o, oi) => `  ${String.fromCharCode(65 + oi)}) ${o}${oi === q.correct ? " ✓" : ""}`).join("\n")}\nExplanation: ${q.explanation}`).join("\n\n");
                      if (activeView === "summary" && summary) return `${summary.title}\n\n${summary.overview}\n\n${summary.sections.map(s => `${s.heading}\n${s.points.map(p => `• ${p}`).join("\n")}`).join("\n\n")}\n\nKey Takeaways:\n${summary.takeaways.map(t => `• ${t}`).join("\n")}`;
                      if (activeView === "studyguide" && studyGuide) return `${studyGuide.title}\n\n${studyGuide.sections.map(s => { if (s.type === "overview") return `${s.heading}\n${s.content}`; if (s.type === "concepts") return `${s.heading}\n${s.items.map(i => `• ${i.name}: ${i.explanation}`).join("\n")}`; if (s.type === "process") return `${s.heading}\n${s.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}`; if (s.type === "tips") return `${s.heading}\n${s.tips.map(t => `• ${t}`).join("\n")}`; return ""; }).join("\n\n")}`;
                      if (activeView === "slides" && slides) return slides.slides.map(s => `[Slide ${s.slideNum}] ${s.title}\n${s.bullets?.join("\n") ?? ""}`).join("\n\n");
                      return "";
                    }}
                    filename={makeLsgFilename("study", activeView?.toUpperCase() ?? "STUDY")}
                    formats={["docx", "pdf", "copy"]}
                  />
                </div>
              )}

              {/* Rendered output */}
              {activeView === "flashcards" && (
                <FlashcardsView cards={flashcards} cardIdx={cardIdx} flipped={cardFlipped} mastered={masteredCards}
                  onFlip={() => setCardFlipped((f) => !f)}
                  onPrev={() => { setCardIdx((i) => Math.max(0, i - 1)); setCardFlipped(false); }}
                  onNext={() => { setCardIdx((i) => Math.min(flashcards.length - 1, i + 1)); setCardFlipped(false); }}
                  onMaster={(i) => setMasteredCards((m) => { const n = new Set(m); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                  onGenerate={() => generate("flashcards")} />
              )}
              {activeView === "quiz" && (
                <QuizView questions={quiz} answers={quizAnswers} submitted={quizSubmitted} currentQ={currentQ} score={quizScore}
                  onAnswer={(qi, ai) => setQuizAnswers((p) => { const n = [...p]; n[qi] = ai; return n; })}
                  onNext={() => setCurrentQ((q) => Math.min(quiz.length - 1, q + 1))}
                  onPrev={() => setCurrentQ((q) => Math.max(0, q - 1))}
                  onSubmit={() => { setQuizSubmitted(true); collectWrong(quizAnswers, quiz); }}
                  onRetake={() => { setQuizAnswers([]); setQuizSubmitted(false); setCurrentQ(0); }}
                  onGenerate={() => generate("quiz")}
                  onWeakPoints={wrongTopics.length > 0 ? () => generate("weakpoints") : undefined} />
              )}
              {activeView === "summary"    && <SummaryView    data={summary}    onGenerate={() => generate("summary")} />}
              {activeView === "studyguide" && <StudyGuideView  data={studyGuide} onGenerate={() => generate("studyguide")} />}
              {activeView === "slides"     && (
                <SlidesView data={slides} slideIdx={slideIdx}
                  onPrev={() => setSlideIdx((i) => Math.max(0, i - 1))}
                  onNext={() => setSlideIdx((i) => Math.min((slides?.slides.length ?? 1) - 1, i + 1))}
                  onGenerate={() => generate("slides")} />
              )}
              {activeView === "weakpoints" && (
                <WeakPointsView wrongTopics={wrongTopics} questions={weakQuiz} answers={weakAnswers}
                  submitted={weakSubmitted} currentQ={weakCurrentQ} score={weakScore}
                  onAnswer={(qi, ai) => setWeakAnswers((p) => { const n = [...p]; n[qi] = ai; return n; })}
                  onNext={() => setWeakCurrentQ((q) => Math.min(weakQuiz.length - 1, q + 1))}
                  onPrev={() => setWeakCurrentQ((q) => Math.max(0, q - 1))}
                  onSubmit={() => { setWeakSubmitted(true); collectWrong(weakAnswers, weakQuiz); }}
                  onRetake={() => { setWeakAnswers([]); setWeakSubmitted(false); setWeakCurrentQ(0); }}
                  onClear={() => setWrongTopics([])}
                  onGenerate={() => generate("weakpoints")} />
              )}
            </div>
          )}

          <div className="h-28" />
        </div>
      </div>

      {/* ── FLOATING CHAT BUBBLE (Gauth-style) ────────────────────────── */}

      {/* Wrapper — vertically centered on right edge, clear of Tidio at bottom-right */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-end gap-3">

      {/* Floating panel */}
      {chatOpen && (
        <div className="w-80 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: "min(500px, 60vh)" }}>

          {/* Panel header */}
          <div className="shrink-0 px-4 pt-3.5 pb-3 border-b border-border">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Brain size={13} className="text-primary" />
                </div>
                <span className="text-xs font-semibold text-foreground">AI Tutor</span>
                {chatMessages.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {chatMessages.filter((m) => m.role === "user").length} messages
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => { setChatMessages([]); setChatSessionId(undefined); }}
                  title="New chat"
                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors px-1.5 py-0.5 rounded-md hover:bg-muted">
                  <Plus size={10} /> New
                </button>
                <button onClick={() => setChatOpen(false)}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5">
                  <X size={13} />
                </button>
              </div>
            </div>
            {/* Mode pills */}
            <div className="flex gap-1">
              {(["tutor", "explain", "quiz", "summarize"] as const).map((m) => (
                <button key={m} onClick={() => setChatMode(m)}
                  className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium capitalize transition-colors",
                    chatMode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 min-h-0">
            {!chatMessages.length && (
              <div className="space-y-2.5">
                <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                  {hasContent
                    ? `Ask me anything about your ${selectedSubject} material`
                    : "Ask any study question — I'll guide you"}
                </p>
                {hasContent && ["Summarize key concepts", "Quiz me on this", "What should I focus on?"].map((s) => (
                  <button key={s} onClick={() => sendChat(s)}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent hover:border-border transition-all">
                    {s}
                  </button>
                ))}
                {(sessions?.sessions?.length ?? 0) > 0 && (
                  <div className="pt-1">
                    <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest mb-1">Recent</p>
                    {sessions!.sessions.slice(0, 3).map((s: { id: number; title: string }) => (
                      <button key={s.id}
                        onClick={() => { setChatSessionId(s.id); setChatMessages([]); }}
                        className={cn("w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-colors truncate",
                          chatSessionId === s.id ? "text-foreground bg-muted" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/40")}>
                        {s.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Brain size={10} className="text-primary" />
                  </div>
                )}
                <div className="max-w-[86%] space-y-1">
                  <div className={cn("px-3 py-2 rounded-xl text-[11px] leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm")}>
                    {msg.role === "assistant"
                      ? <MathRenderer text={msg.content} className={`text-[11px] ${msg.content.includes("$") ? "font-handwritten" : ""}`} />
                      : msg.content}
                  </div>
                  {msg.role === "assistant" && msg.followUpQuestions?.slice(0, 2).map((q, qi) => (
                    <button key={qi} onClick={() => sendChat(q)}
                      className="block w-full text-left text-[10px] px-2 py-1 rounded-lg text-primary/60 hover:text-primary hover:bg-primary/5 transition-colors">
                      ↳ {q}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {askAssistant.isPending && (
              <div className="flex gap-2">
                <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Brain size={10} className="text-primary" />
                </div>
                <div className="bg-muted px-3 py-2 rounded-xl rounded-bl-sm flex gap-1 items-center">
                  {[0,1,2].map((d) => (
                    <div key={d} className="w-1 h-1 rounded-full bg-muted-foreground/40 animate-bounce"
                      style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="shrink-0 px-3 pb-3 pt-2 border-t border-border">
            <div className="flex items-end gap-2 bg-muted/50 rounded-xl px-3 py-2 focus-within:bg-muted transition-colors">
              <textarea ref={chatInputRef} value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                rows={1} placeholder="Ask a follow-up question…"
                className="flex-1 bg-transparent text-[11px] resize-none focus:outline-none leading-relaxed text-foreground placeholder:text-muted-foreground/50"
                style={{ minHeight: "18px", maxHeight: "100px" }}
              />
              <button onClick={() => sendChat()} disabled={!chatInput.trim() || askAssistant.isPending}
                className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 shrink-0 transition-opacity">
                {askAssistant.isPending ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setChatOpen((o) => !o)}
        className={cn(
          "w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-all duration-200 relative",
          chatOpen
            ? "bg-foreground text-background scale-95"
            : "bg-primary text-primary-foreground hover:scale-105 hover:shadow-xl"
        )}
        title={chatOpen ? "Close AI Tutor" : "Open AI Tutor"}
      >
        {chatOpen
          ? <X size={18} />
          : <MessageSquare size={18} />}
        {!chatOpen && chatMessages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background text-[8px] text-white font-bold flex items-center justify-center">
            {chatMessages.filter((m) => m.role === "user").length}
          </span>
        )}
      </button>

      </div>{/* end floating wrapper */}

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

// ── Flashcards ─────────────────────────────────────────────────────────────

function FlashcardsView({ cards, cardIdx, flipped, mastered, onFlip, onPrev, onNext, onMaster, onGenerate }: {
  cards: Flashcard[]; cardIdx: number; flipped: boolean; mastered: Set<number>;
  onFlip: () => void; onPrev: () => void; onNext: () => void;
  onMaster: (i: number) => void; onGenerate: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); onFlip(); }
      else if (e.key.toLowerCase() === "m") onMaster(cardIdx);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [cardIdx, onNext, onPrev, onFlip, onMaster]);

  if (!cards.length) return <EmptyTab label="Generate flashcards from your content" onGenerate={onGenerate} />;
  const card = cards[cardIdx];
  const pct = Math.round(((cardIdx + 1) / cards.length) * 100);

  return (
    <div className="space-y-5">
      {/* Progress bar + stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 mr-4">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{cardIdx + 1} / {cards.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {mastered.size > 0 && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 size={11} /> {mastered.size} mastered
            </span>
          )}
        </div>
      </div>

      {card.tag && (
        <span className="inline-block text-[10px] font-semibold text-primary/60 uppercase tracking-widest px-2 py-0.5 rounded-md bg-primary/8">
          {card.tag}
        </span>
      )}

      {/* Flip card */}
      <div onClick={onFlip} style={{ perspective: "1400px" }} className="cursor-pointer select-none">
        <div
          className="relative transition-transform duration-500 rounded-2xl"
          style={{
            height: "clamp(200px, 30vh, 300px)",
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-2xl border border-border bg-card flex flex-col items-center justify-center p-8 text-center shadow-sm"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-5">Question</p>
            <p className="text-lg font-semibold text-foreground leading-snug max-w-sm">{card.front}</p>
            <div className="mt-6 flex items-center gap-1.5 text-[11px] text-muted-foreground/30">
              <FlipHorizontal2 size={12} /> <span>Tap or press Space to flip</span>
            </div>
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 rounded-2xl bg-primary/6 border border-primary/20 flex flex-col items-center justify-center p-8 text-center shadow-sm"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 mb-5">Answer</p>
            <MathRenderer
              text={card.back}
              className={`text-base text-foreground leading-relaxed max-w-sm ${card.back.includes("$") ? "font-handwritten" : ""}`}
            />
          </div>
        </div>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onPrev} disabled={cardIdx === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-all"
        >
          <ChevronLeft size={14} /> Previous
        </button>

        <button
          onClick={() => onMaster(cardIdx)}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all",
            mastered.has(cardIdx)
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "border-border text-muted-foreground hover:border-emerald-400/40 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/5"
          )}
        >
          <Star size={13} className={mastered.has(cardIdx) ? "fill-current" : ""} />
          {mastered.has(cardIdx) ? "Mastered" : "Mark mastered"}
        </button>

        <button
          onClick={onNext} disabled={cardIdx === cards.length - 1}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-all"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>

      {/* Keyboard hint bar */}
      <div className="flex items-center justify-center gap-4 py-2 border-t border-border/50">
        {[
          { key: "← →", label: "Navigate" },
          { key: "Space", label: "Flip" },
          { key: "M", label: "Mark mastered" },
        ].map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground/60 font-mono text-[9px] border border-border/60">{key}</kbd>
            {label}
          </span>
        ))}
      </div>

      {/* Card overview strip */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 pt-1">
        {cards.map((c, i) => (
          <div
            key={i}
            className={cn(
              "px-2.5 py-2 rounded-xl text-[11px] text-left border",
              i === cardIdx
                ? "bg-primary/8 text-foreground border-primary/30 font-medium"
                : mastered.has(i)
                ? "text-muted-foreground/30 border-border/20 line-through"
                : "bg-muted/20 text-muted-foreground border-transparent"
            )}
          >
            <span className="text-[9px] text-muted-foreground/40 block mb-0.5 tabular-nums">{i + 1}</span>
            <span className="block truncate">{c.front}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Quiz ───────────────────────────────────────────────────────────────────

function QuizView({ questions, answers, submitted, currentQ, score, onAnswer, onNext, onPrev, onSubmit, onRetake, onGenerate, onWeakPoints }: {
  questions: QuizQuestion[]; answers: (number | null)[]; submitted: boolean;
  currentQ: number; score: number;
  onAnswer: (qi: number, ai: number) => void; onNext: () => void; onPrev: () => void;
  onSubmit: () => void; onRetake: () => void; onGenerate: () => void;
  onWeakPoints?: () => void;
}) {
  useEffect(() => {
    if (submitted) return;
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = parseInt(e.key);
      if (n >= 1 && n <= 4) onAnswer(currentQ, n - 1);
      else if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onPrev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [submitted, currentQ, onAnswer, onNext, onPrev]);

  if (!questions.length) return <EmptyTab label="Generate a quiz from your content" onGenerate={onGenerate} />;
  if (submitted) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="space-y-6">
        <div className="text-center py-4">
          <div className={cn("text-5xl font-bold mb-1", pct >= 80 ? "text-emerald-500" : pct >= 60 ? "text-yellow-500" : "text-red-500")}>{pct}%</div>
          <p className="text-sm text-muted-foreground">{score} of {questions.length} correct</p>
        </div>
        <div className="space-y-4">
          {questions.map((q, i) => {
            const correct = answers[i] === q.correct;
            return (
              <div key={i} className="space-y-2">
                <div className="flex items-start gap-2">
                  {correct ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /> : <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />}
                  <p className="text-sm text-foreground">{q.question}</p>
                </div>
                {!correct && (
                  <div className="pl-5 space-y-1">
                    {answers[i] !== null && <p className="text-xs text-red-400">Your answer: {q.options[answers[i]!]}</p>}
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Correct: {q.options[q.correct]}</p>
                    {q.explanation && <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 pt-2 flex-wrap">
          <button onClick={onRetake} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm hover:bg-muted transition-colors">
            <RotateCcw size={13} /> Retake
          </button>
          {onWeakPoints && (
            <button onClick={onWeakPoints} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50/5 transition-colors">
              <Target size={13} /> Weak Points
            </button>
          )}
          <button onClick={onGenerate} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
            <Zap size={13} /> New Quiz
          </button>
        </div>
      </div>
    );
  }
  const q = questions[currentQ];
  const allAnswered = questions.every((_, i) => answers[i] != null);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${(answers.filter((a) => a != null).length / questions.length) * 100}%` }} />
        </div>
        <span>{currentQ + 1} / {questions.length}</span>
      </div>
      <div className="space-y-5">
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-widest">Question {currentQ + 1} of {questions.length}</p>
          <p className="text-base font-semibold text-foreground leading-snug">{q.question}</p>
        </div>
        <div className="space-y-2.5">
          {q.options.map((opt, oi) => {
            const letter = String.fromCharCode(65 + oi);
            const selected = answers[currentQ] === oi;
            return (
              <button key={oi} onClick={() => onAnswer(currentQ, oi)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl text-sm transition-all flex items-center gap-3 border",
                  selected
                    ? "bg-primary/8 text-foreground font-medium border-primary/40 ring-1 ring-primary/20"
                    : "bg-card text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground hover:border-border/80"
                )}>
                <span className={cn(
                  "w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 transition-colors",
                  selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {letter}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between pt-2">
        <button onClick={onPrev} disabled={currentQ === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-all">
          <ChevronLeft size={14} /> Prev
        </button>
        {currentQ < questions.length - 1
          ? <button onClick={onNext} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">Next <ChevronRight size={14} /></button>
          : <button onClick={onSubmit} disabled={!allAnswered} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity">Submit answers <CheckCircle2 size={13} /></button>}
      </div>
      {/* Keyboard hint */}
      <div className="flex items-center justify-center gap-4 py-2 border-t border-border/50">
        {[
          { key: "1 – 4", label: "Select answer" },
          { key: "← →", label: "Navigate" },
        ].map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground/60 font-mono text-[9px] border border-border/60">{key}</kbd>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Summary ────────────────────────────────────────────────────────────────

function SummaryView({ data, onGenerate }: { data: SummaryData | null; onGenerate: () => void }) {
  if (!data) return <EmptyTab label="Generate a summary from your content" onGenerate={onGenerate} />;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">{data.title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{data.overview}</p>
      </div>
      {data.sections.map((sec, i) => (
        <div key={i} className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{sec.heading}</h3>
          <ul className="space-y-2">
            {sec.points.map((pt, pi) => (
              <li key={pi} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="text-primary/60 shrink-0 mt-1 text-[10px]">▪</span>
                <MathRenderer text={pt} className="text-sm leading-relaxed" />
              </li>
            ))}
          </ul>
          {sec.keyTerms?.length ? (
            <div className="pl-4 space-y-1.5 pt-1">
              {sec.keyTerms.map((kt, ki) => (
                <div key={ki} className="flex gap-2 text-xs">
                  <span className="font-semibold text-foreground shrink-0">{kt.term}:</span>
                  <span className="text-muted-foreground">{kt.definition}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      {data.takeaways.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">Key Takeaways</p>
          {data.takeaways.map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle2 size={13} className="text-primary/60 shrink-0 mt-0.5" />
              <span className="text-foreground">{t}</span>
            </div>
          ))}
        </div>
      )}
      {data.relatedConcepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.relatedConcepts.map((c, i) => (
            <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{c}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Study Guide ────────────────────────────────────────────────────────────

const SECTION_TYPE_ICONS: Record<string, React.ReactNode> = {
  overview:  <BookOpen size={13} />,
  concepts:  <Brain size={13} />,
  process:   <Target size={13} />,
  tips:      <Star size={13} />,
};

function StudyGuideView({ data, onGenerate }: { data: StudyGuideData | null; onGenerate: () => void }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  if (!data) return <EmptyTab label="Generate a study guide from your content" onGenerate={onGenerate} />;

  const allExpanded = expanded.size === data.sections.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground leading-snug">{data.title}</h2>
        <button
          onClick={() => setExpanded(allExpanded ? new Set() : new Set(data.sections.map((_, i) => i)))}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted/50 transition-colors shrink-0"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>
      {data.sections.map((sec, i) => (
        <div key={i}>
          <button onClick={() => setExpanded((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}
            className="w-full flex items-center justify-between py-2 text-sm font-semibold text-foreground hover:text-primary transition-colors group">
            <span className="flex items-center gap-2">
              {sec.type && SECTION_TYPE_ICONS[sec.type] && (
                <span className="text-primary/50 group-hover:text-primary/80 transition-colors">
                  {SECTION_TYPE_ICONS[sec.type]}
                </span>
              )}
              {sec.heading}
            </span>
            {expanded.has(i) ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>
          <div className="h-px bg-border" />
          {expanded.has(i) && (
            <div className="pt-4 pb-2">
              {sec.type === "overview"  && <p className="text-sm text-muted-foreground leading-relaxed">{renderInlineMd(sec.content)}</p>}
              {sec.type === "concepts"  && (
                <div className="space-y-4">
                  {sec.items.map((item, ii) => (
                    <div key={ii}>
                      <p className="text-sm font-semibold text-foreground mb-1">{renderInlineMd(item.name)}</p>
                      <p className="text-sm text-muted-foreground">{renderInlineMd(item.explanation)}</p>
                      {item.example && <p className="text-xs text-primary/70 mt-1 italic">e.g. {renderInlineMd(item.example)}</p>}
                    </div>
                  ))}
                </div>
              )}
              {sec.type === "process" && (
                <ol className="space-y-3">
                  {sec.steps.map((step, si) => {
                    const hasMath = step.includes("$") || /\d[\+\-\*\/=]\d/.test(step);
                    return (
                      <li key={si} className="flex items-start gap-3">
                        <span className="handwritten-step-num mt-0.5 shrink-0">{si + 1}</span>
                        {hasMath ? (
                          <div className="handwritten-block flex-1">
                            <MathRenderer text={step} className="text-sm" />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground leading-relaxed">{renderInlineMd(step)}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {sec.type === "tips" && (
                <ul className="space-y-2">
                  {sec.tips.map((tip, ti) => (
                    <li key={ti} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Star size={11} className="text-yellow-500 fill-yellow-500 shrink-0 mt-1" /> {renderInlineMd(tip)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}
      {data.quickRef?.length ? (
        <div className="space-y-2 pt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">Quick Reference</p>
          {data.quickRef.map((ref, i) => (
            <div key={i} className="flex gap-4 text-xs">
              <span className="font-mono text-foreground shrink-0 min-w-[130px]">{ref.label}</span>
              <span className="font-mono text-muted-foreground">{ref.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Slides ─────────────────────────────────────────────────────────────────

const SLIDE_THEMES: Record<string, { bg: string; titleColor: string; textColor: string; accent: string }> = {
  title:      { bg: "bg-gradient-to-br from-slate-900 via-primary/80 to-slate-800", titleColor: "text-white", textColor: "text-white/70", accent: "bg-white/20" },
  agenda:     { bg: "bg-gradient-to-br from-slate-800 to-slate-700", titleColor: "text-white", textColor: "text-white/75", accent: "bg-white/15" },
  content:    { bg: "bg-card", titleColor: "text-foreground", textColor: "text-muted-foreground", accent: "bg-primary/8" },
  conclusion: { bg: "bg-gradient-to-br from-primary/20 via-primary/5 to-transparent", titleColor: "text-foreground", textColor: "text-muted-foreground", accent: "bg-primary/10" },
};

function SlidesView({ data, slideIdx, onPrev, onNext, onGenerate }: {
  data: SlideData | null; slideIdx: number;
  onPrev: () => void; onNext: () => void; onGenerate: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") onNext();
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") onPrev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onNext, onPrev]);

  if (!data?.slides.length) return <EmptyTab label="Generate a slide deck from your content" onGenerate={onGenerate} />;

  const slide = data.slides[slideIdx];
  const total = data.slides.length;
  const theme = SLIDE_THEMES[slide.type] ?? SLIDE_THEMES.content;
  const isDark = slide.type === "title" || slide.type === "agenda";

  return (
    <div className="space-y-4">
      {/* Slide deck header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">{data.title}</p>
          <p className="text-[11px] text-muted-foreground/60">{total} slides</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground/60 font-mono text-[9px] border border-border/60">← →</kbd>
          Navigate
        </div>
      </div>

      {/* Main slide canvas */}
      <div
        className={cn("rounded-2xl overflow-hidden border border-border/50 shadow-lg", theme.bg)}
        style={{ aspectRatio: "16/9", display: "flex", flexDirection: "column", position: "relative" }}
      >
        {/* Slide number badge */}
        <div className={cn(
          "absolute top-4 right-4 px-2 py-0.5 rounded-full text-[10px] font-mono",
          isDark ? "bg-white/10 text-white/50" : "bg-black/6 text-foreground/40"
        )}>
          {slideIdx + 1} / {total}
        </div>

        {slide.type === "title" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 sm:p-14 text-center">
            <p className={cn("text-2xl sm:text-3xl font-bold leading-tight mb-3", theme.titleColor)}>{slide.title}</p>
            {slide.subtitle && <p className={cn("text-sm sm:text-base mt-2 leading-relaxed", theme.textColor)}>{slide.subtitle}</p>}
            <div className={cn("mt-6 w-16 h-0.5 rounded-full opacity-40", isDark ? "bg-white" : "bg-primary")} />
          </div>
        ) : slide.type === "agenda" ? (
          <div className="flex-1 flex flex-col p-7 sm:p-10">
            <p className={cn("text-lg font-bold mb-6", theme.titleColor)}>{slide.title}</p>
            <div className="space-y-3">
              {slide.bullets?.map((b, bi) => (
                <div key={bi} className="flex items-center gap-3">
                  <span className={cn("w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0", theme.accent, theme.textColor)}>{bi + 1}</span>
                  <p className={cn("text-sm font-medium", theme.textColor)}>{b}</p>
                </div>
              ))}
            </div>
          </div>
        ) : slide.type === "conclusion" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className={cn("w-10 h-10 rounded-xl mb-4 flex items-center justify-center", theme.accent)}>
              <CheckCircle2 size={20} className="text-primary" />
            </div>
            <p className={cn("text-xl font-bold mb-4", theme.titleColor)}>{slide.title}</p>
            {slide.bullets && slide.bullets.length > 0 && (
              <div className="space-y-2 max-w-sm">
                {slide.bullets.map((b, bi) => (
                  <p key={bi} className={cn("text-sm leading-relaxed", theme.textColor)}>{b}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-7 sm:p-10">
            <div className={cn("w-8 h-1 rounded-full mb-4", "bg-primary/40")} />
            <p className={cn("text-base sm:text-lg font-bold mb-5", theme.titleColor)}>{slide.title}</p>
            <div className="space-y-3 flex-1">
              {slide.bullets?.map((b, bi) => (
                <div key={bi} className="flex items-start gap-3">
                  <div className={cn("w-1.5 h-1.5 rounded-full mt-2 shrink-0", "bg-primary/50")} />
                  <p className={cn("text-sm leading-relaxed", theme.textColor)}>{b}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Speaker notes */}
      {slide.notes && (
        <div className="flex gap-3 px-4 py-3 rounded-xl bg-amber-50/5 border border-amber-200/20">
          <div className="w-1 bg-amber-400/40 rounded-full shrink-0 self-stretch" />
          <div>
            <p className="text-[10px] font-semibold text-amber-600/60 dark:text-amber-400/60 uppercase tracking-widest mb-1">Speaker Notes</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{slide.notes}</p>
          </div>
        </div>
      )}

      {/* Navigation controls */}
      <div className="flex items-center gap-3">
        <button onClick={onPrev} disabled={slideIdx === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-all">
          <ChevronLeft size={14} /> Prev
        </button>
        <div className="flex-1 flex gap-1 justify-center">
          {data.slides.map((_, i) => (
            <div key={i} className={cn("h-1.5 rounded-full transition-all cursor-default",
              i === slideIdx ? "w-5 bg-primary" : "w-1.5 bg-muted hover:bg-muted-foreground/30")} />
          ))}
        </div>
        <button onClick={onNext} disabled={slideIdx === total - 1}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-all">
          Next <ChevronRight size={14} />
        </button>
      </div>

      {/* Slide thumbnail strip */}
      <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/50">
        <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-4 py-2 bg-muted/20">All slides</p>
        {data.slides.map((s, i) => (
          <button key={i} onClick={() => { for (let k = slideIdx; k < i; k++) onNext(); for (let k = slideIdx; k > i; k--) onPrev(); }}
            className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-colors text-left",
              i === slideIdx ? "bg-primary/6 text-foreground" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/30")}>
            <span className="font-mono text-[10px] w-5 text-right shrink-0 text-muted-foreground/40">{i + 1}</span>
            <span className={cn("w-2 h-2 rounded-sm shrink-0",
              s.type === "title" ? "bg-primary/60" :
              s.type === "agenda" ? "bg-slate-400/60" :
              s.type === "conclusion" ? "bg-emerald-400/60" : "bg-border")} />
            <span className="truncate flex-1">{s.title}</span>
            <span className="text-[9px] text-muted-foreground/30 shrink-0 capitalize">{s.type}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Weak Points ────────────────────────────────────────────────────────────

function WeakPointsView({ wrongTopics, questions, answers, submitted, currentQ, score, onAnswer, onNext, onPrev, onSubmit, onRetake, onClear, onGenerate }: {
  wrongTopics: string[]; questions: QuizQuestion[]; answers: (number | null)[];
  submitted: boolean; currentQ: number; score: number;
  onAnswer: (qi: number, ai: number) => void; onNext: () => void; onPrev: () => void;
  onSubmit: () => void; onRetake: () => void; onClear: () => void; onGenerate: () => void;
}) {
  if (!wrongTopics.length) {
    return (
      <div className="text-center py-12 space-y-3">
        <Target size={32} className="text-muted-foreground/20 mx-auto" />
        <p className="text-sm text-muted-foreground">No weak points tracked yet.</p>
        <p className="text-xs text-muted-foreground/60">Complete a quiz to identify your weak areas.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {wrongTopics.map((t, i) => (
          <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">{t}</span>
        ))}
        <button onClick={onClear} className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors">Clear all</button>
      </div>
      {!questions.length
        ? <button onClick={onGenerate} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
            <Zap size={14} /> Generate Weak Points Quiz
          </button>
        : <QuizView questions={questions} answers={answers} submitted={submitted} currentQ={currentQ} score={score}
            onAnswer={onAnswer} onNext={onNext} onPrev={onPrev} onSubmit={onSubmit} onRetake={onRetake} onGenerate={onGenerate} />}
    </div>
  );
}

// ── Empty tab ──────────────────────────────────────────────────────────────

function EmptyTab({ label, onGenerate }: { label: string; onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <Sparkles size={28} className="text-muted-foreground/20" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <button onClick={onGenerate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
        <Zap size={13} /> Generate
      </button>
    </div>
  );
}
