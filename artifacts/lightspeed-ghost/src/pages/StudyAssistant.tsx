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
  Image as ImageIcon, Plus, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MathRenderer from "@/components/MathRenderer";

const API = import.meta.env.VITE_API_URL ?? "";

// ── Types ──────────────────────────────────────────────────────────────────

type SourceType = "doc" | "image" | "text";
interface StudySource {
  id: string; name: string; type: SourceType;
  content: string; wordCount: number;
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
  { key: "flashcards", label: "Flashcards",  icon: <FlipHorizontal2 size={14} />, desc: "Interactive flip cards" },
  { key: "quiz",       label: "Quiz",        icon: <GraduationCap size={14} />,   desc: "Multiple-choice test" },
  { key: "summary",    label: "Summary",     icon: <BookMarked size={14} />,      desc: "Key points overview" },
  { key: "studyguide", label: "Study Guide", icon: <BookOpen size={14} />,        desc: "Full learning guide" },
  { key: "slides",     label: "Slides",      icon: <Presentation size={14} />,   desc: "Presentation deck" },
];

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "History",
  "English Literature", "Geography", "Computer Science", "Economics",
  "Psychology", "Sociology", "Business Studies", "Art & Design",
  "Music", "Languages", "Political Science", "Philosophy",
  "Environmental Science", "Statistics", "Medicine", "Law", "General",
];

const PROGRESS_STEPS: Record<OutputType, string[]> = {
  flashcards: [
    "Reading your material…",
    "Identifying key concepts and terms…",
    "Crafting front and back of each card…",
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
    "Composing takeaways…",
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
  sources.forEach((s) => parts.push(`[${s.name}]\n${s.content}`));
  return parts.join("\n\n---\n\n");
}

async function callGenerate(
  content: string,
  type: OutputType | "weakpoints",
  subject: string,
  weakTopics?: string[],
  token?: string | null,
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}/api/study/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content, type, subject, weakTopics }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Main component ─────────────────────────────────────────────────────────

export default function StudyAssistant() {
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const chatEndRef    = useRef<HTMLDivElement>(null);
  const chatInputRef  = useRef<HTMLTextAreaElement>(null);
  const queryClient   = useQueryClient();
  const askAssistant  = useAskStudyAssistant();
  const { data: sessions } = useListStudySessions();

  // Input state
  const [topic,           setTopic]           = useState("");
  const [selectedType,    setSelectedType]    = useState<OutputType>("flashcards");
  const [selectedSubject, setSelectedSubject] = useState("General");
  const [subjectOpen,     setSubjectOpen]     = useState(false);

  // Sources (uploaded files)
  const [sources,   setSources]   = useState<StudySource[]>([]);
  const [uploading, setUploading] = useState(false);

  // Generation state
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [progressStep,   setProgressStep]   = useState(0);
  const [generateError,  setGenerateError]  = useState<string | null>(null);
  const [activeView,     setActiveView]     = useState<ActiveView>(null);

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

  // Chat
  const [chatInput,     setChatInput]     = useState("");
  const [chatMessages,  setChatMessages]  = useState<ChatMsg[]>([]);
  const [chatSessionId, setChatSessionId] = useState<number | undefined>();
  const [chatMode,      setChatMode]      = useState<"tutor" | "explain" | "quiz" | "summarize">("tutor");

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, askAssistant.isPending]);
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

  // ── Upload ────────────────────────────────────────────────────────────

  const uploadDoc = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/files/extract`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Failed to extract");
      const data = await res.json();
      setSources((prev) => [...prev, {
        id: uid(), name: file.name,
        type: file.type.startsWith("image/") ? "image" : "doc",
        content: data.text ?? "", wordCount: data.wordCount ?? 0,
      }]);
    } catch { /* silent */ } finally { setUploading(false); }
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const f of Array.from(e.target.files ?? [])) await uploadDoc(f);
    e.target.value = "";
  }, [uploadDoc]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    for (const f of Array.from(e.dataTransfer.files)) await uploadDoc(f);
  }, [uploadDoc]);

  // ── Generate ──────────────────────────────────────────────────────────

  const generate = useCallback(async (type: OutputType | "weakpoints" = selectedType) => {
    const content = mergedContent(topic, sources);
    if (!content.trim()) {
      setGenerateError("Enter a topic or upload notes before generating.");
      return;
    }
    setIsGenerating(true);
    setGenerateError(null);
    setProgressStep(0);
    setActiveView(type as ActiveView);
    try {
      const r = await callGenerate(
        content,
        type,
        selectedSubject,
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

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── TOP HEADER ────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-b border-border bg-card">
        <Zap size={14} className="text-primary" />
        <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
        <span className="text-muted-foreground/30 mx-1">·</span>
        <span className="text-sm font-semibold text-foreground">AI Study Assistant</span>
      </div>

      {/* ── BODY (2 columns) ──────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT / CENTER: Input + Output ─────────────────────────── */}
        <div
          className="flex-1 flex flex-col min-w-0 overflow-y-auto"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="max-w-2xl w-full mx-auto px-6 py-6 flex flex-col gap-5">

            {/* ── 1. MAIN TOPIC TEXTAREA (Gauth-style) ─────────────── */}
            <div className="rounded-2xl border border-border bg-card shadow-sm focus-within:border-primary/50 focus-within:shadow-primary/5 transition-all">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter a topic, question, or paste your notes here…&#10;&#10;Example: Explain photosynthesis, or paste your chapter notes…"
                rows={6}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none px-5 pt-4 pb-3 leading-relaxed"
              />
              <div className="flex items-center gap-2 px-4 pb-3">
                <span className="text-[11px] text-muted-foreground/40">
                  {topic.trim() ? `${topic.trim().split(/\s+/).length} words` : "Type or paste above, or upload notes below"}
                </span>
                {topic.trim() && (
                  <button onClick={() => setTopic("")} className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors ml-auto">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* ── 2. UPLOAD NOTES ───────────────────────────────────── */}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="sr-only"
                accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
                onChange={handleFileInput}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-muted/30 text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-50 w-full"
              >
                {uploading
                  ? <Loader2 size={14} className="animate-spin text-primary shrink-0" />
                  : <Upload size={14} className="shrink-0" />}
                <span>{uploading ? "Uploading…" : "Upload notes, PDF or DOCX"}</span>
                <span className="ml-auto text-[11px] text-muted-foreground/40">PDF · DOCX · TXT · Image</span>
              </button>

              {sources.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sources.map((src) => (
                    <div key={src.id} className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground">
                      {src.type === "image"
                        ? <ImageIcon size={11} className="text-blue-400" />
                        : <FileText size={11} />}
                      <span className="max-w-[140px] truncate">{src.name}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-muted-foreground/50">{src.wordCount.toLocaleString()}w</span>
                      <button
                        onClick={() => setSources((p) => p.filter((s) => s.id !== src.id))}
                        className="opacity-0 group-hover:opacity-100 ml-0.5 text-muted-foreground/40 hover:text-destructive transition-all">
                        <XCircle size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── 3. OUTPUT TYPE SELECTOR ───────────────────────────── */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Generate</p>
              <div className="grid grid-cols-5 gap-2">
                {OUTPUT_TYPES.map(({ key, label, icon, desc }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedType(key)}
                    className={cn(
                      "flex flex-col items-center gap-2 px-2 py-3 rounded-xl border text-center transition-all",
                      selectedType === key
                        ? "border-primary bg-primary/5 text-foreground shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    <span className={selectedType === key ? "text-primary" : ""}>{icon}</span>
                    <span className="text-[11px] font-semibold leading-tight">{label}</span>
                    <span className="text-[9px] text-muted-foreground/60 leading-tight hidden sm:block">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── 4. SUBJECT SELECTOR ───────────────────────────────── */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</p>
              <div className="relative">
                <button
                  onClick={() => setSubjectOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground hover:border-primary/30 transition-colors"
                >
                  <span>{selectedSubject}</span>
                  <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", subjectOpen && "rotate-180")} />
                </button>
                {subjectOpen && (
                  <div className="absolute z-20 top-full mt-1.5 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                    <div className="max-h-52 overflow-y-auto py-1">
                      {SUBJECTS.map((s) => (
                        <button
                          key={s}
                          onClick={() => { setSelectedSubject(s); setSubjectOpen(false); }}
                          className={cn(
                            "w-full text-left px-4 py-2 text-sm transition-colors",
                            selectedSubject === s
                              ? "text-foreground bg-primary/5 font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── 5. GENERATE BUTTON ────────────────────────────────── */}
            <button
              onClick={() => generate()}
              disabled={isGenerating || !hasContent}
              className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 shadow-sm"
            >
              {isGenerating
                ? <Loader2 size={15} className="animate-spin" />
                : <Zap size={15} />}
              {isGenerating ? "Generating…" : `Generate ${OUTPUT_TYPES.find((t) => t.key === selectedType)?.label ?? "Content"}`}
            </button>

            {/* ── 6. PROGRESS DISPLAY ───────────────────────────────── */}
            {isGenerating && (
              <div className="rounded-xl border border-border bg-muted/20 px-5 py-4 space-y-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={11} className="text-primary animate-pulse" />
                  <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI is working</span>
                </div>
                {progressSteps.map((step, i) => {
                  const done = i < progressStep;
                  const active = i === progressStep;
                  const pending = i > progressStep;
                  return (
                    <div key={i} className={cn("flex items-center gap-3 text-xs transition-all",
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
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/8 text-destructive text-xs border border-destructive/20">
                <AlertTriangle size={13} className="shrink-0" />
                <span>{generateError}</span>
                <button onClick={() => setGenerateError(null)} className="ml-auto opacity-60 hover:opacity-100">
                  <XCircle size={12} />
                </button>
              </div>
            )}

            {/* ── 7. OUTPUT AREA ────────────────────────────────────── */}
            {activeView && !isGenerating && (
              <div className="border-t border-border pt-5 space-y-4">
                {/* Output type tabs (to switch between generated outputs) */}
                <div className="flex items-center gap-1 flex-wrap">
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
                      <button
                        key={key}
                        onClick={() => setActiveView(key)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                          activeView === key
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {icon} {label}
                      </button>
                    );
                  })}
                  {weakQuiz.length > 0 && (
                    <button
                      onClick={() => setActiveView("weakpoints")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                        activeView === "weakpoints"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Target size={11} /> Weak Points
                    </button>
                  )}
                </div>

                {/* Rendered output */}
                {activeView === "flashcards" && (
                  <FlashcardsView
                    cards={flashcards} cardIdx={cardIdx} flipped={cardFlipped} mastered={masteredCards}
                    onFlip={() => setCardFlipped((f) => !f)}
                    onPrev={() => { setCardIdx((i) => Math.max(0, i - 1)); setCardFlipped(false); }}
                    onNext={() => { setCardIdx((i) => Math.min(flashcards.length - 1, i + 1)); setCardFlipped(false); }}
                    onMaster={(i) => setMasteredCards((m) => { const n = new Set(m); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                    onGenerate={() => generate("flashcards")}
                  />
                )}
                {activeView === "quiz" && (
                  <QuizView
                    questions={quiz} answers={quizAnswers} submitted={quizSubmitted} currentQ={currentQ} score={quizScore}
                    onAnswer={(qi, ai) => setQuizAnswers((p) => { const n = [...p]; n[qi] = ai; return n; })}
                    onNext={() => setCurrentQ((q) => Math.min(quiz.length - 1, q + 1))}
                    onPrev={() => setCurrentQ((q) => Math.max(0, q - 1))}
                    onSubmit={() => { setQuizSubmitted(true); collectWrong(quizAnswers, quiz); }}
                    onRetake={() => { setQuizAnswers([]); setQuizSubmitted(false); setCurrentQ(0); }}
                    onGenerate={() => generate("quiz")}
                    onWeakPoints={wrongTopics.length > 0 ? () => generate("weakpoints") : undefined}
                  />
                )}
                {activeView === "summary"    && <SummaryView    data={summary}    onGenerate={() => generate("summary")} />}
                {activeView === "studyguide" && <StudyGuideView  data={studyGuide} onGenerate={() => generate("studyguide")} />}
                {activeView === "slides"     && (
                  <SlidesView data={slides} slideIdx={slideIdx}
                    onPrev={() => setSlideIdx((i) => Math.max(0, i - 1))}
                    onNext={() => setSlideIdx((i) => Math.min((slides?.slides.length ?? 1) - 1, i + 1))}
                    onGenerate={() => generate("slides")}
                  />
                )}
                {activeView === "weakpoints" && (
                  <WeakPointsView
                    wrongTopics={wrongTopics} questions={weakQuiz} answers={weakAnswers}
                    submitted={weakSubmitted} currentQ={weakCurrentQ} score={weakScore}
                    onAnswer={(qi, ai) => setWeakAnswers((p) => { const n = [...p]; n[qi] = ai; return n; })}
                    onNext={() => setWeakCurrentQ((q) => Math.min(weakQuiz.length - 1, q + 1))}
                    onPrev={() => setWeakCurrentQ((q) => Math.max(0, q - 1))}
                    onSubmit={() => { setWeakSubmitted(true); collectWrong(weakAnswers, weakQuiz); }}
                    onRetake={() => { setWeakAnswers([]); setWeakSubmitted(false); setWeakCurrentQ(0); }}
                    onClear={() => setWrongTopics([])}
                    onGenerate={() => generate("weakpoints")}
                  />
                )}
              </div>
            )}

            {/* Bottom spacer */}
            <div className="h-6" />
          </div>
        </div>

        {/* ── RIGHT: Chat Panel (Gauth-style) ───────────────────────── */}
        <div className="w-80 shrink-0 border-l border-border flex flex-col overflow-hidden bg-card">

          {/* Chat header */}
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-primary" />
                <span className="text-xs font-semibold text-foreground">AI Tutor</span>
              </div>
              <button
                onClick={() => { setChatMessages([]); setChatSessionId(undefined); }}
                title="New chat"
                className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <Plus size={11} /> New
              </button>
            </div>
            {/* Mode pills */}
            <div className="flex gap-1 flex-wrap">
              {(["tutor", "explain", "quiz", "summarize"] as const).map((m) => (
                <button key={m} onClick={() => setChatMode(m)}
                  className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium capitalize transition-colors",
                    chatMode === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {!chatMessages.length && (
              <div className="flex flex-col gap-3 pt-1">
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  {hasContent
                    ? `Ask me anything about your ${selectedSubject} material`
                    : "Ask any study question — I'll guide you step by step"}
                </p>
                {hasContent && (
                  <div className="space-y-1">
                    {["Summarize key concepts", "Quiz me on this", "What should I focus on?", "Explain this from scratch"].map((s) => (
                      <button key={s} onClick={() => sendChat(s)}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent hover:border-border transition-all">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {/* Recent sessions */}
                {(sessions?.sessions?.length ?? 0) > 0 && (
                  <div className="pt-2">
                    <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-1.5">Recent Sessions</p>
                    {sessions!.sessions.slice(0, 5).map((s: { id: number; title: string }) => (
                      <button key={s.id}
                        onClick={() => { setChatSessionId(s.id); setChatMessages([]); }}
                        className={cn("w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors truncate",
                          chatSessionId === s.id
                            ? "text-foreground bg-muted"
                            : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/40")}>
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
                  <div className="w-6 h-6 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Brain size={11} className="text-primary" />
                  </div>
                )}
                <div className="max-w-[88%] space-y-1.5">
                  <div className={cn(
                    "px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm")}>
                    {msg.role === "assistant"
                      ? <MathRenderer text={msg.content} className="text-xs" />
                      : msg.content}
                  </div>
                  {msg.role === "assistant" && msg.followUpQuestions?.slice(0, 2).map((q, qi) => (
                    <button key={qi} onClick={() => sendChat(q)}
                      className="block w-full text-left text-[10px] px-2 py-1.5 rounded-lg text-primary/60 hover:text-primary hover:bg-primary/5 transition-colors">
                      ↳ {q}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {askAssistant.isPending && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Brain size={11} className="text-primary" />
                </div>
                <div className="bg-muted px-3.5 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                  {[0,1,2].map((d) => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                      style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input (Gauth-style) */}
          <div className="shrink-0 px-3 pb-3 pt-2">
            <div className="flex items-end gap-2 bg-muted/60 rounded-2xl px-3.5 py-2.5 focus-within:bg-muted focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                rows={1}
                placeholder="Ask a follow-up question…"
                className="flex-1 bg-transparent text-xs resize-none focus:outline-none leading-relaxed text-foreground placeholder:text-muted-foreground/50"
                style={{ minHeight: "20px", maxHeight: "130px" }}
              />
              <button
                onClick={() => sendChat()}
                disabled={!chatInput.trim() || askAssistant.isPending}
                className="flex items-center justify-center w-7 h-7 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
              >
                {askAssistant.isPending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              </button>
            </div>
          </div>
        </div>

      </div>{/* end body */}
    </div>
  );
}

// ── Flashcards ─────────────────────────────────────────────────────────────

function FlashcardsView({ cards, cardIdx, flipped, mastered, onFlip, onPrev, onNext, onMaster, onGenerate }: {
  cards: Flashcard[]; cardIdx: number; flipped: boolean; mastered: Set<number>;
  onFlip: () => void; onPrev: () => void; onNext: () => void;
  onMaster: (i: number) => void; onGenerate: () => void;
}) {
  if (!cards.length) return <EmptyTab label="Generate flashcards from your content" onGenerate={onGenerate} />;

  const card = cards[cardIdx];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="h-1 w-32 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((cardIdx + 1) / cards.length) * 100}%` }} />
          </div>
          <span>{cardIdx + 1} / {cards.length}</span>
        </div>
        <span className="text-emerald-600 dark:text-emerald-400">{mastered.size} mastered</span>
      </div>

      {card.tag && <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{card.tag}</span>}

      <div onClick={onFlip} style={{ perspective: "1200px" }} className="cursor-pointer select-none">
        <div className="relative h-48 transition-transform duration-500 rounded-2xl"
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0)" }}>
          <div className="absolute inset-0 rounded-2xl bg-muted/40 flex flex-col items-center justify-center p-8 text-center"
            style={{ backfaceVisibility: "hidden" }}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-4">Question</p>
            <p className="text-base font-semibold text-foreground leading-snug">{card.front}</p>
            <p className="mt-5 text-[10px] text-muted-foreground/30">Tap to reveal</p>
          </div>
          <div className="absolute inset-0 rounded-2xl bg-primary/8 flex flex-col items-center justify-center p-8 text-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <p className="text-[10px] uppercase tracking-widest text-primary/50 mb-4">Answer</p>
            <MathRenderer text={card.back} className="text-sm text-foreground leading-relaxed" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onPrev} disabled={cardIdx === 0}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
          <ChevronLeft size={14} /> Previous
        </button>
        <button onClick={() => onMaster(cardIdx)}
          className={cn("flex items-center gap-1.5 text-xs font-medium transition-colors",
            mastered.has(cardIdx) ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground")}>
          <Star size={12} className={mastered.has(cardIdx) ? "fill-current" : ""} />
          {mastered.has(cardIdx) ? "Mastered" : "Mark mastered"}
        </button>
        <button onClick={onNext} disabled={cardIdx === cards.length - 1}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
          Next <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        {cards.map((c, i) => (
          <div key={i} className={cn("px-3 py-2 rounded-xl text-xs transition-colors",
            i === cardIdx ? "bg-primary/8 text-foreground" :
            mastered.has(i) ? "text-muted-foreground/50 line-through" : "bg-muted/30 text-muted-foreground")}>
            <p className="truncate">{c.front}</p>
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
  if (!questions.length) return <EmptyTab label="Generate a quiz from your content" onGenerate={onGenerate} />;

  if (submitted) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="space-y-6">
        <div className="text-center py-4">
          <div className={cn("text-5xl font-bold mb-1",
            pct >= 80 ? "text-emerald-500" : pct >= 60 ? "text-yellow-500" : "text-red-500")}>
            {pct}%
          </div>
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
          <button onClick={onRetake}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm hover:bg-muted transition-colors">
            <RotateCcw size={13} /> Retake
          </button>
          {onWeakPoints && (
            <button onClick={onWeakPoints}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm hover:bg-muted transition-colors text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900">
              <Target size={13} /> Practice Weak Points
            </button>
          )}
          <button onClick={onGenerate}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
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

      <div className="space-y-4">
        <p className="text-base font-semibold text-foreground leading-snug">
          <span className="text-muted-foreground/50 mr-2">{currentQ + 1}.</span>{q.question}
        </p>
        <div className="space-y-2">
          {q.options.map((opt, oi) => (
            <button key={oi} onClick={() => onAnswer(currentQ, oi)}
              className={cn("w-full text-left px-4 py-3 rounded-xl text-sm transition-all",
                answers[currentQ] === oi
                  ? "bg-primary/10 text-foreground font-medium ring-1 ring-primary/30"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onPrev} disabled={currentQ === 0}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
          <ChevronLeft size={14} /> Previous
        </button>
        {currentQ < questions.length - 1 ? (
          <button onClick={onNext}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button onClick={onSubmit} disabled={!allAnswered}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity">
            Submit <CheckCircle2 size={13} />
          </button>
        )}
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

function StudyGuideView({ data, onGenerate }: { data: StudyGuideData | null; onGenerate: () => void }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  if (!data) return <EmptyTab label="Generate a study guide from your content" onGenerate={onGenerate} />;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">{data.title}</h2>

      {data.sections.map((sec, i) => (
        <div key={i}>
          <button
            onClick={() => setExpanded((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}
            className="w-full flex items-center justify-between py-2 text-sm font-semibold text-foreground hover:text-primary transition-colors">
            {sec.heading}
            {expanded.has(i) ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>
          <div className="h-px bg-border" />
          {expanded.has(i) && (
            <div className="pt-4 pb-2">
              {sec.type === "overview"  && <p className="text-sm text-muted-foreground leading-relaxed">{sec.content}</p>}
              {sec.type === "concepts"  && (
                <div className="space-y-4">
                  {sec.items.map((item, ii) => (
                    <div key={ii}>
                      <p className="text-sm font-semibold text-foreground mb-1">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.explanation}</p>
                      {item.example && <p className="text-xs text-primary/70 mt-1 italic">e.g. {item.example}</p>}
                    </div>
                  ))}
                </div>
              )}
              {sec.type === "process" && (
                <ol className="space-y-3">
                  {sec.steps.map((step, si) => (
                    <li key={si} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="text-[10px] font-bold text-primary/60 mt-0.5 shrink-0 w-4">{si + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              )}
              {sec.type === "tips" && (
                <ul className="space-y-2">
                  {sec.tips.map((tip, ti) => (
                    <li key={ti} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Star size={11} className="text-yellow-500 fill-yellow-500 shrink-0 mt-1" /> {tip}
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

function SlidesView({ data, slideIdx, onPrev, onNext, onGenerate }: {
  data: SlideData | null; slideIdx: number;
  onPrev: () => void; onNext: () => void; onGenerate: () => void;
}) {
  if (!data?.slides.length) return <EmptyTab label="Generate a slide deck from your content" onGenerate={onGenerate} />;

  const slide = data.slides[slideIdx];
  const total = data.slides.length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-muted/60 to-muted/30"
        style={{ aspectRatio: "16/9", display: "flex", flexDirection: "column" }}>
        {slide.type === "title" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <p className="text-2xl font-bold text-foreground mb-2">{slide.title}</p>
            {slide.subtitle && <p className="text-sm text-muted-foreground mt-1">{slide.subtitle}</p>}
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-7">
            <p className="text-base font-bold text-foreground mb-4">{slide.title}</p>
            <div className="space-y-2.5">
              {slide.bullets?.map((b, bi) => (
                <div key={bi} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                  <p className="text-sm text-foreground/80 leading-snug">{b}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {slide.notes && (
        <p className="text-xs text-muted-foreground leading-relaxed px-1">
          <span className="font-semibold text-muted-foreground/60 mr-2">Notes:</span>{slide.notes}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button onClick={onPrev} disabled={slideIdx === 0}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
          <ChevronLeft size={14} /> Prev
        </button>
        <div className="flex-1 flex gap-1 justify-center">
          {data.slides.map((_, i) => (
            <div key={i} className={cn("h-1.5 rounded-full transition-all",
              i === slideIdx ? "w-4 bg-primary" : "w-1.5 bg-muted")} />
          ))}
        </div>
        <button onClick={onNext} disabled={slideIdx === total - 1}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
          Next <ChevronRight size={14} />
        </button>
      </div>

      <div className="space-y-0.5 pt-2">
        {data.slides.map((s, i) => (
          <div key={i} className={cn("flex items-center gap-3 px-2 py-1.5 rounded-lg text-xs transition-colors",
            i === slideIdx ? "text-foreground" : "text-muted-foreground/50")}>
            <span className="font-mono text-[10px] w-5 text-right shrink-0">{i + 1}</span>
            <span className="truncate">{s.title}</span>
          </div>
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
        <p className="text-xs text-muted-foreground/60">Complete a quiz to identify your weak areas, then come back here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {wrongTopics.map((t, i) => (
          <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">{t}</span>
        ))}
        <button onClick={onClear} className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors">
          Clear all
        </button>
      </div>

      {!questions.length ? (
        <button onClick={onGenerate}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
          <Zap size={14} /> Generate Weak Points Quiz
        </button>
      ) : (
        <QuizView
          questions={questions} answers={answers} submitted={submitted} currentQ={currentQ} score={score}
          onAnswer={onAnswer} onNext={onNext} onPrev={onPrev} onSubmit={onSubmit} onRetake={onRetake} onGenerate={onGenerate}
        />
      )}
    </div>
  );
}

// ── Empty tab placeholder ──────────────────────────────────────────────────

function EmptyTab({ label, onGenerate }: { label: string; onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <Sparkles size={28} className="text-muted-foreground/20" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <button onClick={onGenerate}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
        <Zap size={13} /> Generate
      </button>
    </div>
  );
}
