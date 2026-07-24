import { Link } from "wouter";
import { useState, useEffect } from "react";
import {
  PenLine, BookOpen, Files, ShieldCheck, FlaskConical,
  GraduationCap, TrendingUp, Clock, ArrowRight, Sparkles, Zap, Wand2,
  Wallet, X,
} from "lucide-react";
import { useGetDocumentStats } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/apiFetch";
import { ManageFundsModal } from "@/components/ManageFundsModal";
import { HeroAnalyzer } from "@/components/HeroAnalyzer";

const quickActions = [
  {
    path: "/write",
    label: "Write Paper",
    desc: "Full paper with real citations",
    icon: PenLine,
    gradient: "from-blue-500 to-blue-600",
    glow: "group-hover:shadow-blue-500/20",
  },
  {
    path: "/stem",
    label: "Solve STEM",
    desc: "Step-by-step with LaTeX & graphs",
    icon: FlaskConical,
    gradient: "from-indigo-500 to-violet-600",
    glow: "group-hover:shadow-indigo-500/20",
  },
  {
    path: "/study",
    label: "Study Assistant",
    desc: "AI tutor that remembers you",
    icon: GraduationCap,
    gradient: "from-cyan-500 to-sky-600",
    glow: "group-hover:shadow-cyan-500/20",
  },
  {
    path: "/plagiarism",
    label: "AI Checker",
    desc: "Detect & humanize AI content",
    icon: ShieldCheck,
    gradient: "from-sky-400 to-blue-500",
    glow: "group-hover:shadow-sky-500/20",
  },
  {
    path: "/humanizer",
    label: "LightSpeed Humanizer",
    desc: "Make AI text sound genuinely human",
    icon: Wand2,
    gradient: "from-purple-500 to-indigo-600",
    glow: "group-hover:shadow-purple-500/20",
  },
  {
    path: "/revision",
    label: "Revise Paper",
    desc: "AI revision with grade estimate",
    icon: Files,
    gradient: "from-blue-600 to-indigo-600",
    glow: "group-hover:shadow-blue-600/20",
  },
  {
    path: "/outline",
    label: "Outline",
    desc: "Structure your paper first",
    icon: BookOpen,
    gradient: "from-violet-500 to-purple-600",
    glow: "group-hover:shadow-violet-500/20",
  },
];

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDocumentStats();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [paygCount, setPaygCount] = useState<number>(0);
  const [plan, setPlan] = useState<string>("none");
  const [plansOpen, setPlansOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // First-visit onboarding banner
    if (localStorage.getItem("lsg_onboarding_done") === null) {
      setShowOnboarding(true);
    }

    // Load payment plan + PAYG count for upgrade nudge
    apiFetch("/payments/usage")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setPlan(d.plan ?? "none"); })
      .catch(() => {});

    apiFetch("/payments/payg-count")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setPaygCount(d.count ?? 0); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5 sm:space-y-7">
      {/* Free command box — the same instant, in-browser check as the landing
          hero. Start here for free; the paid tools are the cards below. */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-widest">Your workspace</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Check your writing free — or pick a tool</h1>
        <p className="text-muted-foreground text-sm mt-1.5 mb-4 max-w-2xl">
          Paste any text below for an instant AI, readability, grammar &amp; tone check — free and private, it never touches an AI model. Need the full deep scan, humanizing, or a paper from real research? Use the tools below.
        </p>
        <HeroAnalyzer ctaMode="tool" />
      </div>

      {/* First-visit onboarding banner */}
      {showOnboarding && (
        <div className="relative bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 rounded-2xl p-4 sm:p-5">
          <button
            onClick={() => { setShowOnboarding(false); localStorage.setItem("lsg_onboarding_done", "1"); }}
            className="absolute top-3 right-3 p-1.5 text-white/30 hover:text-white/70 rounded-lg hover:bg-white/5 transition-all"
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-blue-400" />
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Get started</span>
          </div>
          <p className="text-sm font-semibold text-foreground mb-3">Complete your first 3 actions to unlock your academic workflow:</p>
          <div className="grid sm:grid-cols-3 gap-2.5">
            {[
              { step: "1", title: "Write your first paper", desc: "Upload a rubric for best results", href: "/write", color: "text-blue-400 border-blue-500/20 bg-blue-500/5" },
              { step: "2", title: "Check for AI & plagiarism", desc: "See your similarity and AI score", href: "/plagiarism", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
              { step: "3", title: "Solve a STEM problem", desc: "Step-by-step with LaTeX & graphs", href: "/stem", color: "text-violet-400 border-violet-500/20 bg-violet-500/5" },
            ].map(({ step, title, desc, href, color }) => (
              <Link key={step} href={href}>
                <div className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer hover:opacity-80 transition-opacity ${color}`}>
                  <div className="w-6 h-6 rounded-full bg-current/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold">{step}</span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground leading-tight">{title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                <div className="h-6 w-10 bg-muted rounded mb-2" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            ))
          : (
            <>
              <StatCard label="Documents" value={stats?.totalDocuments ?? 0} icon={<Files size={15} />} color="text-blue-500" />
              <StatCard label="Papers" value={stats?.papersWritten ?? 0} icon={<PenLine size={15} />} color="text-indigo-500" />
              <StatCard label="Revisions" value={stats?.revisionsCompleted ?? 0} icon={<TrendingUp size={15} />} color="text-violet-500" />
              <StatCard label="STEM Solved" value={stats?.stemSolved ?? 0} icon={<FlaskConical size={15} />} color="text-cyan-500" />
              <StatCard label="Study Sessions" value={stats?.studySessions ?? 0} icon={<GraduationCap size={15} />} color="text-sky-500" />
            </>
          )}
      </div>

      {/* PAYG → subscription upgrade nudge */}
      {paygCount >= 2 && (plan === "none" || plan === "free") && (
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={13} className="text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Save money</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                You've generated {paygCount} papers pay-as-you-go.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A Pro subscription ($29.99/mo) includes 15 papers + revisions + humanizer + STEM + study — likely cheaper than what you're paying per paper.
              </p>
            </div>
            <button
              onClick={() => setPlansOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-xs transition-colors"
            >
              <TrendingUp size={12} />
              See plans
            </button>
          </div>
        </div>
      )}

      {/* Plan / credits nudge */}
      {(plan === "none" || plan === "free" || plan === "starter") && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Wallet size={14} className="text-primary" />
            <span className="text-sm text-muted-foreground">
              {plan === "none"
                ? "No active plan — save money with a subscription."
                : plan === "free"
                ? <><span className="text-foreground font-medium">Free</span> plan active — upgrade to Pro to unlock AI writing, humanizer &amp; more.</>
                : <><span className="text-foreground font-medium">Starter</span> plan active — upgrade to unlock humanizer &amp; more.</>}
            </span>
          </div>
          <button
            onClick={() => setPlansOpen(true)}
            className="shrink-0 text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            See plans <ArrowRight size={11} />
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-semibold mb-3 text-foreground">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Link key={action.path} href={action.path}>
              <div className={`group bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-lg ${action.glow} transition-all cursor-pointer`}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform shadow-sm`}>
                  <action.icon size={18} className="text-white" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-foreground">{action.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{action.desc}</div>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent documents */}
      {stats && stats.recentDocuments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Recent Documents</h2>
            <Link href="/documents">
              <button className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight size={11} />
              </button>
            </Link>
          </div>
          <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {stats.recentDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${docColor(doc.type)}`}>
                  <DocIcon type={doc.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-foreground">{doc.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${docBadge(doc.type)}`}>{doc.type}</span>
                    {doc.subject && <><span>·</span><span>{doc.subject}</span></>}
                    <span>·</span>
                    <Clock size={9} />
                    <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {(doc.wordCount ?? 0) > 0 && (
                  <div className="text-xs text-muted-foreground shrink-0 tabular-nums">{(doc.wordCount ?? 0).toLocaleString()}w</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans & funds popup — opened from the upgrade nudge */}
      <ManageFundsModal open={plansOpen} onClose={() => setPlansOpen(false)} />
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
      <div className={`mb-2 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function docColor(type: string) {
  const map: Record<string, string> = {
    paper:      "bg-blue-500/10",
    outline:    "bg-emerald-500/10",
    revision:   "bg-indigo-500/10",
    humanizer:  "bg-purple-500/10",
    plagiarism: "bg-rose-500/10",
    stem:       "bg-violet-500/10",
    study:      "bg-cyan-500/10",
  };
  return map[type] ?? "bg-primary/10";
}

function docBadge(type: string) {
  const map: Record<string, string> = {
    paper:      "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
    outline:    "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
    revision:   "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400",
    humanizer:  "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400",
    plagiarism: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400",
    stem:       "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400",
    study:      "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400",
  };
  return map[type] ?? "bg-muted text-muted-foreground";
}

function DocIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    paper:      <PenLine size={14} className="text-blue-500" />,
    outline:    <BookOpen size={14} className="text-emerald-500" />,
    revision:   <Files size={14} className="text-indigo-500" />,
    humanizer:  <Wand2 size={14} className="text-purple-500" />,
    plagiarism: <ShieldCheck size={14} className="text-rose-500" />,
    stem:       <FlaskConical size={14} className="text-violet-500" />,
    study:      <GraduationCap size={14} className="text-cyan-500" />,
  };
  return <>{icons[type] ?? <Files size={14} className="text-primary" />}</>;
}
