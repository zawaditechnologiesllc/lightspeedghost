import { useState, useEffect } from "react";
import {
  Users, FileText, GraduationCap, TrendingUp, Shield,
  Loader2, AlertCircle, CheckCircle, Trash2, PenLine,
  FlaskConical, Files, Lock, LogOut, BarChart3, RefreshCw,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Link } from "wouter";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

interface AdminStats {
  totalUsers: number;
  totalDocuments: number;
  papersWritten: number;
  revisionsCompleted: number;
  stemSolved: number;
  studySessions: number;
  recentDocuments: Array<{
    id: number;
    userId: string | null;
    title: string;
    type: string;
    subject: string | null;
    wordCount: number;
    updatedAt: string;
  }>;
}

interface AdminUser {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignIn: string | null;
  documentCount: number;
  sessionCount: number;
}

async function adminFetch(path: string, password: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": password,
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

export default function Admin() {
  const [password, setPassword] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "documents">("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [hasEmailData, setHasEmailData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const isAuthed = !!password;

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: inputPassword }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) {
        setPassword(inputPassword);
        sessionStorage.setItem("admin_token", inputPassword);
      } else {
        setAuthError(data.error ?? "Invalid password");
      }
    } catch {
      setAuthError("Could not connect to server");
    } finally {
      setAuthLoading(false);
    }
  }

  // Restore admin session from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("admin_token");
    if (stored) setPassword(stored);
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const data = await adminFetch("/admin/stats", password) as AdminStats;
      setStats(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await adminFetch("/admin/users", password) as { users: AdminUser[]; hasEmailData: boolean };
      setUsers(data.users);
      setHasEmailData(data.hasEmailData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthed) return;
    if (activeTab === "overview" || activeTab === "documents") loadStats();
    if (activeTab === "users") loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, activeTab]);

  async function deleteUser(userId: string) {
    setDeleteError("");
    setDeleteTarget(userId);
    try {
      await adminFetch(`/admin/users/${userId}`, password, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleteTarget(null);
    }
  }

  function signOut() {
    sessionStorage.removeItem("admin_token");
    setPassword("");
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center px-6">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-red-600/8 rounded-full blur-[100px]" />
        </div>
        <div className="relative w-full max-w-sm">
          <Link href="/">
            <Logo size={28} textSize="text-sm" className="mb-10 w-fit cursor-pointer" />
          </Link>
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Shield size={18} className="text-red-400" />
              </div>
              <div>
                <h1 className="font-bold text-white text-lg">Admin Panel</h1>
                <p className="text-white/40 text-xs">Light Speed Ghost</p>
              </div>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Admin Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="password"
                    value={inputPassword}
                    onChange={(e) => setInputPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-red-500/40 transition-colors"
                  />
                </div>
              </div>
              {authError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  <AlertCircle size={13} className="shrink-0" />
                  {authError}
                </div>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                {authLoading && <Loader2 size={14} className="animate-spin" />}
                Enter Admin Panel
              </button>
            </form>
            <p className="text-center text-xs text-white/20 mt-4">
              Not an admin? <Link href="/app"><span className="text-white/40 hover:text-white/60 transition-colors cursor-pointer">Go to app →</span></Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Admin Dashboard ────────────────────────────────────────────────────────
  const tabs = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "users" as const, label: "Users", icon: Users },
    { id: "documents" as const, label: "Documents", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-3 flex items-center gap-4">
        <Link href="/">
          <Logo size={24} textSize="text-xs" className="cursor-pointer" />
        </Link>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
          <Shield size={11} /> Admin Panel
        </div>
        <nav className="flex gap-1 ml-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => {
              if (activeTab === "users") loadUsers();
              else loadStats();
            }}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {loading && !stats && (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading data...</span>
          </div>
        )}

        {/* Overview */}
        {activeTab === "overview" && stats && (
          <>
            <div>
              <h1 className="text-2xl font-bold mb-1">Platform Overview</h1>
              <p className="text-muted-foreground text-sm">Live stats across all students</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard icon={<Users size={16} className="text-blue-500" />} label="Total Users" value={stats.totalUsers} />
              <StatCard icon={<FileText size={16} className="text-indigo-500" />} label="Documents" value={stats.totalDocuments} />
              <StatCard icon={<PenLine size={16} className="text-violet-500" />} label="Papers" value={stats.papersWritten} />
              <StatCard icon={<Files size={16} className="text-blue-400" />} label="Revisions" value={stats.revisionsCompleted} />
              <StatCard icon={<FlaskConical size={16} className="text-cyan-500" />} label="STEM Solved" value={stats.stemSolved} />
              <StatCard icon={<GraduationCap size={16} className="text-sky-500" />} label="Study Sessions" value={stats.studySessions} />
            </div>
          </>
        )}

        {/* Users */}
        {activeTab === "users" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">Students</h1>
                <p className="text-muted-foreground text-sm">
                  {users.length} {hasEmailData ? "registered users" : "active users (from DB)"}
                  {!hasEmailData && (
                    <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(Set SUPABASE_SERVICE_ROLE_KEY for full user data)</span>
                  )}
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-400 text-sm">
                <AlertCircle size={14} />
                {deleteError}
              </div>
            )}

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documents</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sessions</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Joined</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Sign In</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{user.email ?? "Unknown"}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{user.id}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-foreground">{user.documentCount}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-foreground">{user.sessionCount}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {user.lastSignIn ? new Date(user.lastSignIn).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {hasEmailData && (
                          <button
                            onClick={() => deleteUser(user.id)}
                            disabled={deleteTarget === user.id}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
                            title="Delete user"
                          >
                            {deleteTarget === user.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                        No users yet — they'll appear here once students sign up and use the platform
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Documents */}
        {activeTab === "documents" && stats && (
          <>
            <div>
              <h1 className="text-2xl font-bold mb-1">Recent Documents</h1>
              <p className="text-muted-foreground text-sm">Last 10 documents across all users</p>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Words</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.recentDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground truncate max-w-[250px]">{doc.title}</td>
                      <td className="px-4 py-3">
                        <DocTypeBadge type={doc.type} />
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">{doc.wordCount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono truncate max-w-[150px]">{doc.userId ?? "anonymous"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(doc.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {stats.recentDocuments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">No documents yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="mb-2">{icon}</div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function DocTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    paper: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
    revision: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400",
    stem: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400",
    study: "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${styles[type] ?? "bg-muted text-muted-foreground"}`}>
      {type}
    </span>
  );
}
