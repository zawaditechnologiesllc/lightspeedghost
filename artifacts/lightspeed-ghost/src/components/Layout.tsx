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
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Wallet,
  ShoppingCart,
  ChevronDown,
  BookMarked,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ManageFundsModal } from "@/components/ManageFundsModal";
import { PAYGMarketModal } from "@/components/PAYGMarketModal";
import { AnnouncementBanner, NotificationBell } from "@/components/AnnouncementBanner";
import OfflineBanner from "@/components/OfflineBanner";
import FloatingWidget from "@/components/FloatingWidget";
import { useUserProfile } from "@/hooks/useUserProfile";

const ACADEMIC_LEVELS = [
  { value: "high_school",   label: "High School",  short: "HS" },
  { value: "undergrad_1_2", label: "UG Year 1–2",  short: "UG1" },
  { value: "undergrad_3_4", label: "UG Year 3–4",  short: "UG3" },
  { value: "honours",       label: "Honours",       short: "Hon" },
  { value: "masters",       label: "Masters",       short: "MSc" },
  { value: "phd",           label: "PhD",           short: "PhD" },
];

const navItems = [
  { path: "/app",        label: "Dashboard",           icon: LayoutDashboard },
  { path: "/write",      label: "Write Paper",          icon: PenLine },
  { path: "/outline",    label: "Outline",              icon: BookOpen },
  { path: "/revision",   label: "Revision",             icon: Files },
  { path: "/humanizer",  label: "Humanizer",            icon: Wand2 },
  { path: "/plagiarism", label: "AI & Plagiarism",      icon: ShieldCheck },
  { path: "/stem",       label: "STEM Solver",          icon: FlaskConical },
  { path: "/study",      label: "AI Study Assistant",   icon: GraduationCap },
  { path: "/ebooks",     label: "Ebooks",               icon: BookMarked, badge: "Business" },
  { path: "/documents",  label: "History",              icon: Files },
];

const mobileBottomNav = [
  { path: "/write",      label: "Write",    icon: PenLine },
  { path: "/humanizer",  label: "Humanize", icon: Wand2 },
  { path: "/revision",   label: "Revise",   icon: RotateCcw },
  { path: "/plagiarism", label: "Check",    icon: ShieldCheck },
  { path: "/study",      label: "Study",    icon: GraduationCap },
];

function NavItem({
  path,
  label,
  icon: Icon,
  badge,
  collapsed,
  forceExpanded,
  onClick,
}: (typeof navItems)[0] & { collapsed: boolean; forceExpanded?: boolean; onClick?: () => void }) {
  const [isActive] = useRoute(path === "/app" ? "/app" : path + "*");
  const showLabel = forceExpanded || !collapsed;

  return (
    <Link href={path}>
      <div
        onClick={onClick}
        title={!showLabel ? label : undefined}
        className={cn(
          "relative flex items-center rounded-lg text-sm font-medium transition-all cursor-pointer group",
          showLabel ? "gap-3 px-3 py-2" : "justify-center px-0 py-2.5 mx-1",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        )}
      >
        <Icon size={17} className="shrink-0" />
        {showLabel && (
          <span className="truncate flex-1">{label}</span>
        )}
        {showLabel && badge && (
          <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[9px] font-bold leading-none shrink-0">
            {badge}
          </span>
        )}
        {!showLabel && (
          <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-popover border border-border text-popover-foreground text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
            {label}
          </div>
        )}
      </div>
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
    try {
      return localStorage.getItem("sidebar-collapsed") !== "false";
    } catch {
      return true;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [fundsOpen, setFundsOpen] = useState(false);
  const [paygOpen, setPaygOpen] = useState(false);
  const { academicLevel, profileLoaded, saveAcademicLevel } = useUserProfile();
  const currentLevel = ACADEMIC_LEVELS.find(l => l.value === academicLevel);

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
  const userName = userEmail.split("@")[0] ?? userEmail;
  const userInitial = userName[0]?.toUpperCase() ?? "?";

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
          collapsed ? "lg:w-14" : "lg:w-60",
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
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
          {/* Mobile close button */}
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden ml-auto p-1.5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav
          className={cn(
            "flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden",
            collapsed && !mobileOpen ? "px-0" : "px-2"
          )}
        >
          {navItems.map((item) => (
            <NavItem
              key={item.path}
              {...item}
              collapsed={collapsed}
              forceExpanded={mobileOpen}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        {/* User / sign out */}
        <div
          className={cn(
            "border-t border-sidebar-border shrink-0",
            (collapsed && !mobileOpen) ? "py-3 flex flex-col items-center gap-2" : "px-3 py-3"
          )}
        >
          {user && (
            (collapsed && !mobileOpen) ? (
              <>
                <button
                  onClick={() => navigate("/billing")}
                  title={`${userName} — Billing`}
                  className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"
                >
                  <span className="text-sidebar-primary-foreground text-xs font-bold">{userInitial}</span>
                </button>
                {/* Level icon — collapsed state */}
                {profileLoaded && currentLevel && (
                  <div className="relative group">
                    <button
                      onClick={() => setCollapsed(false)}
                      title={`Academic level: ${currentLevel.label} — click to change`}
                      className="p-1.5 rounded-md text-sidebar-foreground/40 hover:text-primary hover:bg-sidebar-accent transition-colors"
                    >
                      <GraduationCap size={14} />
                    </button>
                    <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-popover border border-border text-popover-foreground text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
                      {currentLevel.label}
                    </div>
                  </div>
                )}
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="p-1.5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <LogOut size={14} />
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5 mb-2 px-1">
                  <button
                    onClick={() => navigate("/billing")}
                    title="Billing"
                    className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"
                  >
                    <span className="text-sidebar-primary-foreground text-xs font-bold">{userInitial}</span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sidebar-foreground text-xs font-medium truncate">{userName}</p>
                    <p className="text-sidebar-foreground/40 text-[10px]">Account</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    title="Sign out"
                    className="p-1 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
                  >
                    <LogOut size={13} />
                  </button>
                </div>

                {/* Level indicator — expanded state */}
                {profileLoaded && (
                  <div className="px-1 mb-2">
                    <button
                      onClick={() => setLevelOpen(o => !o)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent transition-colors group"
                    >
                      <GraduationCap size={12} className="text-primary shrink-0" />
                      <span className="flex-1 text-left text-[11px] font-medium text-sidebar-foreground/70 group-hover:text-sidebar-foreground truncate">
                        {currentLevel?.label ?? "Set your level"}
                      </span>
                      <ChevronDown
                        size={11}
                        className={cn(
                          "text-sidebar-foreground/30 transition-transform duration-150",
                          levelOpen && "rotate-180"
                        )}
                      />
                    </button>
                    {levelOpen && (
                      <div className="mt-1.5 flex flex-wrap gap-1 px-1">
                        {ACADEMIC_LEVELS.map(lvl => (
                          <button
                            key={lvl.value}
                            onClick={() => { saveAcademicLevel(lvl.value); setLevelOpen(false); }}
                            className={cn(
                              "px-2 py-0.5 rounded-md border text-[10px] font-medium transition-all",
                              academicLevel === lvl.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-sidebar-border text-sidebar-foreground/50 hover:border-primary/40 hover:text-sidebar-foreground"
                            )}
                          >
                            {lvl.short}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          )}
          {(!collapsed || mobileOpen) && (
            <div className="text-sidebar-foreground/30 text-[10px] px-1">
              AI Academic Writing Platform
            </div>
          )}
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-card border-b border-border shadow-sm shrink-0">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Menu size={18} />
          </button>
          <div className="hidden lg:block" />

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPaygOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-colors text-xs font-semibold"
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
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Offline / connection status */}
        <OfflineBanner />

        {/* Announcement banners */}
        <AnnouncementBanner />

        {/* Page content — padded on mobile to avoid bottom nav overlap */}
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

      {/* ── Floating AI Assistant widget ───────────────────────────────── */}
      <FloatingWidget />
    </div>
  );
}
