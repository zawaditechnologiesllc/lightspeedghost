import { Link } from "wouter";
import {
  PenLine, BookOpen, Files, ShieldCheck, FlaskConical,
  GraduationCap, TrendingUp, Clock, ArrowRight, Sparkles, Zap,
} from "lucide-react";
import { useGetDocumentStats } from "@workspace/api-client-react";

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

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5 sm:space-y-7">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-4 sm:p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-accent/5 rounded-full translate-y-1/2 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">LightSpeed Ghost</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Your Academic AI Workspace</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-lg">
            Real AI writing, verified citations, ReAct-powered STEM solving, and a tutor that remembers your progress.
          </p>
          <Link href="/write">
            <button className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              <Zap size={14} />
              Start Writing
            </button>
          </Link>
        </div>
      </div>

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
                {doc.wordCount > 0 && (
                  <div className="text-xs text-muted-foreground shrink-0 tabular-nums">{doc.wordCount.toLocaleString()}w</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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
    paper: "bg-blue-500/10",
    revision: "bg-indigo-500/10",
    stem: "bg-violet-500/10",
    study: "bg-cyan-500/10",
  };
  return map[type] ?? "bg-primary/10";
}

function docBadge(type: string) {
  const map: Record<string, string> = {
    paper: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
    revision: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400",
    stem: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400",
    study: "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400",
  };
  return map[type] ?? "bg-muted text-muted-foreground";
}

function DocIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    paper: <PenLine size={14} className="text-blue-500" />,
    revision: <Files size={14} className="text-indigo-500" />,
    stem: <FlaskConical size={14} className="text-violet-500" />,
    study: <GraduationCap size={14} className="text-cyan-500" />,
  };
  return <>{icons[type] ?? <Files size={14} className="text-primary" />}</>;
}
