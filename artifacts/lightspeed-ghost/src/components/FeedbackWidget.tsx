import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";

interface FeedbackWidgetProps {
  type: "paper" | "stem" | "study" | "outline" | "revision" | "humanizer";
  documentId?: number;
  subject?: string;
  className?: string;
}

export function FeedbackWidget({ type, documentId, subject, className }: FeedbackWidgetProps) {
  const [rated, setRated] = useState<"up" | "down" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (rating: "up" | "down") => {
    if (rated || submitting) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, documentId, rating, subject }),
      });
      setRated(rating);
    } catch {
      // non-fatal — still show as rated locally
      setRated(rating);
    } finally {
      setSubmitting(false);
    }
  };

  if (rated) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <span className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium",
          rated === "up"
            ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400"
            : "border-rose-500/30 bg-rose-500/8 text-rose-600 dark:text-rose-400"
        )}>
          {rated === "up"
            ? <ThumbsUp size={12} className="fill-current" />
            : <ThumbsDown size={12} className="fill-current" />}
          Thanks — feedback recorded
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground">Was this helpful?</span>
      <button
        onClick={() => submit("up")}
        disabled={submitting}
        title="Yes, this was helpful"
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-emerald-600 hover:border-emerald-500/40 hover:bg-emerald-500/8 transition-all text-xs disabled:opacity-40"
      >
        <ThumbsUp size={13} />
        <span className="hidden sm:inline">Yes</span>
      </button>
      <button
        onClick={() => submit("down")}
        disabled={submitting}
        title="No, needs improvement"
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-rose-600 hover:border-rose-500/40 hover:bg-rose-500/8 transition-all text-xs disabled:opacity-40"
      >
        <ThumbsDown size={13} />
        <span className="hidden sm:inline">No</span>
      </button>
    </div>
  );
}
