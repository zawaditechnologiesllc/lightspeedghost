import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { RouteMeta } from "@/components/RouteMeta";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SplashScreen } from "@/components/SplashScreen";
// Eager: only the landing (first-paint path). Everything else — including Auth —
// is code-split so the entry bundle stays small and Supabase stays off the
// critical path (Google PageSpeed: reduce unused JavaScript).
import Landing from "@/pages/Landing";
import NotFound from "@/pages/not-found";
import { Loader2, Wrench } from "lucide-react";
import { useEffect, useState, useCallback, lazy, Suspense, Component, type ReactNode } from "react";
import { Logo } from "@/components/Logo";

const Auth = lazy(() => import("@/pages/Auth"));
const Admin = lazy(() => import("@/pages/Admin"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const WritePaper = lazy(() => import("@/pages/WritePaper"));
const Outline = lazy(() => import("@/pages/Outline"));
const Revision = lazy(() => import("@/pages/Revision"));
const Humanizer = lazy(() => import("@/pages/Humanizer"));
const Plagiarism = lazy(() => import("@/pages/Plagiarism"));
const StemSolver = lazy(() => import("@/pages/StemSolver"));
const StudyAssistant = lazy(() => import("@/pages/StudyAssistant"));
const Documents = lazy(() => import("@/pages/Documents"));
const Billing = lazy(() => import("@/pages/Billing"));
const Earnings = lazy(() => import("@/pages/Earnings"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const ConfirmEmail = lazy(() => import("@/pages/ConfirmEmail"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("@/pages/TermsOfService"));
const CookiePolicy = lazy(() => import("@/pages/CookiePolicy"));
const AcademicUsePolicy = lazy(() => import("@/pages/AcademicUsePolicy"));
const About = lazy(() => import("@/pages/About"));
const Contact = lazy(() => import("@/pages/Contact"));
const Careers = lazy(() => import("@/pages/Careers"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));
const RefundPolicy = lazy(() => import("@/pages/RefundPolicy"));
const PaymentSuccess = lazy(() => import("@/pages/PaymentSuccess"));
const Ebooks = lazy(() => import("@/pages/Ebooks"));
const Africa = lazy(() => import("@/pages/Africa"));
const Enterprise = lazy(() => import("@/pages/Enterprise"));
const Influencer = lazy(() => import("@/pages/Influencer"));
const FloatingAssistant = lazy(() => import("@/pages/FloatingAssistant"));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-muted-foreground" />
    </div>
  );
}

// Catches render crashes (a blank page otherwise) and stale-chunk errors
// after a deploy. Chunk-load failures trigger one automatic reload to pick
// up the new asset hashes; anything else shows a recover screen.
class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    const msg = String(error?.message ?? "");
    const isStaleChunk = /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(msg);
    if (isStaleChunk && sessionStorage.getItem("lsg_chunk_reload") !== "1") {
      sessionStorage.setItem("lsg_chunk_reload", "1");
      window.location.reload();
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center gap-4 p-6 text-center">
          <Logo size={32} />
          <p className="text-white/70 text-sm">Something went wrong loading this page.</p>
          <button
            onClick={() => { sessionStorage.removeItem("lsg_chunk_reload"); window.location.reload(); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function TidioChat() {
  useEffect(() => {
    const key = import.meta.env.VITE_TIDIO_PUBLIC_KEY;
    if (!key || document.querySelector(`script[src*="tidio.co"]`)) return;

    // Defer loading until idle/first interaction — Tidio is the single biggest
    // third-party cost on mobile PageSpeed (render-blocking + TBT).
    let loaded = false;
    function loadTidio() {
      if (loaded) return;
      loaded = true;
      const s = document.createElement("script");
      s.src = `//code.tidio.co/${key}.js`;
      s.async = true;
      document.head.appendChild(s);
    }
    const idleTimer = setTimeout(loadTidio, 6000);
    const interactionEvents: (keyof DocumentEventMap)[] = ["scroll", "pointerdown", "keydown", "touchstart"];
    const onInteract = () => { loadTidio(); cleanupListeners(); };
    function cleanupListeners() {
      interactionEvents.forEach((e) => document.removeEventListener(e, onInteract));
    }
    interactionEvents.forEach((e) => document.addEventListener(e, onInteract, { passive: true, once: false }));

    // Tidio re-applies inline styles (including `bottom`) on its iframe, which
    // beat stylesheet !important. We force a `transform` instead — Tidio never
    // manages transform inline, so ours always wins — and only while the
    // iframe is in its small bubble state, so the opened chat (which goes
    // full-screen on mobile) is never displaced. Re-assert on every style
    // rewrite via the observer, and poll as a safety net for the first load.
    const mq = window.matchMedia("(max-width: 1023px)");
    const LIFT = "translateY(calc(-84px - env(safe-area-inset-bottom, 0px)))";
    function liftBubble() {
      const iframe = document.getElementById("tidio-chat-iframe") as HTMLElement | null;
      if (!iframe) return;
      const isBubble = iframe.offsetWidth > 0 && iframe.offsetWidth < 200 && iframe.offsetHeight < 200;
      if (mq.matches && isBubble) {
        if (iframe.style.getPropertyValue("transform") !== LIFT) {
          iframe.style.setProperty("transform", LIFT, "important");
        }
      } else {
        iframe.style.removeProperty("transform");
      }
    }
    const observer = new MutationObserver(liftBubble);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
    mq.addEventListener?.("change", liftBubble);
    const liftPoll = setInterval(liftBubble, 1500);
    liftBubble();

    return () => {
      clearTimeout(idleTimer);
      clearInterval(liftPoll);
      cleanupListeners();
      observer.disconnect();
      mq.removeEventListener?.("change", liftBubble);
    };
  }, []);
  return null;
}

const queryClient = new QueryClient();

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

function MaintenanceScreen({ onRetry }: { onRetry: () => void }) {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { onRetry(); return 30; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [onRetry]);

  return (
    <div className="min-h-screen bg-[#050913] flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Wrench size={28} className="text-orange-400" />
        </div>
        <Logo size={36} />
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">Down for Maintenance</h1>
          <p className="text-sm text-white/45 leading-relaxed">
            We're performing scheduled maintenance to improve your experience. We'll be back shortly.
          </p>
        </div>
        <div className="w-full h-px bg-white/8" />
        <p className="text-xs text-white/30">
          Checking again in <span className="text-white/60 tabular-nums font-medium">{countdown}s</span>
        </p>
        <button
          onClick={onRetry}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
        >
          Check now
        </button>
      </div>
    </div>
  );
}

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  // Render the app immediately and probe maintenance status in the background.
  // Blocking first paint on a network round-trip gated the whole site (and would
  // defeat the pre-rendered landing). Maintenance is rare, so an optimistic
  // render with a late swap is the right trade-off.
  const [maintenance, setMaintenance] = useState(false);
  const [path] = useLocation();

  const check = useCallback(async () => {
    try {
      // No credentials: this is a public probe, and an anonymous request lets
      // the browser reuse the <link rel="preconnect"> connection to the API
      // origin (a credentialed request would open a separate socket).
      const res = await fetch(`${API_BASE}/status`);
      if (!res.ok) { setMaintenance(false); return; }
      const data = await res.json() as { maintenance?: boolean };
      setMaintenance(Boolean(data.maintenance));
    } catch {
      setMaintenance(false);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  if (path.startsWith("/mwaramuriuki-login")) return <>{children}</>;

  if (maintenance) {
    return <MaintenanceScreen onRetry={check} />;
  }

  return <>{children}</>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <AuthGuard>
      <Switch>
        <Route path="/assistant" component={FloatingAssistant} />
        <Route>
          <Layout>
            <Switch>
              <Route path="/app" component={Dashboard} />
              <Route path="/write" component={WritePaper} />
              <Route path="/outline" component={Outline} />
              <Route path="/revision" component={Revision} />
              <Route path="/humanizer" component={Humanizer} />
              <Route path="/plagiarism" component={Plagiarism} />
              <Route path="/stem" component={StemSolver} />
              <Route path="/study" component={StudyAssistant} />
              <Route path="/ebooks" component={Ebooks} />
              <Route path="/documents" component={Documents} />
              <Route path="/billing" component={Billing} />
              <Route path="/earnings" component={Earnings} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
    </AuthGuard>
  );
}

function AppRedirect() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading) {
      // Honor a destination stashed before an OAuth round-trip (e.g. the
      // influencer page's "Sign in to get your link"). Internal paths only.
      let next = "/app";
      try {
        const stored = sessionStorage.getItem("lsg_auth_next");
        sessionStorage.removeItem("lsg_auth_next");
        if (stored && stored.startsWith("/") && !stored.startsWith("//")) next = stored;
      } catch { /* non-fatal */ }
      navigate(user ? next : "/auth");
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-muted-foreground" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={Auth} />
      {/* OAuth return URL — Supabase parses the session from the URL, then
          AppRedirect sends the user to /app (or back to /auth on failure). */}
      <Route path="/auth/callback" component={AppRedirect} />
      <Route path="/mwaramuriuki-login" component={Admin} />
      <Route path="/mwaramuriuki-login/:tab" component={Admin} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/confirm-email" component={ConfirmEmail} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/refunds" component={RefundPolicy} />
      <Route path="/cookies" component={CookiePolicy} />
      <Route path="/academic-use" component={AcademicUsePolicy} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/careers" component={Careers} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/blog" component={Blog} />
      <Route path="/payment/success" component={PaymentSuccess} />
      <Route path="/africa" component={Africa} />
      <Route path="/enterprise" component={Enterprise} />
      <Route path="/influencer" component={Influencer} />
      <Route component={AppRoutes} />
    </Switch>
  );
}

function App() {
  // App booted successfully — re-arm the one-shot stale-chunk auto-reload
  // (see AppErrorBoundary) for the next deploy.
  useEffect(() => {
    const t = setTimeout(() => sessionStorage.removeItem("lsg_chunk_reload"), 10_000);
    return () => clearTimeout(t);
  }, []);

  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") return false;
    const isPwa =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isPwa && !sessionStorage.getItem("lsg_splash_shown")) {
      sessionStorage.setItem("lsg_splash_shown", "1");
      return true;
    }
    return false;
  });

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
          <AppErrorBoundary>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <RouteMeta />
              <MaintenanceGate>
                <AuthProvider>
                  <Suspense fallback={<RouteFallback />}>
                    <Router />
                  </Suspense>
                </AuthProvider>
              </MaintenanceGate>
            </WouterRouter>
          </AppErrorBoundary>
          <Toaster />
          <TidioChat />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
