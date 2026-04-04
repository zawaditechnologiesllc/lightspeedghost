import { useState, useRef, useEffect } from "react";
import {
  useAskStudyAssistant,
  useListStudySessions,
  useGetSessionMessages,
  getListStudySessionsQueryKey,
  getGetSessionMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, GraduationCap, Plus, MessageSquare, Loader2, Paperclip, BookOpen, Brain, HelpCircle, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import FileUploadZone, { type ExtractedFile } from "@/components/FileUploadZone";
import MathRenderer from "@/components/MathRenderer";

type LocalMessage = {
  role: "user" | "assistant";
  content: string;
  followUpQuestions?: string[];
};

const MODE_CONFIG = {
  tutor: { icon: GraduationCap, label: "Tutor", desc: "Step-by-step guidance", color: "text-blue-500" },
  explain: { icon: BookOpen, label: "Explain", desc: "Clear concept breakdown", color: "text-indigo-500" },
  quiz: { icon: HelpCircle, label: "Quiz", desc: "Test your knowledge", color: "text-violet-500" },
  summarize: { icon: AlignLeft, label: "Summarize", desc: "Key points only", color: "text-cyan-500" },
} as const;

const SUGGESTIONS = [
  "Explain quantum entanglement simply",
  "Solve ∫x²eˣ dx step by step",
  "Quiz me on organic chemistry",
  "Summarize the Central Dogma of biology",
  "Explain Bayes' theorem with examples",
  "Help me understand recursion in CS",
];

export default function StudyAssistant() {
  const [currentSessionId, setCurrentSessionId] = useState<number | undefined>();
  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [mode, setMode] = useState<"tutor" | "explain" | "quiz" | "summarize">("tutor");
  const [showUpload, setShowUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const { data: sessions } = useListStudySessions();
  const { data: sessionMessages } = useGetSessionMessages(
    currentSessionId!,
    { query: { enabled: !!currentSessionId, queryKey: getGetSessionMessagesQueryKey(currentSessionId!) } }
  );
  const askAssistant = useAskStudyAssistant();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, askAssistant.isPending]);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + "px";
    }
  }, [input]);

  const startNewSession = () => {
    setCurrentSessionId(undefined);
    setLocalMessages([]);
  };

  const handleStudyFileUploaded = (file: ExtractedFile) => {
    const preview = file.text.slice(0, 3000);
    const context = `[Study material: "${file.filename}" — ${file.wordCount} words]\n\n${preview}${file.text.length > 3000 ? "\n\n[...truncated — ask me about any part]" : ""}`;
    setInput(context);
    setShowUpload(false);
  };

  const handleSend = async (overrideInput?: string) => {
    const message = (overrideInput ?? input).trim();
    if (!message || askAssistant.isPending) return;

    setInput("");
    setLocalMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      const res = await askAssistant.mutateAsync({
        question: message,
        sessionId: currentSessionId,
        mode,
      });

      setCurrentSessionId(res.sessionId);
      setLocalMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer,
          followUpQuestions: res.followUpQuestions,
        },
      ]);
      queryClient.invalidateQueries({ queryKey: getListStudySessionsQueryKey() });
    } catch {
      setLocalMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayMessages: LocalMessage[] =
    currentSessionId && sessionMessages?.messages.length
      ? sessionMessages.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      : localMessages;

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-60 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 overflow-hidden">
        <div className="px-3 py-3 border-b border-sidebar-border">
          <button
            onClick={startNewSession}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            New Session
          </button>
        </div>

        {/* Mode selector in sidebar */}
        <div className="px-3 py-2 border-b border-sidebar-border space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-1 mb-1">Mode</div>
          {(Object.entries(MODE_CONFIG) as [keyof typeof MODE_CONFIG, typeof MODE_CONFIG[keyof typeof MODE_CONFIG]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors",
                mode === key
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <cfg.icon size={13} className={mode === key ? cfg.color : ""} />
              <span className="font-medium">{cfg.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-2 py-1">Sessions</div>
          {sessions?.sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => { setCurrentSessionId(session.id); setLocalMessages([]); }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors",
                currentSessionId === session.id
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <div className="font-medium truncate">{session.title}</div>
              <div className="text-sidebar-foreground/30 mt-0.5">{session.messageCount} messages</div>
            </button>
          ))}
          {(!sessions?.sessions || sessions.sessions.length === 0) && (
            <div className="text-center text-sidebar-foreground/30 text-xs py-6">No sessions yet</div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain size={14} className="text-primary" />
          </div>
          <div>
            <span className="font-semibold text-sm text-foreground">AI Study Assistant</span>
            <div className="text-[10px] text-muted-foreground leading-none mt-0.5">
              {MODE_CONFIG[mode].label} mode — {MODE_CONFIG[mode].desc}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {(Object.keys(MODE_CONFIG) as (keyof typeof MODE_CONFIG)[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {MODE_CONFIG[m].label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {displayMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <GraduationCap size={28} className="text-primary" />
              </div>
              <div>
                <div className="font-bold text-foreground text-base">Ready to help you learn</div>
                <div className="text-muted-foreground text-sm mt-1">
                  Your AI tutor — explains, quizzes, and remembers your progress
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-md w-full mt-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="px-3 py-2.5 rounded-xl border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/3 transition-all text-left leading-snug"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayMessages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare size={14} className="text-primary" />
                </div>
              )}
              <div className="max-w-[82%] space-y-2">
                <div
                  className={cn(
                    "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
                  )}
                >
                  {msg.role === "assistant"
                    ? <MathRenderer text={msg.content} className="text-sm text-foreground" />
                    : msg.content
                  }
                </div>

                {/* Follow-up question chips */}
                {msg.role === "assistant" && msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                  <div className="space-y-1.5 pl-1">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Follow-up questions</div>
                    {msg.followUpQuestions.map((q, qi) => (
                      <button
                        key={qi}
                        onClick={() => handleSend(q)}
                        disabled={askAssistant.isPending}
                        className="block w-full text-left text-xs px-3 py-2 rounded-xl border border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/40 transition-colors disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-muted-foreground">U</span>
                </div>
              )}
            </div>
          ))}

          {/* Thinking indicator */}
          {askAssistant.isPending && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MessageSquare size={14} className="text-primary" />
              </div>
              <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <div
                      key={d}
                      className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: `${d * 0.15}s` }}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="px-4 pb-4 space-y-2 shrink-0 border-t border-border pt-3">
          {showUpload && (
            <FileUploadZone
              onExtracted={handleStudyFileUploaded}
              accept=".pdf,.docx,.doc,.txt,.md"
              label="Upload study material"
              hint="Lecture notes, textbooks, articles — loads into chat"
            />
          )}
          <div className="flex gap-2 items-end bg-card border border-border rounded-xl p-2 focus-within:ring-2 focus-within:ring-ring transition-shadow">
            <button
              onClick={() => setShowUpload((v) => !v)}
              title="Upload study material"
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-colors shrink-0",
                showUpload
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Paperclip size={14} />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={`Ask a question in ${MODE_CONFIG[mode].label} mode... (Enter to send)`}
              className="flex-1 px-2 py-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed"
              style={{ minHeight: "36px", maxHeight: "128px" }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || askAssistant.isPending}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
            >
              {askAssistant.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
