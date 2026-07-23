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
  RotateCcw,
  Wand2,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
  Wallet,
  ShoppingCart,
  BookMarked,
  DollarSign,
  Plus,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import { ManageFundsModal } from "@/components/ManageFundsModal";
import { PAYGMarketModal } from "@/components/PAYGMarketModal";
import { AnnouncementBanner, NotificationBell } from "@/components/AnnouncementBanner";
import OfflineBanner from "@/components/OfflineBanner";

// The logged-in app shell shares the same frame as the marketing landing:
// logo + wordmark top-left, then the tool list down the left. It defaults to
// the expanded (labeled) view and collapses to an icon rail via the toggle.

const navItems = [
  { path: "/app",        label: "Dashboard",         icon: LayoutDashboard },
  { path: "/write",      label: "Write Paper",       icon: PenLine },
  { path: "/outline",    label: "Outline",           icon: BookOpen },
  { path: "/revision",   label: "Revision",          icon: Files },
  { path: "/humanizer",  label: "Humanizer",         icon: Wand2 },
  { path: "/plagiarism", label: "AI & Plagiarism",   icon: ShieldCheck },
  { path: "/stem",       label: "STEM Solver",       icon: FlaskConical },
  { path: "/study",      label: "Study Assistant",   icon: GraduationCap },
  { path: "/ebooks",     label: "Ebooks",            icon: BookMarked },
  { path: "/documents",  label: "History",           icon: Files },
  { path: "/earnings",   label: "Influencer",        icon: DollarSign },
];

const mobileBottomNav = [
  { path: "/write",      label: "Write",    icon: PenLine },
  { path: "/humanizer",  label: "Humanize", icon: Wand2 },
  { path: "/revision",   label: "Revise",   icon: RotateCcw },
  { path: "/plagiarism", label: "Check",    icon: ShieldCheck },
  { path: "/study",      label: "Study",    icon: GraduationCap },
];

// Desktop nav row — labeled when expanded, icon-only (with tooltip) when collapsed.
function NavRow({ path, label, icon: Icon, collapsed }: { path: string; label: string; icon: React.ElementType; collapsed: boolean }) {
  const [isActive] = useRoute(path === "/app" ? "/app" : path + "*");
  return (
    <Link href={path}>
      <span
        title={collapsed ? label : undefined}
        className={cn(
          "group relative flex items-center rounded-lg cursor-pointer transition-colors",
          collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
        )}
      >
        <Icon size={17} className="shrink-0" />
        {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
        {collapsed && (
          <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-popover border border-border text-popover-foreground text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
            {label}
          </span>
        )}
      </span>
    </Link>
  );
}

function DrawerItem({ path, label, icon: Icon, onClick }: { path: string; label: string; icon: React.ElementType; onClick: () => void }) {
  const [isActive] = useRoute(path === "/app" ? "/app" : path + "*");
  return (
    <Link href={path}>
      <span
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors",
          isActive ? "bg-sidebar-primary/10" : "hover:bg-sidebar-accent",
        )}
      >
        <span className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
          isActive ? "bg-sidebar-primary border-transparent text-sidebar-primary-foreground" : "bg-sidebar-accent/40 border-sidebar-border text-sidebar-foreground/70",
        )}>
          <Icon size={16} />
        </span>
        <span className={cn("text-sm font-medium", isActive ? "text-sidebar-primary" : "text-sidebar-foreground")}>{label}</span>
      </span>
    </Link>
  );
}

function MobileBottomNavItem({ path, label, icon: Icon }: { path: string; label: string; icon: React.ElementType }) {
  const [isActive] = useRoute(path === "/app" ? "/app" : path + "*");
  return (
    <Link href={path} className="flex-1">
      <div className={cn(
        "flex flex-col items-center gap-0.5 py-2 px-0.5 transition-colors w-full",
        isActive ? "text-sidebar-primary" : "text-sidebar-foreground/40"
      )}>
        <Icon size={17} />
        <span className="text-[8px] font-semibold leading-tight truncate w-full text-center">{label}</span>
      </div>
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { plan } = useSubscription();
  const [, navigate] = useLocation();
  const [fundsOpen, setFundsOpen] = useState(false);
  const [paygOpen, setPaygOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", String(collapsed)); } catch { /* non-fatal */ }
  }, [collapsed]);

  async function handleSignOut() {
    await signOut();
    navigate("/auth");
  }

  const userEmail = user?.email ?? "";
  const userName = userEmail.split("@")[0] ?? userEmail;
  const userInitial = userName[0]?.toUpperCase() ?? "?";

  const canUpgrade = !["pro", "institution", "campus"].includes(plan ?? "");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Desktop sidebar (expandable, labeled) ───────────────────────── */}
      <aside className={cn(
        "hidden lg:flex shrink-0 bg-sidebar border-r border-sidebar-border flex-col transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}>
        {/* Logo + wordmark + collapse toggle */}
        <div className={cn("flex items-center h-16 border-b border-sidebar-border shrink-0", collapsed ? "justify-center px-0" : "justify-between px-3")}>
          {!collapsed && (
            <Link href="/app">
              <span className="cursor-pointer select-none min-w-0"><Logo size={24} textSize="text-sm" /></span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0.5">
          {/* New — start writing */}
          <Link href="/write">
            <span
              title={collapsed ? "New paper" : undefined}
              className={cn(
                "group flex items-center rounded-lg cursor-pointer transition-opacity bg-sidebar-primary text-sidebar-primary-foreground shadow-sm hover:opacity-90",
                collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-2 px-3 py-2",
              )}
            >
              <Plus size={17} strokeWidth={2.5} className="shrink-0" />
              {!collapsed && <span className="text-sm font-semibold">New paper</span>}
            </span>
          </Link>

          <div className={cn("my-1.5 border-t border-sidebar-border", collapsed ? "mx-2" : "mx-1")} />

          {navItems.map((item) => (
            <NavRow key={item.path} {...item} collapsed={collapsed} />
          ))}
        </div>

        {/* Account + sign out */}
        <div className={cn("border-t border-sidebar-border shrink-0 py-3", collapsed ? "flex flex-col items-center gap-2" : "px-3")}>
          {collapsed ? (
            <>
              <button onClick={() => navigate("/billing")} title={`${userName} — Billing`} className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center hover:opacity-80 transition-opacity">
                <span className="text-sidebar-primary-foreground text-xs font-bold">{userInitial}</span>
              </button>
              <button onClick={handleSignOut} title="Sign out" className="p-1.5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2.5">
              <button onClick={() => navigate("/billing")} title="Billing" className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity">
                <span className="text-sidebar-primary-foreground text-xs font-bold">{userInitial}</span>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sidebar-foreground text-xs font-medium truncate">{userName}</p>
                <p className="text-sidebar-foreground/40 text-[10px]">Account</p>
              </div>
              <button onClick={handleSignOut} title="Sign out" className="p-1 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors shrink-0">
                <LogOut size={13} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[100]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-72 max-w-[80%] bg-sidebar shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border shrink-0">
              <Logo size={26} textSize="text-sm" />
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="p-2 rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <Link href="/write">
                <span onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-sidebar-primary/10 cursor-pointer">
                  <span className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
                    <Plus size={16} className="text-sidebar-primary-foreground" strokeWidth={2.5} />
                  </span>
                  <span className="text-sm font-semibold text-sidebar-foreground">New paper</span>
                </span>
              </Link>
              {navItems.map((item) => (
                <DrawerItem key={item.path} {...item} onClick={() => setMobileOpen(false)} />
              ))}
            </div>
            <div className="border-t border-sidebar-border p-3 flex items-center gap-2.5">
              <button onClick={() => { setMobileOpen(false); navigate("/billing"); }} className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0">
                <span className="text-sidebar-primary-foreground text-xs font-bold">{userInitial}</span>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sidebar-foreground text-xs font-medium truncate">{userName}</p>
                <p className="text-sidebar-foreground/40 text-[10px]">Account</p>
              </div>
              <button onClick={handleSignOut} title="Sign out" className="p-1.5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-card border-b border-border shadow-sm shrink-0">
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <Logo size={22} textSize="text-sm" className="lg:hidden" />

          <div className="flex items-center gap-1.5 ml-auto">
            {canUpgrade && (
              <button
                onClick={() => setFundsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-xs font-bold shadow-sm"
                title="Upgrade to Pro"
              >
                <Sparkles size={13} />
                Upgrade
              </button>
            )}
            <button
              onClick={() => setPaygOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500 hover:bg-orange-500/20 transition-colors text-xs font-semibold"
              title="Pay-As-You-Go Market"
            >
              <ShoppingCart size={13} />
              <span className="hidden sm:inline">PAYG</span>
            </button>
            <button
              onClick={() => setFundsOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors text-xs font-semibold"
              title="Manage Funds"
            >
              <Wallet size={13} />
              <span className="hidden sm:inline">Funds</span>
            </button>
            <NotificationBell />
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <OfflineBanner />
        <AnnouncementBanner />

        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav bar ──────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-sidebar border-t border-sidebar-border flex items-stretch" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {mobileBottomNav.map((item) => (
          <MobileBottomNavItem key={item.path} {...item} />
        ))}
      </nav>

      <ManageFundsModal open={fundsOpen} onClose={() => setFundsOpen(false)} />
      <PAYGMarketModal open={paygOpen} onClose={() => setPaygOpen(false)} />

    </div>
  );
}
