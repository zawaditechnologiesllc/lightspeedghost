import { useState, useRef, useEffect } from "react";
import {
  useAskStudyAssistant,
  useListStudySessions,
  useGetSessionMessages,
  getListStudySessionsQueryKey,
  getGetSessionMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, GraduationCap, Plus, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StudyAssistant() {
  const [currentSessionId, setCurrentSessionId] = useState<number | undefined>();
  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [mode, setMode] = useState<"tutor" | "explain" | "quiz" | "summarize">("tutor");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: sessions } = useListStudySessions();
  const { data: sessionMessages } = useGetSessionMessages(
    currentSessionId!,
    { query: { enabled: !!currentSessionId, queryKey: getGetSessionMessagesQueryKey(currentSessionId!) } }
  );
  const askAssistant = useAskStudyAssistant();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const startNewSession = () => {
    setCurrentSessionId(undefined);
    setLocalMessages([]);
  };

  const handleSend = async () => {
    if (!input.trim() || askAssistant.isPending) return;

    const userMessage = input.trim();
    setInput("");
    setLocalMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const res = await askAssistant.mutateAsync({
        question: userMessage,
        sessionId: currentSessionId,
        mode,
      });

      setCurrentSessionId(res.sessionId);
      setLocalMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
      queryClient.invalidateQueries({ queryKey: getListStudySessionsQueryKey() });
    } catch {
      setLocalMessages((prev) => [...prev, { role: "assistant", content: "I encountered an error. Please try again." }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayMessages = currentSessionId && sessionMessages?.messages.length
    ? sessionMessages.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    : localMessages;

  return (
    <div className="h-full flex overflow-hidden">
      <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 overflow-hidden">
        <div className="px-3 py-3 border-b border-sidebar-border">
          <button
            onClick={startNewSession}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            New Session
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {sessions?.sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => {
                setCurrentSessionId(session.id);
                setLocalMessages([]);
              }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors",
                currentSessionId === session.id
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <div className="font-medium truncate">{session.title}</div>
              <div className="text-sidebar-foreground/40 mt-0.5">{session.messageCount} messages</div>
            </button>
          ))}
          {(!sessions?.sessions || sessions.sessions.length === 0) && (
            <div className="text-center text-sidebar-foreground/30 text-xs py-4">No sessions yet</div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card shrink-0">
          <GraduationCap size={16} className="text-primary" />
          <span className="font-semibold text-sm">AI Study Assistant</span>
          <div className="ml-auto flex gap-1">
            {(["tutor", "explain", "quiz", "summarize"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors ${
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {displayMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap size={24} className="text-primary" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Ready to help you learn</div>
                <div className="text-muted-foreground text-sm mt-1">Ask any question — I'll explain it step by step</div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 max-w-sm w-full">
                {[
                  "Explain quantum entanglement",
                  "Solve a calculus problem",
                  "Summarize organic chemistry",
                  "Help me with statistics",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-2 rounded-lg border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0 mt-1">
                  <MessageSquare size={12} className="text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border text-foreground rounded-tl-sm"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {askAssistant.isPending && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0">
                <MessageSquare size={12} className="text-primary" />
              </div>
              <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="px-4 pb-4 shrink-0">
          <div className="flex gap-2 items-end bg-card border border-border rounded-xl p-2 focus-within:ring-2 focus-within:ring-ring">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask a question... (Enter to send, Shift+Enter for new line)"
              className="flex-1 px-2 py-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed max-h-32"
              style={{ height: "auto", minHeight: "36px" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || askAssistant.isPending}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
