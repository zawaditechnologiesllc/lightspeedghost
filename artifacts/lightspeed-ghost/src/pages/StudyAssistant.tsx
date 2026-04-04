import { useState, useRef, useEffect, useCallback } from "react";
import {
  useAskStudyAssistant,
  useListStudySessions,
  useGetSessionMessages,
  getListStudySessionsQueryKey,
  getGetSessionMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Send, Loader2, Zap, Mic, MicOff, Upload, FileText, X,
  ChevronLeft, ChevronRight, RotateCcw, CheckCircle2, XCircle,
  BookOpen, Brain, HelpCircle, Layers, GraduationCap, AlertTriangle,
  Presentation, MessageSquare, Paperclip, ChevronDown, ChevronUp,
  Volume2, Image as ImageIcon, FileAudio, Trash2, Star, Target,
  BookMarked, FlipHorizontal2, BarChart3, Sparkles, PanelLeftClose,
  PanelRightClose,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MathRenderer from "@/components/MathRenderer";

const API = import.meta.env.VITE_API_URL ?? "";

// ── Types ──────────────────────────────────────────────────────────────────

type SourceType = "doc" | "audio" | "image" | "text";
interface StudySource {
  id: string;
  name: string;
  type: SourceType;
  content: string;
  wordCount: number;
  subject?: string;
}

interface Flashcard { front: string; back: string; tag?: string }
interface QuizQuestion { question: string; options: string[]; correct: number; explanation: string; targetsTopic?: string }
interface SummaryData {
  title: string; overview: string;
  sections: { heading: string; points: string[]; keyTerms?: { term: string; definition: string }[] }[];
  takeaways: string[]; relatedConcepts: string[];
}
interface StudyGuideData {
  title: string;
  sections: Array<
    | { type: "overview"; heading: string; content: string }
    | { type: "concepts"; heading: string; items: { name: string; explanation: string; example?: string }[] }
    | { type: "process"; heading: string; steps: string[] }
    | { type: "tips"; heading: string; tips: string[] }
  >;
  quickRef?: { label: string; value: string }[];
}
interface Slide { slideNum: number; type: "title" | "agenda" | "content" | "conclusion"; title: string; subtitle?: string; bullets?: string[]; notes?: string }
interface SlideData { title: string; slides: Slide[] }

type StudioTab = "flashcards" | "quiz" | "summary" | "studyguide" | "slides" | "weakpoints";
type ChatMsg = { role: "user" | "assistant"; content: string; followUpQuestions?: string[] };

const TAB_META: Record<StudioTab, { icon: React.ReactNode; label: string; desc: string; color: string }> = {
  flashcards:  { icon: <FlipHorizontal2 size={14} />, label: "Flashcards",   desc: "Flip & memorize",       color: "text-blue-500" },
  quiz:        { icon: <HelpCircle size={14} />,       label: "Quiz",         desc: "Test yourself",         color: "text-violet-500" },
  summary:     { icon: <BookMarked size={14} />,       label: "Summary",      desc: "Key points",            color: "text-cyan-500" },
  studyguide:  { icon: <BookOpen size={14} />,         label: "Study Guide",  desc: "Deep dive",             color: "text-emerald-500" },
  slides:      { icon: <Presentation size={14} />,     label: "Slides",       desc: "Presentation",          color: "text-orange-500" },
  weakpoints:  { icon: <Target size={14} />,           label: "Weak Points",  desc: "Adaptive retesting",    color: "text-red-500" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function mergedContent(sources: StudySource[]) {
  return sources.map((s) => `[${s.name}]\n${s.content}`).join("\n\n---\n\n");
}

async function callGenerate(content: string, type: StudioTab, subject?: string, weakTopics?: string[]) {
  const res = await fetch(`${API}/api/study/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ content, type, subject, weakTopics }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function StudyAssistant() {
  // Sources
  const [sources, setSources] = useState<StudySource[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval>>();
  const docInputRef = useRef<HTMLInputElement>(null);

  // Studio
  const [activeTab, setActiveTab] = useState<StudioTab>("flashcards");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [studyGuide, setStudyGuide] = useState<StudyGuideData | null>(null);
  const [slides, setSlides] = useState<SlideData | null>(null);
  const [weakQuiz, setWeakQuiz] = useState<QuizQuestion[]>([]);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [wrongTopics, setWrongTopics] = useState<string[]>([]);

  // Flashcard state
  const [cardIdx, setCardIdx] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [masteredCards, setMasteredCards] = useState<Set<number>>(new Set());

  // Slide state
  const [slideIdx, setSlideIdx] = useState(0);

  // Weak quiz state
  const [weakAnswers, setWeakAnswers] = useState<(number | null)[]>([]);
  const [weakSubmitted, setWeakSubmitted] = useState(false);
  const [weakCurrentQ, setWeakCurrentQ] = useState(0);

  // Panel visibility
  const [showSources, setShowSources] = useState(true);
  const [showChat, setShowChat] = useState(true);

  // Chat
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatSessionId, setChatSessionId] = useState<number | undefined>();
  const [chatMode, setChatMode] = useState<"tutor" | "explain" | "quiz" | "summarize">("tutor");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const askAssistant = useAskStudyAssistant();
  const { data: sessions } = useListStudySessions();

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, askAssistant.isPending]);

  useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = "auto";
      chatInputRef.current.style.height = Math.min(chatInputRef.current.scrollHeight, 120) + "px";
    }
  }, [chatInput]);

  // ── Source upload ──────────────────────────────────────────────────────

  const uploadDoc = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API}/api/files/extract`, { method: "POST", body: formData, credentials: "include" });
    if (!res.ok) throw new Error("Failed to extract file");
    const data = await res.json();
    const src: StudySource = {
      id: uid(), name: file.name,
      type: file.type.startsWith("image/") ? "image" : "doc",
      content: data.text, wordCount: data.wordCount,
    };
    setSources((prev) => [...prev, src]);
  }, []);

  const handleDocInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    for (const file of Array.from(e.target.files)) await uploadDoc(file);
    e.target.value = "";
  }, [uploadDoc]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    for (const file of Array.from(e.dataTransfer.files)) await uploadDoc(file);
  }, [uploadDoc]);

  const addTextSource = useCallback(() => {
    const name = prompt("Name this source (e.g. 'Lecture Notes'):");
    if (!name) return;
    const content = prompt("Paste your text/notes here:");
    if (!content) return;
    setSources((prev) => [...prev, {
      id: uid(), name, type: "text", content,
      wordCount: content.split(/\s+/).length,
    }]);
  }, []);

  // ── Audio recording ────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const name = `Recording ${new Date().toLocaleTimeString()}`;
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        try {
          const res = await fetch(`${API}/api/study/transcribe`, { method: "POST", body: formData, credentials: "include" });
          if (!res.ok) throw new Error("Transcription failed");
          const data = await res.json();
          setSources((prev) => [...prev, { id: uid(), name, type: "audio", content: data.transcript, wordCount: data.words ?? 0 }]);
        } catch {
          setSources((prev) => [...prev, { id: uid(), name, type: "audio", content: "[Transcription failed — paste your notes manually]", wordCount: 0 }]);
        }
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch { alert("Microphone access denied"); }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  }, []);

  // ── Generate study materials ───────────────────────────────────────────

  const generate = useCallback(async (tab: StudioTab) => {
    if (sources.length === 0) { setGenerateError("Add at least one source first."); return; }
    setIsGenerating(true);
    setGenerateError(null);
    setActiveTab(tab);

    try {
      const content = mergedContent(sources);
      const subject = sources[0]?.subject ?? "General";
      const result = await callGenerate(content, tab, subject, tab === "weakpoints" ? wrongTopics : undefined);

      if (tab === "flashcards") { setFlashcards(result.data?.flashcards ?? []); setCardIdx(0); setCardFlipped(false); setMasteredCards(new Set()); }
      if (tab === "quiz")       { setQuiz(result.data?.questions ?? []); setQuizAnswers([]); setQuizSubmitted(false); setCurrentQ(0); }
      if (tab === "summary")    { setSummary(result.data); }
      if (tab === "studyguide") { setStudyGuide(result.data); }
      if (tab === "slides")     { setSlides(result.data); setSlideIdx(0); }
      if (tab === "weakpoints") { setWeakQuiz(result.data?.questions ?? []); setWeakAnswers([]); setWeakSubmitted(false); setWeakCurrentQ(0); }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [sources, wrongTopics]);

  // ── Chat ───────────────────────────────────────────────────────────────

  const sendChat = useCallback(async (override?: string) => {
    const msg = (override ?? chatInput).trim();
    if (!msg || askAssistant.isPending) return;
    setChatInput("");

    const sourceContext = sources.length
      ? `[Student has uploaded these study materials: ${sources.map((s) => s.name).join(", ")}]\n\nMaterial context:\n${mergedContent(sources).slice(0, 8000)}\n\n---\n\n`
      : "";

    setChatMessages((prev) => [...prev, { role: "user", content: msg }]);

    try {
      const res = await askAssistant.mutateAsync({ question: sourceContext + msg, sessionId: chatSessionId, mode: chatMode });
      setChatSessionId(res.sessionId);
      setChatMessages((prev) => [...prev, { role: "assistant", content: res.answer, followUpQuestions: res.followUpQuestions }]);
      queryClient.invalidateQueries({ queryKey: getListStudySessionsQueryKey() });
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    }
  }, [chatInput, chatSessionId, chatMode, sources, askAssistant, queryClient]);

  // ── Quiz scoring ───────────────────────────────────────────────────────

  const submitQuiz = useCallback((answers: (number | null)[], questions: QuizQuestion[], setter: (v: string[]) => void) => {
    const wrong = questions
      .map((q, i) => ({ q, correct: answers[i] === q.correct }))
      .filter((x) => !x.correct)
      .map((x) => x.q.targetsTopic ?? x.q.question.slice(0, 40));
    setter((prev) => [...new Set([...prev, ...wrong])]);
  }, []);

  const quizScore = quizAnswers.filter((a, i) => a === quiz[i]?.correct).length;
  const weakScore = weakAnswers.filter((a, i) => a === weakQuiz[i]?.correct).length;

  // ── Format time ────────────────────────────────────────────────────────
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex overflow-hidden bg-background">

      {/* ── LEFT: Sources Panel ──────────────────────────────────────────── */}
      {showSources && (
        <div className="w-56 shrink-0 border-r border-border flex flex-col overflow-hidden bg-sidebar">
          {/* Panel header */}
          <div className="px-3 py-3 border-b border-sidebar-border flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">Sources</p>
              <p className="text-xs font-semibold text-sidebar-foreground mt-0.5">{sources.length} added</p>
            </div>
            <button onClick={() => setShowSources(false)} className="text-sidebar-foreground/40 hover:text-sidebar-foreground">
              <PanelLeftClose size={14} />
            </button>
          </div>

          {/* Source list */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {sources.length === 0 && (
              <div className="text-center py-8 px-2">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-2">
                  <BookOpen size={18} className="text-muted-foreground/50" />
                </div>
                <p className="text-xs text-muted-foreground/50 leading-relaxed">Add your lecture notes, textbooks, or audio recordings</p>
              </div>
            )}
            {sources.map((src) => (
              <div key={src.id} className="group flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors">
                <div className="mt-0.5 shrink-0">
                  {src.type === "audio" ? <FileAudio size={13} className="text-violet-400" /> :
                   src.type === "image" ? <ImageIcon size={13} className="text-blue-400" /> :
                   src.type === "text"  ? <FileText size={13} className="text-emerald-400" /> :
                   <FileText size={13} className="text-primary/70" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-sidebar-foreground truncate leading-tight">{src.name}</p>
                  <p className="text-[10px] text-sidebar-foreground/40 mt-0.5">{src.wordCount.toLocaleString()} words</p>
                </div>
                <button
                  onClick={() => setSources((prev) => prev.filter((s) => s.id !== src.id))}
                  className="opacity-0 group-hover:opacity-100 text-sidebar-foreground/30 hover:text-destructive transition-opacity shrink-0 mt-0.5"
                ><Trash2 size={11} /></button>
              </div>
            ))}
          </div>

          {/* Add source buttons */}
          <div className="px-2 py-2 border-t border-sidebar-border space-y-1">
            <input ref={docInputRef} type="file" multiple className="sr-only"
              accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
              onChange={handleDocInput}
            />
            <button onClick={() => docInputRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
              <Upload size={12} className="text-primary" /> Upload file
            </button>
            <button onClick={addTextSource}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
              <FileText size={12} className="text-emerald-400" /> Paste text / notes
            </button>
            {!isRecording ? (
              <button onClick={startRecording}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                <Mic size={12} className="text-red-400" /> Record lecture
              </button>
            ) : (
              <button onClick={stopRecording}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 animate-pulse">
                <MicOff size={12} /> Stop · {fmtTime(recordingSeconds)}
              </button>
            )}
          </div>

          {/* Sessions */}
          {sessions?.sessions && sessions.sessions.length > 0 && (
            <div className="border-t border-sidebar-border px-2 py-2">
              <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-2 py-1">Recent Sessions</p>
              <div className="space-y-0.5">
                {sessions.sessions.slice(0, 4).map((s) => (
                  <button key={s.id}
                    onClick={() => { setChatSessionId(s.id); setChatMessages([]); }}
                    className={cn("w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-colors truncate",
                      chatSessionId === s.id ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50")}>
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CENTER: Studio ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Studio header */}
        <div className="shrink-0 border-b border-border bg-card px-4 py-2.5 flex items-center gap-2">
          {!showSources && (
            <button onClick={() => setShowSources(true)} className="text-muted-foreground hover:text-foreground mr-1">
              <PanelLeftClose size={15} className="rotate-180" />
            </button>
          )}
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles size={14} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm text-foreground">Study Studio</span>
            <span className="text-[10px] text-muted-foreground ml-2">
              {sources.length > 0 ? `${sources.length} source${sources.length !== 1 ? "s" : ""} · ${mergedContent(sources).split(/\s+/).length.toLocaleString()} words` : "No sources yet"}
            </span>
          </div>
          {!showChat && (
            <button onClick={() => setShowChat(true)} className="text-muted-foreground hover:text-foreground">
              <PanelRightClose size={15} className="rotate-180" />
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="shrink-0 border-b border-border bg-background px-4 flex gap-0.5 overflow-x-auto">
          {(Object.entries(TAB_META) as [StudioTab, typeof TAB_META[StudioTab]][]).map(([key, meta]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={cn("flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors",
                activeTab === key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")}>
              <span className={activeTab === key ? meta.color : ""}>{meta.icon}</span>
              {meta.label}
            </button>
          ))}
        </div>

        {/* Studio content */}
        <div className="flex-1 overflow-y-auto" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
          {sources.length === 0 ? (
            <EmptySourcesState onUpload={() => docInputRef.current?.click()} onPaste={addTextSource} onRecord={isRecording ? stopRecording : startRecording} isRecording={isRecording} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-5">

              {/* Generate button */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-foreground">{TAB_META[activeTab].label}</h2>
                  <p className="text-xs text-muted-foreground">{TAB_META[activeTab].desc}</p>
                </div>
                <button onClick={() => generate(activeTab)} disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  {isGenerating ? "Generating…" : "Generate"}
                </button>
              </div>

              {generateError && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20">
                  <AlertTriangle size={14} /> {generateError}
                </div>
              )}

              {/* Tab content */}
              {activeTab === "flashcards" && (
                <FlashcardsView
                  cards={flashcards} cardIdx={cardIdx} flipped={cardFlipped}
                  mastered={masteredCards}
                  onFlip={() => setCardFlipped((f) => !f)}
                  onPrev={() => { setCardIdx((i) => Math.max(0, i - 1)); setCardFlipped(false); }}
                  onNext={() => { setCardIdx((i) => Math.min(flashcards.length - 1, i + 1)); setCardFlipped(false); }}
                  onMaster={(i) => setMasteredCards((m) => { const n = new Set(m); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                  onRegenerate={() => generate("flashcards")}
                />
              )}

              {activeTab === "quiz" && (
                <QuizView
                  questions={quiz} answers={quizAnswers} submitted={quizSubmitted} currentQ={currentQ} score={quizScore}
                  onAnswer={(qi, ai) => setQuizAnswers((prev) => { const n = [...prev]; n[qi] = ai; return n; })}
                  onNext={() => setCurrentQ((q) => Math.min(quiz.length - 1, q + 1))}
                  onPrev={() => setCurrentQ((q) => Math.max(0, q - 1))}
                  onSubmit={() => { setQuizSubmitted(true); submitQuiz(quizAnswers, quiz, setWrongTopics); }}
                  onRetake={() => { setQuizAnswers([]); setQuizSubmitted(false); setCurrentQ(0); }}
                  onRegenerate={() => generate("quiz")}
                />
              )}

              {activeTab === "summary" && <SummaryView data={summary} onRegenerate={() => generate("summary")} />}
              {activeTab === "studyguide" && <StudyGuideView data={studyGuide} onRegenerate={() => generate("studyguide")} />}
              {activeTab === "slides" && (
                <SlidesView data={slides} slideIdx={slideIdx}
                  onPrev={() => setSlideIdx((i) => Math.max(0, i - 1))}
                  onNext={() => setSlideIdx((i) => Math.min((slides?.slides.length ?? 1) - 1, i + 1))}
                  onRegenerate={() => generate("slides")}
                />
              )}

              {activeTab === "weakpoints" && (
                <WeakPointsView
                  wrongTopics={wrongTopics} questions={weakQuiz} answers={weakAnswers}
                  submitted={weakSubmitted} currentQ={weakCurrentQ} score={weakScore}
                  onAnswer={(qi, ai) => setWeakAnswers((prev) => { const n = [...prev]; n[qi] = ai; return n; })}
                  onNext={() => setWeakCurrentQ((q) => Math.min(weakQuiz.length - 1, q + 1))}
                  onPrev={() => setWeakCurrentQ((q) => Math.max(0, q - 1))}
                  onSubmit={() => { setWeakSubmitted(true); submitQuiz(weakAnswers, weakQuiz, setWrongTopics); }}
                  onRetake={() => { setWeakAnswers([]); setWeakSubmitted(false); setWeakCurrentQ(0); }}
                  onClear={() => setWrongTopics([])}
                  onGenerate={() => generate("weakpoints")}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Chat Panel ────────────────────────────────────────────── */}
      {showChat && (
        <div className="w-72 shrink-0 border-l border-border flex flex-col overflow-hidden bg-sidebar">

          {/* Chat header */}
          <div className="px-3 py-3 border-b border-sidebar-border flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Brain size={12} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground">AI Tutor</p>
              <p className="text-[10px] text-sidebar-foreground/40">Grounded in your sources</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setChatMessages([]); setChatSessionId(undefined); }}
                title="New chat" className="text-sidebar-foreground/40 hover:text-sidebar-foreground">
                <Plus size={13} />
              </button>
              <button onClick={() => setShowChat(false)} className="text-sidebar-foreground/40 hover:text-sidebar-foreground">
                <PanelRightClose size={13} />
              </button>
            </div>
          </div>

          {/* Mode selector */}
          <div className="px-2 py-1.5 border-b border-sidebar-border flex gap-1 overflow-x-auto">
            {(["tutor", "explain", "quiz", "summarize"] as const).map((m) => (
              <button key={m} onClick={() => setChatMode(m)}
                className={cn("px-2 py-1 rounded-md text-[10px] font-medium capitalize whitespace-nowrap transition-colors",
                  chatMode === m ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground")}>
                {m}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-2">
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center">
                  <GraduationCap size={18} className="text-primary" />
                </div>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  Ask anything about your sources — I'm grounded in what you uploaded
                </p>
                {sources.length > 0 && (
                  <div className="space-y-1.5 w-full">
                    {["Summarize key concepts", "Quiz me on the main points", "What should I focus on?", "Create a study plan"].map((s) => (
                      <button key={s} onClick={() => sendChat(s)}
                        className="w-full text-left px-2.5 py-2 rounded-lg border border-border bg-card text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
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
                  <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <Brain size={10} className="text-primary" />
                  </div>
                )}
                <div className="max-w-[85%] space-y-1.5">
                  <div className={cn("px-3 py-2 rounded-xl text-xs leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm")}>
                    {msg.role === "assistant"
                      ? <MathRenderer text={msg.content} className="text-xs" />
                      : msg.content}
                  </div>
                  {msg.role === "assistant" && msg.followUpQuestions?.slice(0, 2).map((q, qi) => (
                    <button key={qi} onClick={() => sendChat(q)}
                      className="block w-full text-left text-[10px] px-2 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {askAssistant.isPending && (
              <div className="flex gap-2 justify-start">
                <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Brain size={10} className="text-primary" />
                </div>
                <div className="bg-card border border-border px-3 py-2 rounded-xl rounded-tl-sm flex gap-1 items-center">
                  {[0,1,2].map((d) => (
                    <div key={d} className="w-1 h-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="px-2 pb-2 pt-1.5 border-t border-sidebar-border">
            <div className="flex gap-1.5 items-end bg-card border border-border rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-ring transition-shadow">
              <textarea ref={chatInputRef} value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                rows={1} placeholder="Ask your AI tutor…"
                className="flex-1 px-1.5 py-1 bg-transparent text-xs resize-none focus:outline-none leading-relaxed"
                style={{ minHeight: "28px", maxHeight: "120px" }}
              />
              <button onClick={() => sendChat()} disabled={!chatInput.trim() || askAssistant.isPending}
                className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0">
                {askAssistant.isPending ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptySourcesState({ onUpload, onPaste, onRecord, isRecording }: { onUpload: () => void; onPaste: () => void; onRecord: () => void; isRecording: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-6">
      <div>
        <div className="flex items-center justify-center gap-1.5 mb-4">
          <Zap size={16} className="text-primary" />
          <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">LightSpeed AI</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Study Studio</h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
          Upload your lecture notes, textbooks, or slides — and instantly get flashcards, quizzes, summaries, presentations, and adaptive retesting
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
        {[
          { icon: <Upload size={18} className="text-primary" />, label: "Upload Files", sub: "PDF, DOCX, TXT, images", action: onUpload },
          { icon: <FileText size={18} className="text-emerald-500" />, label: "Paste Notes", sub: "Any text or notes", action: onPaste },
          { icon: isRecording ? <MicOff size={18} className="text-red-500" /> : <Mic size={18} className="text-violet-500" />, label: isRecording ? "Stop Recording" : "Record Lecture", sub: isRecording ? "Click to stop" : "Audio transcription", action: onRecord },
        ].map((item) => (
          <button key={item.label} onClick={item.action}
            className={cn("flex flex-col items-center gap-2 p-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-primary/3 transition-all text-center", isRecording && item.label.includes("Record") && "border-red-500/40 bg-red-500/5 animate-pulse")}>
            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">{item.icon}</div>
            <div>
              <p className="text-xs font-semibold text-foreground">{item.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {["Flashcards", "MCQ Quiz", "Summary", "Study Guide", "Slides / PPT", "Weak Point Retesting", "AI Tutor Chat", "Audio Transcription"].map((f) => (
          <span key={f} className="text-[10px] px-2.5 py-1 rounded-full border border-border bg-card text-muted-foreground">{f}</span>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground/40">Drag & drop files anywhere to add them as sources</p>
    </div>
  );
}

// ── Flashcards View ────────────────────────────────────────────────────────

function FlashcardsView({ cards, cardIdx, flipped, mastered, onFlip, onPrev, onNext, onMaster, onRegenerate }: {
  cards: Flashcard[]; cardIdx: number; flipped: boolean; mastered: Set<number>;
  onFlip: () => void; onPrev: () => void; onNext: () => void;
  onMaster: (i: number) => void; onRegenerate: () => void;
}) {
  if (cards.length === 0) return <EmptyTabState label="No flashcards yet" action="Generate Flashcards" onAction={onRegenerate} />;

  const card = cards[cardIdx];
  const progressPct = ((cardIdx + 1) / cards.length) * 100;

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{cardIdx + 1} / {cards.length}</span>
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium shrink-0">{mastered.size} mastered</span>
      </div>

      {/* Tag */}
      {card.tag && (
        <span className="inline-block text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          {card.tag}
        </span>
      )}

      {/* Card */}
      <div onClick={onFlip} className="cursor-pointer select-none" style={{ perspective: "1200px" }}>
        <div className="relative h-52 transition-transform duration-500 rounded-2xl"
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
          {/* Front */}
          <div className="absolute inset-0 rounded-2xl bg-card border-2 border-border flex flex-col items-center justify-center p-6 text-center shadow-sm"
            style={{ backfaceVisibility: "hidden" }}>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-3">Question</div>
            <p className="text-base font-semibold text-foreground leading-snug">{card.front}</p>
            <div className="mt-4 text-[10px] text-muted-foreground/40">Tap to reveal answer</div>
          </div>
          {/* Back */}
          <div className="absolute inset-0 rounded-2xl bg-primary/5 border-2 border-primary/30 flex flex-col items-center justify-center p-6 text-center shadow-sm"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <div className="text-[10px] uppercase tracking-widest text-primary/60 mb-3">Answer</div>
            <MathRenderer text={card.back} className="text-sm text-foreground leading-relaxed" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={onPrev} disabled={cardIdx === 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors">
          <ChevronLeft size={14} /> Prev
        </button>
        <button onClick={() => onMaster(cardIdx)}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            mastered.has(cardIdx)
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              : "bg-muted text-muted-foreground hover:text-foreground")}>
          <Star size={12} className={mastered.has(cardIdx) ? "fill-emerald-500 text-emerald-500" : ""} />
          {mastered.has(cardIdx) ? "Mastered" : "Mark mastered"}
        </button>
        <button onClick={onNext} disabled={cardIdx === cards.length - 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors">
          Next <ChevronRight size={14} />
        </button>
      </div>

      {/* All cards list */}
      <div className="mt-4">
        <p className="text-xs text-muted-foreground font-medium mb-2">All cards</p>
        <div className="grid grid-cols-2 gap-2">
          {cards.map((c, i) => (
            <button key={i} onClick={() => { /* jump to card — handled outside */ }}
              className={cn("text-left px-3 py-2 rounded-xl border text-xs transition-colors",
                i === cardIdx ? "border-primary bg-primary/5 text-foreground" :
                mastered.has(i) ? "border-emerald-500/30 bg-emerald-500/5 text-muted-foreground" :
                "border-border bg-card text-muted-foreground hover:border-primary/40")}>
              <p className="font-medium truncate">{c.front}</p>
              {c.tag && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{c.tag}</p>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Quiz View ──────────────────────────────────────────────────────────────

function QuizView({ questions, answers, submitted, currentQ, score, onAnswer, onNext, onPrev, onSubmit, onRetake, onRegenerate }: {
  questions: QuizQuestion[]; answers: (number | null)[]; submitted: boolean; currentQ: number; score: number;
  onAnswer: (qi: number, ai: number) => void; onNext: () => void; onPrev: () => void;
  onSubmit: () => void; onRetake: () => void; onRegenerate: () => void;
}) {
  if (questions.length === 0) return <EmptyTabState label="No quiz yet" action="Generate Quiz" onAction={onRegenerate} />;

  if (submitted) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="space-y-5">
        {/* Score card */}
        <div className={cn("rounded-2xl p-6 text-center border-2",
          pct >= 80 ? "bg-emerald-500/8 border-emerald-500/30" :
          pct >= 60 ? "bg-yellow-500/8 border-yellow-500/30" :
          "bg-red-500/8 border-red-500/30")}>
          <div className={cn("text-4xl font-bold mb-1",
            pct >= 80 ? "text-emerald-600 dark:text-emerald-400" :
            pct >= 60 ? "text-yellow-600 dark:text-yellow-400" :
            "text-red-600 dark:text-red-400")}>
            {pct}%
          </div>
          <p className="text-sm text-muted-foreground">{score} / {questions.length} correct</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {pct >= 80 ? "Excellent! You're ready." : pct >= 60 ? "Good work — review the ones you missed." : "Keep studying — practice makes perfect!"}
          </p>
        </div>

        {/* Review each question */}
        <div className="space-y-3">
          {questions.map((q, i) => {
            const userAns = answers[i];
            const correct = userAns === q.correct;
            return (
              <div key={i} className={cn("rounded-xl border p-4 space-y-2",
                correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5")}>
                <div className="flex items-start gap-2">
                  {correct ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /> : <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />}
                  <p className="text-sm font-medium text-foreground">{q.question}</p>
                </div>
                {!correct && (
                  <div className="pl-5 space-y-1">
                    {userAns !== null && <p className="text-xs text-red-500 dark:text-red-400">Your answer: {q.options[userAns]}</p>}
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Correct: {q.options[q.correct]}</p>
                    {q.explanation && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{q.explanation}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={onRetake} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
            <RotateCcw size={13} /> Retake
          </button>
          <button onClick={onRegenerate} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Zap size={13} /> New Quiz
          </button>
        </div>
      </div>
    );
  }

  const q = questions[currentQ];
  const answered = answers[currentQ] !== undefined && answers[currentQ] !== null;
  const allAnswered = questions.every((_, i) => answers[i] !== undefined && answers[i] !== null);

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${(answers.filter((a) => a !== null && a !== undefined).length / questions.length) * 100}%` }} />
        </div>
        <span className="text-xs text-muted-foreground">{currentQ + 1} / {questions.length}</span>
      </div>

      {/* Question */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground leading-snug mb-4">Q{currentQ + 1}. {q.question}</p>
        <div className="space-y-2">
          {q.options.map((opt, oi) => (
            <button key={oi} onClick={() => onAnswer(currentQ, oi)}
              className={cn("w-full text-left px-4 py-3 rounded-xl border text-sm transition-all",
                answers[currentQ] === oi
                  ? "border-primary bg-primary/10 text-foreground font-medium"
                  : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button onClick={onPrev} disabled={currentQ === 0}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors">
          <ChevronLeft size={14} /> Prev
        </button>
        <div className="flex-1 flex gap-1 justify-center flex-wrap">
          {questions.map((_, i) => (
            <button key={i} onClick={() => {/* would set currentQ */}}
              className={cn("w-6 h-6 rounded-md text-[10px] font-medium transition-colors",
                i === currentQ ? "bg-primary text-primary-foreground" :
                (answers[i] !== null && answers[i] !== undefined) ? "bg-muted text-foreground" :
                "bg-muted/30 text-muted-foreground")}>
              {i + 1}
            </button>
          ))}
        </div>
        {currentQ < questions.length - 1 ? (
          <button onClick={onNext}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button onClick={onSubmit} disabled={!allAnswered}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity">
            Submit <CheckCircle2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Summary View ───────────────────────────────────────────────────────────

function SummaryView({ data, onRegenerate }: { data: SummaryData | null; onRegenerate: () => void }) {
  if (!data) return <EmptyTabState label="No summary yet" action="Generate Summary" onAction={onRegenerate} />;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-foreground">{data.title}</h3>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{data.overview}</p>
      </div>

      {data.sections.map((sec, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">{sec.heading}</h4>
          <ul className="space-y-1.5">
            {sec.points.map((pt, pi) => (
              <li key={pi} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-1 shrink-0">•</span>
                <MathRenderer text={pt} className="text-sm" />
              </li>
            ))}
          </ul>
          {sec.keyTerms && sec.keyTerms.length > 0 && (
            <div className="pt-2 border-t border-border space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">Key Terms</p>
              {sec.keyTerms.map((kt, ki) => (
                <div key={ki} className="flex gap-2 text-xs">
                  <span className="font-semibold text-foreground shrink-0">{kt.term}:</span>
                  <span className="text-muted-foreground">{kt.definition}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {data.takeaways.length > 0 && (
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Key Takeaways</p>
          {data.takeaways.map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle2 size={13} className="text-primary shrink-0 mt-0.5" />
              <span className="text-foreground">{t}</span>
            </div>
          ))}
        </div>
      )}

      {data.relatedConcepts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.relatedConcepts.map((c, i) => (
            <span key={i} className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground">{c}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Study Guide View ───────────────────────────────────────────────────────

function StudyGuideView({ data, onRegenerate }: { data: StudyGuideData | null; onRegenerate: () => void }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  if (!data) return <EmptyTabState label="No study guide yet" action="Generate Study Guide" onAction={onRegenerate} />;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-foreground">{data.title}</h3>

      {data.sections.map((sec, i) => (
        <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
          <button onClick={() => setExpanded((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors">
            {sec.heading}
            {expanded.has(i) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expanded.has(i) && (
            <div className="px-4 pb-4 pt-1 border-t border-border">
              {sec.type === "overview" && (
                <p className="text-sm text-muted-foreground leading-relaxed">{sec.content}</p>
              )}
              {sec.type === "concepts" && (
                <div className="space-y-3">
                  {sec.items.map((item, ii) => (
                    <div key={ii} className="rounded-lg bg-muted/30 p-3 space-y-1">
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.explanation}</p>
                      {item.example && <p className="text-xs text-primary/80 italic">Example: {item.example}</p>}
                    </div>
                  ))}
                </div>
              )}
              {sec.type === "process" && (
                <ol className="space-y-2">
                  {sec.steps.map((step, si) => (
                    <li key={si} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{si + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              )}
              {sec.type === "tips" && (
                <ul className="space-y-2">
                  {sec.tips.map((tip, ti) => (
                    <li key={ti} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Star size={12} className="text-yellow-500 shrink-0 mt-0.5 fill-yellow-500" />
                      {tip}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}

      {data.quickRef && data.quickRef.length > 0 && (
        <div className="rounded-xl border-2 border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">Quick Reference</p>
          <div className="grid grid-cols-1 gap-1.5">
            {data.quickRef.map((ref, i) => (
              <div key={i} className="flex gap-3 text-xs">
                <span className="font-mono font-semibold text-foreground shrink-0 min-w-[120px]">{ref.label}</span>
                <span className="text-muted-foreground font-mono">{ref.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Slides View ────────────────────────────────────────────────────────────

function SlidesView({ data, slideIdx, onPrev, onNext, onRegenerate }: {
  data: SlideData | null; slideIdx: number;
  onPrev: () => void; onNext: () => void; onRegenerate: () => void;
}) {
  if (!data || !data.slides.length) return <EmptyTabState label="No slides yet" action="Generate Slides" onAction={onRegenerate} />;

  const slide = data.slides[slideIdx];
  const total = data.slides.length;

  return (
    <div className="space-y-4">
      {/* Slide counter */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">{data.title}</h3>
        <span className="text-xs text-muted-foreground">{slideIdx + 1} / {total}</span>
      </div>

      {/* Slide card */}
      <div className="rounded-2xl border-2 border-border bg-card overflow-hidden shadow-md"
        style={{ aspectRatio: "16/9", display: "flex", flexDirection: "column" }}>

        {slide.type === "title" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-primary/10 to-primary/5">
            <p className="text-2xl font-bold text-foreground mb-2">{slide.title}</p>
            {slide.subtitle && <p className="text-sm text-muted-foreground">{slide.subtitle}</p>}
            <div className="mt-4 w-12 h-0.5 bg-primary/40 rounded-full" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-6">
            <div className="pb-3 mb-3 border-b border-border flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-primary" />
              <h3 className="text-base font-bold text-foreground">{slide.title}</h3>
              <span className="ml-auto text-[10px] text-muted-foreground/40 font-mono">{slideIdx + 1}</span>
            </div>
            <div className="flex-1 space-y-2">
              {slide.bullets?.map((b, bi) => (
                <div key={bi} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <p className="text-sm text-foreground leading-snug">{b}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Speaker notes */}
      {slide.notes && (
        <div className="rounded-xl bg-muted/30 border border-border px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-1">Speaker Notes</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{slide.notes}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button onClick={onPrev} disabled={slideIdx === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm border border-border hover:bg-muted disabled:opacity-30 transition-colors">
          <ChevronLeft size={14} /> Prev
        </button>
        <div className="flex-1 flex gap-1 justify-center overflow-x-auto">
          {data.slides.map((_, i) => (
            <div key={i} className={cn("w-2 h-2 rounded-full transition-colors",
              i === slideIdx ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
        <button onClick={onNext} disabled={slideIdx === total - 1}
          className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm border border-border hover:bg-muted disabled:opacity-30 transition-colors">
          Next <ChevronRight size={14} />
        </button>
      </div>

      {/* Slide outline */}
      <div className="grid grid-cols-3 gap-2">
        {data.slides.map((s, i) => (
          <button key={i}
            className={cn("text-left p-2.5 rounded-xl border text-[11px] transition-colors",
              i === slideIdx ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/30")}>
            <p className="font-medium text-foreground truncate">{s.title}</p>
            <p className="text-muted-foreground/50 mt-0.5">{i + 1}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Weak Points View ───────────────────────────────────────────────────────

function WeakPointsView({ wrongTopics, questions, answers, submitted, currentQ, score, onAnswer, onNext, onPrev, onSubmit, onRetake, onClear, onGenerate }: {
  wrongTopics: string[]; questions: QuizQuestion[]; answers: (number | null)[];
  submitted: boolean; currentQ: number; score: number;
  onAnswer: (qi: number, ai: number) => void; onNext: () => void; onPrev: () => void;
  onSubmit: () => void; onRetake: () => void; onClear: () => void; onGenerate: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Weak topics */}
      <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-orange-500" />
            <p className="text-sm font-semibold text-foreground">Identified Weak Points</p>
          </div>
          {wrongTopics.length > 0 && (
            <button onClick={onClear} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors">Clear all</button>
          )}
        </div>
        {wrongTopics.length === 0 ? (
          <p className="text-xs text-muted-foreground/60">No weak points tracked yet. Take a quiz first — missed questions will appear here for targeted retesting.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {wrongTopics.map((t, i) => (
              <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/25">{t}</span>
            ))}
          </div>
        )}
      </div>

      {wrongTopics.length > 0 && questions.length === 0 && (
        <button onClick={onGenerate}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors">
          <Zap size={14} /> Generate Targeted Practice
        </button>
      )}

      {questions.length > 0 && !submitted && (
        <QuizView
          questions={questions} answers={answers} submitted={false}
          currentQ={currentQ} score={score}
          onAnswer={onAnswer} onNext={onNext} onPrev={onPrev}
          onSubmit={onSubmit} onRetake={onRetake} onRegenerate={onGenerate}
        />
      )}

      {submitted && (
        <div className="space-y-4">
          <div className="rounded-xl bg-card border border-border p-4 text-center">
            <div className="text-3xl font-bold text-foreground mb-1">{score}/{questions.length}</div>
            <p className="text-sm text-muted-foreground">Weak point practice complete</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onRetake} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
              <RotateCcw size={13} /> Retry
            </button>
            <button onClick={onGenerate} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors">
              <Zap size={13} /> New Practice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty tab placeholder ──────────────────────────────────────────────────

function EmptyTabState({ label, action, onAction }: { label: string; action: string; onAction: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
        <Sparkles size={22} className="text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground/50 mt-1">Click Generate above to create from your sources</p>
      </div>
      <button onClick={onAction}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
        <Zap size={14} /> {action}
      </button>
    </div>
  );
}
