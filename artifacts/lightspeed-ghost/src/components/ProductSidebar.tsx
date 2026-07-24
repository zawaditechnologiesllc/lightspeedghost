import { Link } from "wouter";
import {
  Plus, PenLine, ListTree, FileEdit, Wand2,
  FlaskConical, GraduationCap, BookOpen, X,
} from "lucide-react";
import { Logo } from "@/components/Logo";

// ── Product tool rail (left sidebar) ─────────────────────────────────────────
// A fixed vertical rail of the eight tools, icon + tiny label, modeled on the
// app-shell layout. On desktop it's always visible; on mobile it slides in as a
// drawer. Every tool links to its real route — AuthGuard redirects logged-out
// visitors into sign-up, so clicking a tool "opens the system" just like the
// signed-in app does.

export interface ToolNavItem {
  label: string;
  href: string;
  icon: typeof PenLine;
  accent: string; // tailwind text color for the icon
}

// AI & Plagiarism is intentionally NOT a standalone tool here — that check is
// blended into the free command box and still powers Write / Outline / Revision
// under the hood. Accents stay in the emerald/teal family for brand consistency.
export const TOOL_NAV: ToolNavItem[] = [
  { label: "Write Paper",  href: "/write",      icon: PenLine,        accent: "text-emerald-600" },
  { label: "Outline",      href: "/outline",    icon: ListTree,       accent: "text-teal-600" },
  { label: "Revision",     href: "/revision",   icon: FileEdit,       accent: "text-emerald-500" },
  { label: "Humanizer",    href: "/humanizer",  icon: Wand2,          accent: "text-teal-700" },
  { label: "STEM Solver",  href: "/stem",       icon: FlaskConical,   accent: "text-green-600" },
  { label: "Study",        href: "/study",      icon: GraduationCap,  accent: "text-emerald-700" },
  { label: "Ebooks",       href: "/ebooks",     icon: BookOpen,       accent: "text-teal-500" },
];

function RailItem({ item, onNavigate }: { item: ToolNavItem; onNavigate?: () => void }) {
  const { label, href, icon: Icon, accent } = item;
  return (
    <Link href={href}>
      <span
        onClick={onNavigate}
        className="group flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl cursor-pointer hover:bg-[#e8f3ed] transition-colors"
        title={label}
      >
        <span className="w-9 h-9 rounded-lg bg-[#eef7f1] border border-[#e0e3e5] flex items-center justify-center group-hover:border-[#10b981]/40 group-hover:bg-white transition-colors">
          <Icon size={17} className={accent} />
        </span>
        <span className="text-[9px] font-semibold text-[#45464d] leading-tight text-center group-hover:text-[#10b981] transition-colors">
          {label}
        </span>
      </span>
    </Link>
  );
}

// Desktop rail — fixed to the left edge, below the full-width top header
// (which carries the logo + wordmark).
export function ProductSidebar() {
  return (
    <aside className="hidden lg:flex fixed top-16 left-0 bottom-0 w-[84px] bg-white border-r border-[#e0e3e5] flex-col z-30">
      <div className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
        {/* New — start a fresh document */}
        <Link href="/app">
          <span className="group flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl cursor-pointer hover:bg-[#10b981]/5 transition-colors" title="New">
            <span className="w-9 h-9 rounded-lg bg-[#10b981] flex items-center justify-center shadow-sm shadow-[#10b981]/30 group-hover:bg-[#059669] transition-colors">
              <Plus size={18} className="text-white" strokeWidth={2.5} />
            </span>
            <span className="text-[9px] font-semibold text-[#45464d] leading-tight group-hover:text-[#10b981] transition-colors">New</span>
          </span>
        </Link>

        <div className="my-1.5 mx-3 border-t border-[#eceef0]" />

        {TOOL_NAV.map((item) => (
          <RailItem key={item.href} item={item} />
        ))}
      </div>
    </aside>
  );
}

// Mobile drawer — same items, wider rows, slides in from the left.
export function ProductSidebarDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="lg:hidden fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#131b2e]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute top-0 left-0 bottom-0 w-72 max-w-[80%] bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
        <div className="flex items-center justify-between h-16 px-4 border-b border-[#e0e3e5] shrink-0">
          <Logo size={26} textSize="text-sm" variant="light" />
          <button onClick={onClose} aria-label="Close menu" className="p-2 rounded-lg text-[#45464d] hover:bg-[#e8f3ed] transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <Link href="/app">
            <span onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#10b981]/5 cursor-pointer">
              <span className="w-8 h-8 rounded-lg bg-[#10b981] flex items-center justify-center shrink-0">
                <Plus size={16} className="text-white" strokeWidth={2.5} />
              </span>
              <span className="text-sm font-semibold text-[#191c1e]">New document</span>
            </span>
          </Link>
          <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#76777d]">Tools</p>
          {TOOL_NAV.map(({ label, href, icon: Icon, accent }) => (
            <Link key={href} href={href}>
              <span onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#e8f3ed] cursor-pointer transition-colors">
                <span className="w-8 h-8 rounded-lg bg-[#eef7f1] border border-[#e0e3e5] flex items-center justify-center shrink-0">
                  <Icon size={16} className={accent} />
                </span>
                <span className="text-sm font-medium text-[#191c1e]">{label}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
