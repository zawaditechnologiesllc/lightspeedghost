import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles, BookOpen, Zap, ClipboardCheck, Lightbulb,
  ImageIcon, Search, X, ExternalLink, GripHorizontal, Send,
  Paperclip, RotateCcw, Bot, ChevronDown,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import MathRenderer from "@/components/MathRenderer";
import { cn } from "@/lib/utils";

type Mode = "auto" | "learn" | "quick" | "exam" | "simplify" | "diagram" | "research";

interface ModeConfig {
  key: Mode;
  label: string;
  icon: React.ElementType;
  color: string;
  activeBg: string;
  badge: string;
}

const MODES: ModeConfig[] = [
  { key: "auto",     label: "Auto",     icon: Sparkles,       color: "text-violet-400", activeBg: "bg-violet-500/20 border-violet-400/40",  badge: "bg-violet-500/15 text-violet-300" },
  { key: "learn",    label: "Learn",    icon: BookOpen,       color: "text-blue-400",   activeBg: "bg-blue-500/20 border-blue-400/40",       badge: "bg-blue-500/15 text-blue-300" },
  { key: "quick",    label: "Quick",    icon: Zap,            color: "text-amber-400",  activeBg: "bg-amber-500/20 border-amber-400/40",     badge: "bg-amber-500/15 text-amber-300" },
  { key: "exam",     label: "Exam",     icon: ClipboardCheck, color: "text-green-400",  activeBg: "bg-green-500/20 border-green-400/40",     badge: "bg-green-500/15 text-green-300" },
  { key: "simplify", label: "Simplify", icon: Lightbulb,      color: "text-pink-400",   activeBg: "bg-pink-500/20 border-pink-400/40",       badge: "bg-pink-500/15 text-pink-300" },
  { key: "diagram",  label: "Diagram",  icon: ImageIcon,      color: "text-teal-400",   activeBg: "bg-teal-500/20 border-teal-400/40",       badge: "bg-teal-500/15 text-teal-300" },
  { key: "research", label: "Research", icon: Search,         color: "text-rose-400",   activeBg: "bg-rose-500/20 border-rose-400/40",       badge: "bg-rose-500/15 text-rose-300" },
];

function parseSSEBlock(chunk: string): { event: string; data: Record<string, unknown> }[] {
  const results: { event: string; data: Record<string, unknown> }[] = [];
  const blocks = chunk.split("\n\n");
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith(":")) continue;
    const lines = trimmed.split("\n");
    let eventName = "message";
    let dataStr = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) eventName = line.slice(7).trim();
      else if (line.startsWith("data: ")) dataStr += line.slice(6);
    }
    if (dataStr) {
      try { results.push({ event: eventName, data: JSON.parse(dataStr) as Record<string, unknown> }); } catch { /* skip */ }
    }
  }
  return results;
}

interface AssistantPanelProps {
  /** If true the panel is rendered standalone (no drag, fills container) */
  standalone?: boolean;
  onClose?: () => void;
  onPopOut?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function AssistantPanel({
  standalone = false,
  onClose,
  onPopOut,
  dragHandleProps,
}: AssistantPanelProps) {
  const [mode, setMode] = useState<Mode>("auto");
  const [question, setQuestion] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/png");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [detectedMode, setDetectedMode] = useState<Mode | null>(null);
  const [resolvedModeLabel, setResolvedModeLabel] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"quota" | "plan_gate" | "general" | null>(null);
  const [queriesRemaining, setQueriesRemaining] = useState<number | null>(null);
  const [imageEnabled, setImageEnabled] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeModeConfig = MODES.find(m => m.key === mode) ?? MODES[0];

  const clearImage = () => {
    setImageBase64(null);
    setImageMimeType("image/png");
    setImagePreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImageMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64 = result.split(",")[1];
      setImageBase64(base64);
      setImagePreviewUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const ask = async () => {
    if (!question.trim() && !imageBase64) return;
    if (isLoading) {
      abortRef.current?.abort();
      return;
    }

    // Snapshot before clearing so the API call still has the text
    const questionSnapshot = question.trim();
    const imageSnapshot = imageBase64;
    const mimeSnapshot = imageMimeType;

    setIsLoading(true);
    setError(null);
    setErrorType(null);
    setAnswer("");
    setQuestion("");   // clear input immediately on send
    clearImage();      // clear attached image immediately
    setDetectedMode(null);
    setResolvedModeLabel("");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await apiFetch("/assistant/ask-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questionSnapshot,
          mode,
          imageBase64: imageSnapshot ?? undefined,
          mimeType: imageSnapshot ? mimeSnapshot : undefined,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        setError("Request failed — please try again.");
        setIsLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const boundary = buffer.lastIndexOf("\n\n");
        if (boundary === -1) continue;
        const chunk = buffer.slice(0, boundary + 2);
        buffer = buffer.slice(boundary + 2);

        for (const { event, data } of parseSSEBlock(chunk)) {
          if (event === "meta") {
            if (data.detected) setDetectedMode(data.mode as Mode);
            setResolvedModeLabel(data.modeLabel as string);
            if (typeof data.queriesRemaining === "number") setQueriesRemaining(data.queriesRemaining);
            if (typeof data.imageEnabled === "boolean") setImageEnabled(data.imageEnabled);
          } else if (event === "token") {
            setAnswer(prev => prev + (data.text as string));
            requestAnimationFrame(() => {
              if (answerRef.current) {
                answerRef.current.scrollTop = answerRef.current.scrollHeight;
              }
            });
          } else if (event === "error") {
            setError(data.message as string);
            setErrorType((data.type as "quota" | "plan_gate") ?? "general");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Something went wrong — please try again.");
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  const reset = () => {
    setAnswer("");
    setError(null);
    setDetectedMode(null);
    setResolvedModeLabel("");
    setQuestion("");
    clearImage();
    textareaRef.current?.focus();
  };

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const detectedConfig = detectedMode ? MODES.find(m => m.key === detectedMode) : null;

  return (
    <div className="flex flex-col h-full bg-[#0c0f1a] text-white overflow-hidden">
      {/* ── Header / drag handle ─────────────────────────────── */}
      <div
        {...dragHandleProps}
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 border-b border-white/8 select-none flex-shrink-0",
          !standalone && "cursor-grab active:cursor-grabbing",
        )}
        style={{ background: "linear-gradient(135deg, #0f1527 0%, #111827 100%)" }}
      >
        {!standalone && (
          <GripHorizontal size={14} className="text-white/25 flex-shrink-0" />
        )}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="w-5 h-5 rounded-md bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
            <Sparkles size={11} className="text-violet-400" />
          </div>
          <span className="text-xs font-semibold text-white/80 truncate">LightSpeed AI</span>
          {resolvedModeLabel && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0", activeModeConfig.badge, "border-white/10")}>
              {resolvedModeLabel}
              {detectedConfig && mode === "auto" && (
                <span className="text-white/40 ml-0.5">• auto</span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {answer && (
            <button
              onClick={reset}
              title="New question"
              className="p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors"
            >
              <RotateCcw size={12} />
            </button>
          )}
          {onPopOut && (
            <button
              onClick={onPopOut}
              title="Pop out to window"
              className="p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors"
            >
              <ExternalLink size={12} />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Mode selector ────────────────────────────────────── */}
      <div className="flex gap-1 px-2.5 py-2 overflow-x-auto scrollbar-none flex-shrink-0 border-b border-white/6">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => { abortRef.current?.abort(); setIsLoading(false); setMode(m.key); setAnswer(""); setError(null); setErrorType(null); setDetectedMode(null); setResolvedModeLabel(""); }}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap border transition-all flex-shrink-0",
                isActive
                  ? cn(m.activeBg, m.color)
                  : "border-transparent text-white/40 hover:text-white/70 hover:bg-white/6",
              )}
            >
              <Icon size={10} />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* ── Response area ────────────────────────────────────── */}
      <div
        ref={answerRef}
        className="flex-1 overflow-y-auto px-3 py-3 min-h-0"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {!answer && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-6">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", activeModeConfig.activeBg)}>
              {(() => { const Icon = activeModeConfig.icon; return <Icon size={18} className={activeModeConfig.color} />; })()}
            </div>
            <div>
              <p className="text-xs font-medium text-white/50 mb-1">
                {mode === "auto" ? "Auto-detect mode" : activeModeConfig.label + " mode"}
              </p>
              <p className="text-[11px] text-white/25 max-w-[240px] leading-relaxed">
                {mode === "auto" && "Type any question — I'll pick the best approach automatically."}
                {mode === "learn" && "Ask any topic for a step-by-step breakdown."}
                {mode === "quick" && "Get a fast, direct answer in 2–4 sentences."}
                {mode === "exam" && "Paste a multiple-choice question — I'll pick the right answer."}
                {mode === "simplify" && "Paste anything complex — I'll explain it simply."}
                {mode === "diagram" && "Upload an image or describe a diagram to get an explanation."}
                {mode === "research" && "Ask a research question for a detailed, sourced response."}
              </p>
            </div>
            <p className="text-[10px] text-white/15">Drop an image to upload it</p>
          </div>
        )}

        {isLoading && !answer && (
          <div className="flex items-center gap-2 text-white/40 text-xs py-4">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
            </div>
            <span>Thinking…</span>
          </div>
        )}

        {error && errorType === "quota" && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-2">
            <p className="text-xs text-amber-300 leading-relaxed">{error}</p>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              Upgrade to Pro — unlimited access
            </a>
          </div>
        )}
        {error && errorType === "plan_gate" && (
          <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-3 space-y-2">
            <p className="text-xs text-violet-300 leading-relaxed">{error}</p>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              Upgrade to Pro
            </a>
          </div>
        )}
        {error && !errorType && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {answer && (
          <div className="text-[13px] leading-relaxed text-white/85">
            <MathRenderer text={answer} className="text-[13px]" />
          </div>
        )}
      </div>

      {/* ── Image preview ────────────────────────────────────── */}
      {imagePreviewUrl && (
        <div className="px-3 pt-2 flex-shrink-0">
          <div className="relative inline-block">
            <img
              src={imagePreviewUrl}
              alt="Uploaded"
              className="h-16 w-auto rounded-lg border border-white/10 object-cover"
            />
            <button
              onClick={clearImage}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"
            >
              <X size={9} />
            </button>
          </div>
        </div>
      )}

      {/* ── Input area ───────────────────────────────────────── */}
      <div className="px-3 py-2.5 border-t border-white/8 flex-shrink-0 bg-[#0c0f1a]">
        <div className="flex gap-2 items-end">
          <div className="flex-1 min-w-0 rounded-xl bg-white/6 border border-white/10 overflow-hidden focus-within:border-violet-500/40 focus-within:bg-white/8 transition-all">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "diagram" ? "Describe the diagram (or upload an image above)…" :
                mode === "exam"    ? "Paste the multiple-choice question here…" :
                "Ask anything… (Enter to send)"
              }
              rows={2}
              className="w-full bg-transparent text-[12px] text-white/85 placeholder:text-white/25 px-3 pt-2.5 pb-1 resize-none outline-none"
              style={{ minHeight: "52px", maxHeight: "120px" }}
            />
            <div className="flex items-center justify-between px-2 pb-2">
              {imageEnabled ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  title="Upload image"
                  className="p-1 rounded text-white/25 hover:text-white/60 hover:bg-white/8 transition-colors"
                >
                  <Paperclip size={13} />
                </button>
              ) : (
                <button
                  onClick={() => {}}
                  title="Image upload — Pro plan only"
                  className="p-1 rounded text-white/15 cursor-not-allowed flex items-center gap-1"
                >
                  <Paperclip size={13} />
                  <span className="text-[9px] text-violet-400/70 font-semibold">PRO</span>
                </button>
              )}
              <div className="flex items-center gap-2">
                {queriesRemaining !== null && (
                  <span className={cn(
                    "text-[10px] font-medium",
                    queriesRemaining <= 5 ? "text-amber-400/80" : "text-white/20"
                  )}>
                    {queriesRemaining} left this month
                  </span>
                )}
                <span className="text-[10px] text-white/15">Shift+Enter for new line</span>
              </div>
            </div>
          </div>
          <button
            onClick={ask}
            disabled={!question.trim() && !imageBase64}
            className={cn(
              "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all",
              isLoading
                ? "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
                : (question.trim() || imageBase64)
                  ? "bg-violet-500 hover:bg-violet-400 text-white shadow-lg shadow-violet-500/25"
                  : "bg-white/6 text-white/20 cursor-not-allowed",
            )}
            title={isLoading ? "Stop" : "Ask (Enter)"}
          >
            {isLoading ? <X size={14} /> : <Send size={14} />}
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   FloatingWidget — the trigger button + draggable overlay in-app
───────────────────────────────────────────────────────────────── */
export default function FloatingWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: -1, y: -1 }); // -1 = not yet calculated
  const [isMobile, setIsMobile] = useState(false);
  const dragState = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const PANEL_W = 380;
  const PANEL_H = 540;

  // Track mobile breakpoint (< 1024px = lg in Tailwind)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Initialise panel position once viewport is known.
  // Both desktop and mobile: spawn from bottom-right so it never overlaps the left sidebar.
  useEffect(() => {
    if (position.x === -1 && window.innerWidth > 0) {
      const mobile = window.innerWidth < 1024;
      setPosition(
        mobile
          ? { x: Math.max(8, window.innerWidth - PANEL_W - 8), y: Math.max(16, window.innerHeight - PANEL_H - 120) }
          : { x: Math.max(8, window.innerWidth - PANEL_W - 24), y: Math.max(16, window.innerHeight - PANEL_H - 80) },
      );
    }
  }, [position.x]);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      dragState.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        origX: position.x,
        origY: position.y,
      };
      e.preventDefault();
    },
    [position],
  );

  const onTouchDragStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      dragState.current = {
        active: true,
        startX: t.clientX,
        startY: t.clientY,
        origX: position.x,
        origY: position.y,
      };
    },
    [position],
  );

  useEffect(() => {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    const onMouseMove = (e: MouseEvent) => {
      if (!dragState.current.active) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      setPosition({
        x: clamp(dragState.current.origX + dx, 0, window.innerWidth - PANEL_W),
        y: clamp(dragState.current.origY + dy, 0, window.innerHeight - 60),
      });
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragState.current.active) return;
      const t = e.touches[0];
      const dx = t.clientX - dragState.current.startX;
      const dy = t.clientY - dragState.current.startY;
      setPosition({
        x: clamp(dragState.current.origX + dx, 0, window.innerWidth - PANEL_W),
        y: clamp(dragState.current.origY + dy, 0, window.innerHeight - 60),
      });
      e.preventDefault();
    };

    const onUp = () => { dragState.current.active = false; };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  const popOut = () => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const url = `${window.location.origin}${base}/assistant`;
    window.open(url, "lsg-assistant", `width=420,height=680,resizable=yes,scrollbars=yes,left=${window.screen.width - 460},top=60`);
    setIsOpen(false);
  };

  if (position.x === -1) return null;

  return (
    <>
      {/* ── Floating trigger button ──
          Both desktop and mobile: bottom-right so it never overlaps the left sidebar.
          Mobile/iOS/Android: safe-area-inset-bottom clears the home indicator and
          the fixed bottom nav bar.
          z-index 999999 places us above Tidio (capped at 999998 via index.html CSS).
      */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed z-[999999] w-12 h-12 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white shadow-xl shadow-violet-600/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95",
            isMobile ? "right-4" : "right-6 bottom-6",
          )}
          style={isMobile ? { bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" } : undefined}
          title="Open AI Assistant"
        >
          <Sparkles size={20} />
        </button>
      )}

      {/* ── Draggable panel ── */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed z-[999999] rounded-2xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden"
          style={{
            left: position.x,
            top: position.y,
            width: isMobile ? Math.min(PANEL_W, window.innerWidth - 16) : PANEL_W,
            height: PANEL_H,
          }}
        >
          <AssistantPanel
            onClose={() => setIsOpen(false)}
            onPopOut={popOut}
            dragHandleProps={{
              onMouseDown: onDragStart,
              onTouchStart: onTouchDragStart,
            }}
          />
        </div>
      )}
    </>
  );
}
