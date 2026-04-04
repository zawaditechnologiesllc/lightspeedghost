import { Link, useRoute } from "wouter";
import { useState } from "react";
import {
  LayoutDashboard,
  PenLine,
  BookOpen,
  FlaskConical,
  ShieldCheck,
  GraduationCap,
  Files,
  Menu,
  X,
  Moon,
  Sun,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/app", label: "Dashboard", icon: LayoutDashboard },
  { path: "/write", label: "Write Paper", icon: PenLine },
  { path: "/outline", label: "Outline", icon: BookOpen },
  { path: "/revision", label: "Revision", icon: Files },
  { path: "/plagiarism", label: "AI & Plagiarism", icon: ShieldCheck },
  { path: "/stem", label: "STEM Solver", icon: FlaskConical },
  { path: "/study", label: "Study Assistant", icon: GraduationCap },
  { path: "/documents", label: "Documents", icon: Files },
];

function NavItem({ path, label, icon: Icon }: (typeof navItems)[0]) {
  const [isActive] = useRoute(path === "/app" ? "/app" : path + "*");
  return (
    <Link href={path}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        )}
      >
        <Icon size={16} className="shrink-0" />
        <span>{label}</span>
      </div>
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-30 w-60 bg-sidebar flex flex-col transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="px-4 py-4 border-b border-sidebar-border">
          <Logo size={28} textSize="text-sm" />
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-sidebar-border">
          <div className="text-sidebar-foreground/40 text-xs">
            AI Academic Writing Platform
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 bg-card border-b border-border shadow-sm shrink-0">
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="hidden lg:block" />
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
