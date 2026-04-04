import { useState, useRef, useEffect, useCallback } from "react";
import {
  useAskStudyAssistant,
  useListStudySessions,
  getListStudySessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Send, Loader2, Zap, Upload, FileText,
  ChevronLeft, ChevronRight, RotateCcw, CheckCircle2, XCircle,
  BookOpen, Brain, GraduationCap, AlertTriangle,
  Presentation, ChevronDown, ChevronUp,
  Trash2, Star, Target, BookMarked, FlipHorizontal2,
  Sparkles, Image as ImageIcon,
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

type StudioTab = "flashcards" | "quiz" | "summary" | "studyguide" | "slides" | "weakpoints";
type ChatMsg = { role: "user" | "assistant"; content: string; followUpQuestions?: string[] };

const TABS: { key: StudioTab; label: string; icon: React.ReactNode }[] = [
  { key: "flashcards", label: "Flashcards",  icon: <FlipHorizontal2 size={13} /> },
  { key: "quiz",       label: "Quiz",        icon: <GraduationCap size={13} /> },
  { key: "summary",    label: "Summary",     icon: <BookMarked size={13} /> },
  { key: "studyguide", label: "Study Guide", icon: <BookOpen size={13} /> },
  { key: "slides",     label: "Slides",      icon: <Presentation size={13} /> },
  { key: "weakpoints", label: "Weak Points", icon: <Target size={13} /> },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }
function mergedContent(sources: StudySource[]) {
  return sources.map((s) => `[${s.name}]\n${s.content}`).join("\n\n---\n\n");
}
async function callGenerate(content: string, type: StudioTab, weakTopics?: string[]) {
  const res = await fetch(`${API}/api/study/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ content, type, weakTopics }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Main component ─────────────────────────────────────────────────────────

export default function StudyAssistant() {
  const docInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient  = useQueryClient();
  const askAssistant = useAskStudyAssistant();
  const { data: sessions } = useListStudySessions();

  // Sources
  const [sources, setSources]           = useState<StudySource[]>([]);
  const [uploading, setUploading]       = useState(false);

  // Studio
  const [activeTab, setActiveTab]       = useState<StudioTab>("flashcards");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [flashcards, setFlashcards]     = useState<Flashcard[]>([]);
  const [quiz,       setQuiz]           = useState<QuizQuestion[]>([]);
  const [summary,    setSummary]        = useState<SummaryData | null>(null);
  const [studyGuide, setStudyGuide]     = useState<StudyGuideData | null>(null);
  const [slides,     setSlides]         = useState<SlideData | null>(null);
  const [weakQuiz,   setWeakQuiz]       = useState<QuizQuestion[]>([]);

  // Flashcard state
  const [cardIdx,       setCardIdx]       = useState(0);
  const [cardFlipped,   setCardFlipped]   = useState(false);
  const [masteredCards, setMasteredCards] = useState<Set<number>>(new Set());

  // Quiz state
  const [quizAnswers,   setQuizAnswers]   = useState<(number | null)[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [currentQ,      setCurrentQ]     = useState(0);
  const [wrongTopics,   setWrongTopics]  = useState<string[]>([]);

  // Slide state
  const [slideIdx, setSlideIdx] = useState(0);

  // Weak quiz state
  const [weakAnswers,   setWeakAnswers]   = useState<(number | null)[]>([]);
  const [weakSubmitted, setWeakSubmitted] = useState(false);
  const [weakCurrentQ,  setWeakCurrentQ] = useState(0);

  // Chat
  const [chatInput,     setChatInput]     = useState("");
  const [chatMessages,  setChatMessages]  = useState<ChatMsg[]>([]);
  const [chatSessionId, setChatSessionId] = useState<number | undefined>();
  const [chatMode,      setChatMode]      = useState<"tutor" | "explain" | "quiz" | "summarize">("tutor");

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, askAssistant.isPending]);
  useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = "auto";
      chatInputRef.current.style.height = Math.min(chatInputRef.current.scrollHeight, 120) + "px";
    }
  }, [chatInput]);

  // ── Upload ────────────────────────────────────────────────────────────

  const uploadDoc = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/files/extract`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Failed to extract");
      const data = await res.json();
      setSources((prev) => [...prev, {
        id: uid(), name: file.name,
        type: file.type.startsWith("image/") ? "image" : "doc",
        content: data.text, wordCount: data.wordCount,
      }]);
    } catch { /* silently skip */ } finally { setUploading(false); }
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const f of Array.from(e.target.files ?? [])) await uploadDoc(f);
    e.target.value = "";
  }, [uploadDoc]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    for (const f of Array.from(e.dataTransfer.files)) await uploadDoc(f);
  }, [uploadDoc]);

  const addTextSource = useCallback(() => {
    const name    = prompt("Label this source (e.g. 'Chapter 3 Notes'):");
    if (!name) return;
    const content = prompt("Paste your text or notes:");
    if (!content) return;
    setSources((prev) => [...prev, { id: uid(), name, type: "text", content, wordCount: content.split(/\s+/).length }]);
  }, []);

  // ── Generate ──────────────────────────────────────────────────────────

  const generate = useCallback(async (tab: StudioTab) => {
    if (!sources.length) { setGenerateError("Add at least one source first."); return; }
    setIsGenerating(true);
    setGenerateError(null);
    setActiveTab(tab);
    try {
      const content = mergedContent(sources);
      const r = await callGenerate(content, tab, tab === "weakpoints" ? wrongTopics : undefined);
      if (tab === "flashcards") { setFlashcards(r.data?.flashcards ?? []); setCardIdx(0); setCardFlipped(false); setMasteredCards(new Set()); }
      if (tab === "quiz")       { setQuiz(r.data?.questions ?? []); setQuizAnswers([]); setQuizSubmitted(false); setCurrentQ(0); }
      if (tab === "summary")    { setSummary(r.data); }
      if (tab === "studyguide") { setStudyGuide(r.data); }
      if (tab === "slides")     { setSlides(r.data); setSlideIdx(0); }
      if (tab === "weakpoints") { setWeakQuiz(r.data?.questions ?? []); setWeakAnswers([]); setWeakSubmitted(false); setWeakCurrentQ(0); }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Generation failed");
    } finally { setIsGenerating(false); }
  }, [sources, wrongTopics]);

  // ── Chat ──────────────────────────────────────────────────────────────

  const sendChat = useCallback(async (override?: string) => {
    const msg = (override ?? chatInput).trim();
    if (!msg || askAssistant.isPending) return;
    setChatInput("");
    const ctx = sources.length
      ? `[Sources: ${sources.map((s) => s.name).join(", ")}]\n\n${mergedContent(sources).slice(0, 8000)}\n\n---\n\n`
      : "";
    setChatMessages((prev) => [...prev, { role: "user", content: msg }]);
    try {
      const res = await askAssistant.mutateAsync({ question: ctx + msg, sessionId: chatSessionId, mode: chatMode });
      setChatSessionId(res.sessionId);
      setChatMessages((prev) => [...prev, { role: "assistant", content: res.answer, followUpQuestions: res.followUpQuestions }]);
      queryClient.invalidateQueries({ queryKey: getListStudySessionsQueryKey() });
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
    }
  }, [chatInput, chatSessionId, chatMode, sources, askAssistant, queryClient]);

  // ── Quiz helpers ──────────────────────────────────────────────────────

  const collectWrong = (answers: (number | null)[], questions: QuizQuestion[]) => {
    const bad = questions
      .filter((q, i) => answers[i] !== q.correct)
      .map((q) => q.targetsTopic ?? q.question.slice(0, 40));
    setWrongTopics((prev) => [...new Set([...prev, ...bad])]);
  };

  const quizScore = quizAnswers.filter((a, i) => a === quiz[i]?.correct).length;
  const weakScore = weakAnswers.filter((a, i) => a === weakQuiz[i]?.correct).length;

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────

  const hasContent = sources.length > 0;

  return (
    <div className="h-full flex overflow-hidden">

      {/* ── LEFT: Sources ───────────────────────────────────────────────── */}
      <div className="w-52 shrink-0 border-r border-border flex flex-col overflow-hidden">

        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Sources</span>
          <span className="text-[10px] text-muted-foreground">{sources.length}</span>
        </div>

        {/* Source list */}
        <div className="flex-1 overflow-y-auto px-2">
          {!sources.length && (
            <p className="text-[11px] text-muted-foreground/50 px-2 py-3 leading-relaxed">
              Upload files, paste notes, or drag anything here
            </p>
          )}
          {sources.map((src) => (
            <div key={src.id} className="group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
              {src.type === "image"
                ? <ImageIcon size={12} className="text-blue-400 shrink-0" />
                : <FileText size={12} className="text-muted-foreground/60 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate">{src.name}</p>
                <p className="text-[10px] text-muted-foreground/40">{src.wordCount.toLocaleString()} words</p>
              </div>
              <button
                onClick={() => setSources((p) => p.filter((s) => s.id !== src.id))}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>

        {/* Add actions */}
        <div className="px-2 py-3 space-y-0.5">
          <input ref={docInputRef} type="file" multiple className="sr-only"
            accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
            onChange={handleFileInput}
          />
          <button
            onClick={() => docInputRef.current?.click()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            {uploading ? <Loader2 size={12} className="animate-spin text-primary" /> : <Upload size={12} />}
            {uploading ? "Uploading…" : "Upload file"}
          </button>
          <button
            onClick={addTextSource}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <FileText size={12} /> Paste notes
          </button>
        </div>

        {/* Session history */}
        {(sessions?.sessions?.length ?? 0) > 0 && (
          <div className="px-2 pb-3">
            <p className="text-[10px] text-muted-foreground/40 px-2 mb-1 uppercase tracking-widest">Recent</p>
            {sessions!.sessions.slice(0, 5).map((s) => (
              <button key={s.id}
                onClick={() => { setChatSessionId(s.id); setChatMessages([]); }}
                className={cn("w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-colors truncate",
                  chatSessionId === s.id
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/40")}>
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── CENTER: Studio ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden"
        onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>

        {/* Tab bar + generate button on same row */}
        <div className="shrink-0 flex items-center border-b border-border px-4 gap-1">
          {TABS.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={cn("flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                activeTab === key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")}>
              {icon} {label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => generate(activeTab)}
            disabled={isGenerating || !hasContent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0">
            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            {isGenerating ? "Generating…" : "Generate"}
          </button>
        </div>

        {/* Error banner */}
        {generateError && (
          <div className="shrink-0 mx-4 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/8 text-destructive text-xs">
            <AlertTriangle size={13} /> {generateError}
            <button onClick={() => setGenerateError(null)} className="ml-auto opacity-60 hover:opacity-100"><XCircle size={12} /></button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!hasContent ? (
            <EmptyState onUpload={() => docInputRef.current?.click()} onPaste={addTextSource} />
          ) : (
            <div className="max-w-2xl mx-auto px-6 py-8">
              {activeTab === "flashcards" && (
                <FlashcardsView cards={flashcards} cardIdx={cardIdx} flipped={cardFlipped} mastered={masteredCards}
                  onFlip={() => setCardFlipped((f) => !f)}
                  onPrev={() => { setCardIdx((i) => Math.max(0, i - 1)); setCardFlipped(false); }}
                  onNext={() => { setCardIdx((i) => Math.min(flashcards.length - 1, i + 1)); setCardFlipped(false); }}
                  onMaster={(i) => setMasteredCards((m) => { const n = new Set(m); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                  onGenerate={() => generate("flashcards")}
                />
              )}
              {activeTab === "quiz" && (
                <QuizView
                  questions={quiz} answers={quizAnswers} submitted={quizSubmitted} currentQ={currentQ} score={quizScore}
                  onAnswer={(qi, ai) => setQuizAnswers((p) => { const n = [...p]; n[qi] = ai; return n; })}
                  onNext={() => setCurrentQ((q) => Math.min(quiz.length - 1, q + 1))}
                  onPrev={() => setCurrentQ((q) => Math.max(0, q - 1))}
                  onSubmit={() => { setQuizSubmitted(true); collectWrong(quizAnswers, quiz); }}
                  onRetake={() => { setQuizAnswers([]); setQuizSubmitted(false); setCurrentQ(0); }}
                  onGenerate={() => generate("quiz")}
                />
              )}
              {activeTab === "summary"   && <SummaryView    data={summary}    onGenerate={() => generate("summary")} />}
              {activeTab === "studyguide"&& <StudyGuideView  data={studyGuide} onGenerate={() => generate("studyguide")} />}
              {activeTab === "slides"    && (
                <SlidesView data={slides} slideIdx={slideIdx}
                  onPrev={() => setSlideIdx((i) => Math.max(0, i - 1))}
                  onNext={() => setSlideIdx((i) => Math.min((slides?.slides.length ?? 1) - 1, i + 1))}
                  onGenerate={() => generate("slides")}
                />
              )}
              {activeTab === "weakpoints" && (
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
        </div>
      </div>

      {/* ── RIGHT: Chat ─────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 border-l border-border flex flex-col overflow-hidden">

        {/* Chat header */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={14} className="text-primary" />
            <span className="text-xs font-semibold text-foreground">AI Tutor</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode pills */}
            <div className="flex gap-0.5">
              {(["tutor", "explain", "quiz", "summarize"] as const).map((m) => (
                <button key={m} onClick={() => setChatMode(m)}
                  className={cn("px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-colors",
                    chatMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
            <button onClick={() => { setChatMessages([]); setChatSessionId(undefined); }}
              className="text-muted-foreground/50 hover:text-foreground transition-colors">
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-4">
          {!chatMessages.length && (
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-[11px] text-muted-foreground/50 px-1">
                {hasContent
                  ? "Ask anything about your uploaded sources"
                  : "Ask any study question — I'll guide you step by step"}
              </p>
              {hasContent && (
                <div className="space-y-1">
                  {["Summarize key concepts", "Quiz me on this", "What should I focus on?", "Create a study plan"].map((s) => (
                    <button key={s} onClick={() => sendChat(s)}
                      className="w-full text-left px-3 py-2 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Brain size={10} className="text-primary" />
                </div>
              )}
              <div className="max-w-[88%] space-y-1.5">
                <div className={cn("px-3 py-2 rounded-xl text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground")}>
                  {msg.role === "assistant"
                    ? <MathRenderer text={msg.content} className="text-xs" />
                    : msg.content}
                </div>
                {msg.role === "assistant" && msg.followUpQuestions?.slice(0, 2).map((q, qi) => (
                  <button key={qi} onClick={() => sendChat(q)}
                    className="block w-full text-left text-[10px] px-2.5 py-1.5 rounded-lg text-primary/70 hover:text-primary hover:bg-primary/5 transition-colors">
                    ↳ {q}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {askAssistant.isPending && (
            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Brain size={10} className="text-primary" />
              </div>
              <div className="bg-muted px-3 py-2 rounded-xl flex gap-1 items-center">
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
        <div className="px-3 pb-3 pt-1">
          <div className="flex gap-1.5 items-end bg-muted/50 rounded-xl px-3 py-2 focus-within:bg-muted transition-colors">
            <textarea ref={chatInputRef} value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              rows={1} placeholder="Ask your tutor…"
              className="flex-1 bg-transparent text-xs resize-none focus:outline-none leading-relaxed"
              style={{ minHeight: "24px", maxHeight: "120px" }}
            />
            <button onClick={() => sendChat()} disabled={!chatInput.trim() || askAssistant.isPending}
              className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0">
              {askAssistant.isPending ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onUpload, onPaste }: { onUpload: () => void; onPaste: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-8 text-center">
      <div>
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <Zap size={14} className="text-primary" />
          <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Study Studio</h1>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          Upload your materials and generate flashcards, quizzes, summaries, study guides, and presentations — instantly
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={onUpload}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
          <Upload size={14} /> Upload file
        </button>
        <button onClick={onPaste}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
          <FileText size={14} /> Paste notes
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 justify-center max-w-sm">
        {["Flashcards", "MCQ Quiz", "Summary", "Study Guide", "Slides", "Weak Point Retesting", "AI Tutor"].map((f) => (
          <span key={f} className="text-[10px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{f}</span>
        ))}
      </div>
    </div>
  );
}

// ── Flashcards ─────────────────────────────────────────────────────────────

function FlashcardsView({ cards, cardIdx, flipped, mastered, onFlip, onPrev, onNext, onMaster, onGenerate }: {
  cards: Flashcard[]; cardIdx: number; flipped: boolean; mastered: Set<number>;
  onFlip: () => void; onPrev: () => void; onNext: () => void;
  onMaster: (i: number) => void; onGenerate: () => void;
}) {
  if (!cards.length) return <EmptyTab label="Generate flashcards from your sources" onGenerate={onGenerate} />;

  const card = cards[cardIdx];
  return (
    <div className="space-y-6">
      {/* Counter + mastered */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="h-1 w-32 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${((cardIdx + 1) / cards.length) * 100}%` }} />
          </div>
          <span>{cardIdx + 1} / {cards.length}</span>
        </div>
        <span className="text-emerald-600 dark:text-emerald-400">{mastered.size} mastered</span>
      </div>

      {card.tag && (
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{card.tag}</span>
      )}

      {/* Flip card */}
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

      {/* Controls */}
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

      {/* Card list */}
      <div className="grid grid-cols-2 gap-2 pt-4">
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

function QuizView({ questions, answers, submitted, currentQ, score, onAnswer, onNext, onPrev, onSubmit, onRetake, onGenerate }: {
  questions: QuizQuestion[]; answers: (number | null)[]; submitted: boolean;
  currentQ: number; score: number;
  onAnswer: (qi: number, ai: number) => void; onNext: () => void; onPrev: () => void;
  onSubmit: () => void; onRetake: () => void; onGenerate: () => void;
}) {
  if (!questions.length) return <EmptyTab label="Generate a quiz from your sources" onGenerate={onGenerate} />;

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
                  {correct
                    ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    : <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />}
                  <p className="text-sm text-foreground">{q.question}</p>
                </div>
                {!correct && (
                  <div className="pl-5 space-y-1">
                    {answers[i] !== null && (
                      <p className="text-xs text-red-400">Your answer: {q.options[answers[i]!]}</p>
                    )}
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Correct: {q.options[q.correct]}</p>
                    {q.explanation && <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onRetake}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm hover:bg-muted transition-colors">
            <RotateCcw size={13} /> Retake
          </button>
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
      {/* Progress */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${(answers.filter((a) => a != null).length / questions.length) * 100}%` }} />
        </div>
        <span>{currentQ + 1} / {questions.length}</span>
      </div>

      {/* Question */}
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

      {/* Navigation */}
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
  if (!data) return <EmptyTab label="Generate a summary from your sources" onGenerate={onGenerate} />;
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
  if (!data) return <EmptyTab label="Generate a study guide from your sources" onGenerate={onGenerate} />;

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
              {sec.type === "overview" && <p className="text-sm text-muted-foreground leading-relaxed">{sec.content}</p>}
              {sec.type === "concepts" && (
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
  if (!data?.slides.length) return <EmptyTab label="Generate a slide deck from your sources" onGenerate={onGenerate} />;

  const slide = data.slides[slideIdx];
  const total = data.slides.length;

  return (
    <div className="space-y-5">
      {/* Slide */}
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

      {/* Speaker notes */}
      {slide.notes && (
        <p className="text-xs text-muted-foreground leading-relaxed px-1">
          <span className="font-semibold text-muted-foreground/60 mr-2">Notes:</span>{slide.notes}
        </p>
      )}

      {/* Controls */}
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

      {/* Outline */}
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
  return (
    <div className="space-y-6">
      {/* Weak topics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Weak Points Identified</p>
          {wrongTopics.length > 0 && (
            <button onClick={onClear} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              Clear
            </button>
          )}
        </div>
        {!wrongTopics.length ? (
          <p className="text-sm text-muted-foreground/50">
            Take a quiz first — topics you miss will appear here for targeted practice.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {wrongTopics.map((t, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-red-500/8 text-red-600 dark:text-red-400">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {wrongTopics.length > 0 && !questions.length && (
        <button onClick={onGenerate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
          <Zap size={14} /> Generate Targeted Practice
        </button>
      )}

      {questions.length > 0 && !submitted && (
        <QuizView
          questions={questions} answers={answers} submitted={false}
          currentQ={currentQ} score={score}
          onAnswer={onAnswer} onNext={onNext} onPrev={onPrev}
          onSubmit={onSubmit} onRetake={onRetake} onGenerate={onGenerate}
        />
      )}

      {submitted && (
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="text-4xl font-bold text-foreground mb-1">{score}/{questions.length}</div>
            <p className="text-sm text-muted-foreground">Targeted practice complete</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onRetake}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm hover:bg-muted transition-colors">
              <RotateCcw size={13} /> Retry
            </button>
            <button onClick={onGenerate}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
              <Zap size={13} /> New Practice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Generic empty tab state ────────────────────────────────────────────────

function EmptyTab({ label, onGenerate }: { label: string; onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center">
        <Sparkles size={18} className="text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <button onClick={onGenerate}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
        <Zap size={14} /> Generate Now
      </button>
    </div>
  );
}
