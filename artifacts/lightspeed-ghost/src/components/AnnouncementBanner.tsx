import { useState, useEffect } from "react";
import { X, Megaphone, ExternalLink } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";
const DISMISSED_KEY = "lsg_dismissed_announcements";

interface Announcement {
  id: number;
  title: string | null;
  message: string;
  link: string | null;
  link_text: string;
  color: string;
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; icon: string; btn: string }> = {
  blue: {
    bg: "bg-blue-500/8",
    border: "border-blue-500/20",
    text: "text-blue-100",
    icon: "text-blue-400",
    btn: "bg-blue-500/15 hover:bg-blue-500/25 text-blue-200 border-blue-500/25",
  },
  amber: {
    bg: "bg-amber-500/8",
    border: "border-amber-500/20",
    text: "text-amber-100",
    icon: "text-amber-400",
    btn: "bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/25",
  },
  red: {
    bg: "bg-red-500/8",
    border: "border-red-500/20",
    text: "text-red-100",
    icon: "text-red-400",
    btn: "bg-red-500/15 hover:bg-red-500/25 text-red-200 border-red-500/25",
  },
  emerald: {
    bg: "bg-emerald-500/8",
    border: "border-emerald-500/20",
    text: "text-emerald-100",
    icon: "text-emerald-400",
    btn: "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-500/25",
  },
  violet: {
    bg: "bg-violet-500/8",
    border: "border-violet-500/20",
    text: "text-violet-100",
    icon: "text-violet-400",
    btn: "bg-violet-500/15 hover:bg-violet-500/25 text-violet-200 border-violet-500/25",
  },
};

function getDismissed(): Set<number> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<number>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(getDismissed);

  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        const res = await fetch(`${API_BASE}/announcements`);
        if (!res.ok) return;
        const data = await res.json() as { announcements: Announcement[] };
        setItems(data.announcements ?? []);
      } catch {}
    }
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  function dismiss(id: number) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }

  const visible = items.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-0">
      {visible.map((a) => {
        const c = COLOR_MAP[a.color] ?? COLOR_MAP.blue;
        return (
          <div
            key={a.id}
            className={`flex items-center gap-3 px-4 py-2.5 border-b ${c.bg} ${c.border} ${c.text}`}
          >
            <Megaphone size={13} className={`shrink-0 ${c.icon}`} />
            <p className="flex-1 text-xs leading-relaxed">
              {a.title && <span className="font-semibold mr-1.5">{a.title}</span>}
              {a.message}
            </p>
            {a.link && (
              <a
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${c.btn}`}
              >
                {a.link_text}
                <ExternalLink size={9} />
              </a>
            )}
            <button
              onClick={() => dismiss(a.id)}
              className="shrink-0 p-1 rounded-md opacity-40 hover:opacity-80 transition-opacity"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
