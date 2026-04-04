import { Link, useRoute, useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  PenLine,
  BookOpen,
  FlaskConical,
  ShieldCheck,
  GraduationCap,
  Files,
  Moon,
  Sun,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/app",       label: "Dashboard",      icon: LayoutDashboard },
  { path: "/write",     label: "Write Paper",     icon: PenLine },
  { path: "/outline",   label: "Outline",         icon: BookOpen },
  { path: "/revision",  label: "Revision",        icon: Files },
  { path: "/plagiarism",label: "AI & Plagiarism", icon: ShieldCheck },
  { path: "/stem",      label: "STEM Solver",     icon: FlaskConical },
  { path: "/study",     label: "Study Studio",    icon: GraduationCap },
  { path: "/documents", label: "Documents",       icon: Files },
];

function NavItem({
  path,
  label,
  icon: Icon,
  collapsed,
  onClick,
}: (typeof navItems)[0] & { collapsed: boolean; onClick?: () => void }) {
  const [isActive] = useRoute(path === "/app" ? "/app" : path + "*");

  return (
    <Link href={path}>
      <div
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={cn(
          "relative flex items-center rounded-lg text-sm font-medium transition-all cursor-pointer group",
          collapsed ? "justify-center px-0 py-2.5 mx-1" : "gap-3 px-3 py-2",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        )}
      >
        <Icon size={17} className="shrink-0" />

        {/* Label — hidden when collapsed */}
        {!collapsed && <span className="truncate">{label}</span>}

        {/* Tooltip when collapsed */}
        {collapsed && (
          <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-popover border border-border text-popover-foreground text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
            {label}
          </div>
        )}
      </div>
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") !== "false";
    } catch {
      return true;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [, navigate] = useLocation();

  // Persist sidebar state
  useEffect(() => {
    try {
      localStorage.setItem("sidebar-collapsed", String(collapsed));
    } catch {}
  }, [collapsed]);

  async function handleSignOut() {
    await signOut();
    navigate("/auth");
  }

  const userEmail = user?.email ?? "";
  const userInitial = userEmail[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-30 bg-sidebar flex flex-col",
          "transition-[width,transform] duration-200 ease-in-out overflow-hidden",
          // Desktop: width toggles between collapsed/expanded
          collapsed ? "lg:w-14" : "lg:w-60",
          // Mobile: full width slides in/out
          mobileOpen ? "translate-x-0 w-60" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo / toggle row */}
        <div
          className={cn(
            "flex items-center border-b border-sidebar-border shrink-0",
            collapsed ? "justify-center py-[13px] px-0" : "justify-between px-4 py-3.5"
          )}
        >
          {!collapsed && (
            <Logo size={26} textSize="text-sm" className="min-w-0" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav
          className={cn(
            "flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden",
            collapsed ? "px-0" : "px-2"
          )}
        >
          {navItems.map((item) => (
            <NavItem
              key={item.path}
              {...item}
              collapsed={collapsed}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        {/* User / sign out */}
        <div
          className={cn(
            "border-t border-sidebar-border shrink-0",
            collapsed ? "py-3 flex flex-col items-center gap-2" : "px-3 py-3"
          )}
        >
          {user && (
            collapsed ? (
              // Collapsed: just avatar + sign out stacked
              <>
                <div
                  title={userEmail}
                  className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0"
                >
                  <span className="text-sidebar-primary-foreground text-xs font-bold">{userInitial}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="p-1.5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <LogOut size={14} />
                </button>
              </>
            ) : (
              // Expanded: full user row
              <div className="flex items-center gap-2.5 mb-2 px-1">
                <div className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0">
                  <span className="text-sidebar-primary-foreground text-xs font-bold">{userInitial}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sidebar-foreground text-xs font-medium truncate">{userEmail}</p>
                  <p className="text-sidebar-foreground/40 text-[10px]">Student</p>
                </div>
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="p-1 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
                >
                  <LogOut size={13} />
                </button>
              </div>
            )
          )}

          {!collapsed && (
            <div className="text-sidebar-foreground/30 text-[10px] px-1">
              AI Academic Writing Platform
            </div>
          )}
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 bg-card border-b border-border shadow-sm shrink-0">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Menu size={18} />
          </button>
          <div className="hidden lg:block" />

          {/* Theme toggle */}
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
