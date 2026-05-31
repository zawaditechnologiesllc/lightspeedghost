import { useState, useEffect, useRef } from "react";
import { X, Bell, ExternalLink, Megaphone } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";
const DISMISSED_KEY = "lsg_dismissed_announcements";

export interface Announcement {
  id: number;
  title: string | null;
  message: string;
  link: string | null;
  link_text: string;
  color: string;
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/20",    text: "text-blue-100",    accent: "text-blue-400" },
  amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/20",   text: "text-amber-100",   accent: "text-amber-400" },
  red:     { bg: "bg-red-500/10",     border: "border-red-500/20",     text: "text-red-100",     accent: "text-red-400" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-100", accent: "text-emerald-400" },
  violet:  { bg: "bg-violet-500/10",  border: "border-violet-500/20",  text: "text-violet-100",  accent: "text-violet-400" },
};

function getDismissed(): Set<number> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch { return new Set(); }
}

function saveDismissed(ids: Set<number>) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])); } catch {}
}

export function useAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(getDismissed);

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch(`${API_BASE}/announcements`);
        if (!res.ok) return;
        const data = await res.json() as { announcements: Announcement[] };
        setItems(data.announcements ?? []);
      } catch {}
    }
    fetch_();
    const t = setInterval(fetch_, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  function dismiss(id: number) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }

  function dismissAll() {
    const next = new Set(items.map((a) => a.id));
    saveDismissed(next);
    setDismissed(next);
  }

  const visible = items.filter((a) => !dismissed.has(a.id));
  return { visible, dismiss, dismissAll };
}

// ── Bell icon for the header ───────────────────────────────────────────────────

export function NotificationBell() {
  const { visible, dismiss, dismissAll } = useAnnouncements();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const count = visible.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
        title="Notifications"
      >
        <Bell size={16} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl shadow-black/20 z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-muted-foreground" />
              <span className="text-sm font-semibold">Notifications</span>
              {count > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{count} new</span>
              )}
            </div>
            {count > 0 && (
              <button
                onClick={() => { dismissAll(); setOpen(false); }}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications list */}
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <Bell size={24} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">No new notifications</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {visible.map((a) => {
                const c = COLOR_MAP[a.color] ?? COLOR_MAP.blue;
                return (
                  <div key={a.id} className="relative px-4 py-3.5 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start gap-3 pr-6">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${c.accent.replace("text-", "bg-")}`} />
                      <div className="flex-1 min-w-0">
                        {a.title && (
                          <p className="text-xs font-semibold text-foreground mb-0.5">{a.title}</p>
                        )}
                        <p className="text-xs text-muted-foreground leading-relaxed">{a.message}</p>
                        {a.link && (
                          <a
                            href={a.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => dismiss(a.id)}
                            className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
                          >
                            {a.link_text} <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => dismiss(a.id)}
                      className="absolute top-3 right-3 p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                      aria-label="Dismiss"
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Banner strip below header (for high-visibility announcements) ──────────────

export function AnnouncementBanner() {
  const { visible, dismiss } = useAnnouncements();
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col">
      {visible.slice(0, 2).map((a) => {
        const c = COLOR_MAP[a.color] ?? COLOR_MAP.blue;
        return (
          <div
            key={a.id}
            className={`flex items-center gap-3 px-4 py-2 border-b ${c.bg} ${c.border} ${c.text}`}
          >
            <Megaphone size={12} className={`shrink-0 ${c.accent}`} />
            <p className="flex-1 text-xs leading-relaxed">
              {a.title && <span className="font-semibold mr-1.5">{a.title}:</span>}
              {a.message}
            </p>
            {a.link && (
              <a
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[10px] font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity flex items-center gap-1"
              >
                {a.link_text} <ExternalLink size={9} />
              </a>
            )}
            <button
              onClick={() => dismiss(a.id)}
              className="shrink-0 opacity-40 hover:opacity-80 transition-opacity"
              aria-label="Dismiss"
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
