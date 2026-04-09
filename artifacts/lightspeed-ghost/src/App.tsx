import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Admin from "@/pages/Admin";
import Dashboard from "@/pages/Dashboard";
import WritePaper from "@/pages/WritePaper";
import Outline from "@/pages/Outline";
import Revision from "@/pages/Revision";
import Humanizer from "@/pages/Humanizer";
import Plagiarism from "@/pages/Plagiarism";
import StemSolver from "@/pages/StemSolver";
import StudyAssistant from "@/pages/StudyAssistant";
import Documents from "@/pages/Documents";
import ResetPassword from "@/pages/ResetPassword";
import ConfirmEmail from "@/pages/ConfirmEmail";
import Invite from "@/pages/Invite";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import CookiePolicy from "@/pages/CookiePolicy";
import AcademicUsePolicy from "@/pages/AcademicUsePolicy";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Careers from "@/pages/Careers";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import RefundPolicy from "@/pages/RefundPolicy";
import PaymentSuccess from "@/pages/PaymentSuccess";
import NotFound from "@/pages/not-found";
import { Loader2, Wrench } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Logo } from "@/components/Logo";

function TidioChat() {
  useEffect(() => {
    const key = import.meta.env.VITE_TIDIO_PUBLIC_KEY;
    if (!key || document.querySelector(`script[src*="tidio.co"]`)) return;
    const s = document.createElement("script");
    s.src = `//code.tidio.co/${key}.js`;
    s.async = true;
    document.head.appendChild(s);
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
  const [status, setStatus] = useState<"loading" | "ok" | "maintenance">("loading");
  const [path] = useLocation();

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/status`, { credentials: "include" });
      if (!res.ok) { setStatus("ok"); return; }
      const data = await res.json() as { maintenance?: boolean };
      setStatus(data.maintenance ? "maintenance" : "ok");
    } catch {
      setStatus("ok");
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  if (path.startsWith("/admin")) return <>{children}</>;

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "maintenance") {
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
          <Route path="/documents" component={Documents} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGuard>
  );
}

function AppRedirect() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading) {
      navigate(user ? "/app" : "/auth");
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
      <Route path="/admin" component={Admin} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/confirm-email" component={ConfirmEmail} />
      <Route path="/invite" component={Invite} />
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
      <Route component={AppRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <MaintenanceGate>
              <AuthProvider>
                <Router />
              </AuthProvider>
            </MaintenanceGate>
          </WouterRouter>
          <Toaster />
          <TidioChat />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
