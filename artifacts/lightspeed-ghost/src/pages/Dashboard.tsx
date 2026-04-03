import { Link } from "wouter";
import { PenLine, BookOpen, Files, ShieldCheck, FlaskConical, GraduationCap, TrendingUp, Clock } from "lucide-react";
import { useGetDocumentStats } from "@workspace/api-client-react";

const quickActions = [
  { path: "/write", label: "Write New Paper", desc: "AI-powered academic paper writing with citations", icon: PenLine, color: "bg-primary" },
  { path: "/revision", label: "Revise Paper", desc: "Submit your paper for AI-powered revision", icon: Files, color: "bg-blue-500" },
  { path: "/plagiarism", label: "Check AI & Plagiarism", desc: "Detect and humanize AI-generated content", icon: ShieldCheck, color: "bg-sky-500" },
  { path: "/stem", label: "Solve STEM Problem", desc: "Step-by-step solutions with visualizations", icon: FlaskConical, color: "bg-indigo-500" },
  { path: "/outline", label: "Generate Outline", desc: "Create a structured paper outline instantly", icon: BookOpen, color: "bg-blue-600" },
  { path: "/study", label: "Study Assistant", desc: "Interactive AI tutor for any subject", icon: GraduationCap, color: "bg-cyan-500" },
];

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDocumentStats();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your AI academic writing workspace</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="h-6 w-12 bg-muted rounded mb-1" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Total Documents" value={stats?.totalDocuments ?? 0} icon={<Files size={16} />} />
            <StatCard label="Papers Written" value={stats?.papersWritten ?? 0} icon={<PenLine size={16} />} />
            <StatCard label="Revisions" value={stats?.revisionsCompleted ?? 0} icon={<TrendingUp size={16} />} />
            <StatCard label="STEM Solved" value={stats?.stemSolved ?? 0} icon={<FlaskConical size={16} />} />
            <StatCard label="Study Sessions" value={stats?.studySessions ?? 0} icon={<GraduationCap size={16} />} />
          </>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Link key={action.path} href={action.path}>
              <div className="bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                <div className={`w-9 h-9 rounded-lg ${action.color} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                  <action.icon size={16} className="text-white" />
                </div>
                <div className="font-semibold text-sm text-foreground">{action.label}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {stats && stats.recentDocuments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Documents</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {stats.recentDocuments.map((doc, i) => (
              <div
                key={doc.id}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${i !== 0 ? "border-t border-border" : ""}`}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <DocIcon type={doc.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{doc.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="capitalize">{doc.type}</span>
                    {doc.subject && <><span>·</span><span>{doc.subject}</span></>}
                    <span>·</span>
                    <Clock size={10} />
                    <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {doc.wordCount > 0 && (
                  <div className="text-xs text-muted-foreground shrink-0">{doc.wordCount.toLocaleString()} words</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function DocIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    paper: <PenLine size={14} className="text-primary" />,
    revision: <Files size={14} className="text-blue-500" />,
    stem: <FlaskConical size={14} className="text-indigo-500" />,
    study: <GraduationCap size={14} className="text-cyan-500" />,
  };
  return <>{icons[type] ?? <Files size={14} className="text-primary" />}</>;
}
