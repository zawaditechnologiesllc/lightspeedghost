import { useState, useEffect } from "react";
import {
  Users, FileText, GraduationCap, Shield, Loader2, AlertCircle,
  Trash2, FlaskConical, PenLine, Files, Lock, LogOut, RefreshCw,
  TrendingUp, Activity, ChevronRight, Menu, X,
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

type Tab = "overview" | "users" | "documents";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [hasEmailData, setHasEmailData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

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

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_token");
    if (stored) setPassword(stored);
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const data = await adminFetch("/admin/stats", password) as AdminStats;
      setStats(data);
    } catch {
      setStats(null);
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
    } catch {
      setUsers([]);
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

  // ── Auth Gate ─────────────────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center px-6">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-red-600/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[300px] h-[200px] bg-blue-600/6 rounded-full blur-[100px]" />
        </div>
        <div className="relative w-full max-w-sm">
          <Link href="/">
            <Logo size={28} textSize="text-sm" className="mb-12 w-fit cursor-pointer opacity-80 hover:opacity-100 transition-opacity" />
          </Link>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
            <div className="px-8 pt-8 pb-6 border-b border-white/8">
              <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                <Shield size={20} className="text-red-400" />
              </div>
              <h1 className="text-xl font-bold text-white mb-1">Admin Access</h1>
              <p className="text-white/35 text-sm">Light Speed Ghost control panel</p>
            </div>

            <div className="p-8">
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 uppercase tracking-wide mb-2">Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
                    <input
                      type="password"
                      value={inputPassword}
                      onChange={(e) => setInputPassword(e.target.value)}
                      placeholder="Enter admin password"
                      required
                      autoFocus
                      className="w-full pl-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-red-500/40 focus:bg-white/[0.07] transition-all"
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
                  className="w-full py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                >
                  {authLoading ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                  {authLoading ? "Verifying…" : "Access Panel"}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-white/8 flex justify-center">
                <Link href="/app">
                  <span className="text-xs text-white/25 hover:text-white/50 transition-colors cursor-pointer">Back to app →</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "users", label: "Students", icon: Users },
    { id: "documents", label: "Documents", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-[#04080f] text-white">
      {/* Sidebar */}
      {mobileNav && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMobileNav(false)} />
      )}

      <div className="flex h-screen overflow-hidden">
        <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-56 bg-white/[0.02] border-r border-white/8 flex flex-col transition-transform duration-200 ${mobileNav ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          <div className="px-4 py-5 border-b border-white/8">
            <Logo size={24} textSize="text-xs" className="opacity-80" />
            <div className="mt-2 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[10px] text-white/35 font-medium uppercase tracking-widest">Admin</span>
            </div>
          </div>

          <nav className="flex-1 px-2 py-4 space-y-0.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setMobileNav(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === t.id
                    ? "bg-white/8 text-white"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                <t.icon size={14} className={activeTab === t.id ? "text-red-400" : ""} />
                {t.label}
              </button>
            ))}
          </nav>

          <div className="px-3 py-4 border-t border-white/8 space-y-2">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/35 hover:text-white/60 hover:bg-white/5 transition-all"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Topbar */}
          <header className="flex items-center gap-3 px-5 py-3.5 border-b border-white/8 bg-white/[0.01] shrink-0">
            <button className="lg:hidden text-white/40 hover:text-white/70 transition-colors" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X size={18} /> : <Menu size={18} />}
            </button>
            <h1 className="text-sm font-semibold text-white/80 capitalize">{activeTab}</h1>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => activeTab === "users" ? loadUsers() : loadStats()}
                disabled={loading}
                className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/8 transition-all disabled:opacity-40"
                title="Refresh"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-5 py-6">
            {loading && !stats && !users.length ? (
              <div className="flex items-center justify-center py-24 text-white/30 gap-2.5">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : (
              <>
                {/* Overview */}
                {activeTab === "overview" && stats && (
                  <div className="space-y-6 max-w-5xl">
                    <div>
                      <h2 className="text-lg font-bold text-white mb-0.5">Platform Overview</h2>
                      <p className="text-white/35 text-sm">Live usage across all students</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
                      <OverviewCard
                        icon={<Users size={18} />}
                        label="Total Students"
                        value={stats.totalUsers}
                        color="from-blue-600/20 to-blue-500/10"
                        border="border-blue-500/15"
                        iconColor="text-blue-400"
                      />
                      <OverviewCard
                        icon={<FileText size={18} />}
                        label="Documents"
                        value={stats.totalDocuments}
                        color="from-indigo-600/20 to-indigo-500/10"
                        border="border-indigo-500/15"
                        iconColor="text-indigo-400"
                      />
                      <OverviewCard
                        icon={<GraduationCap size={18} />}
                        label="Study Sessions"
                        value={stats.studySessions}
                        color="from-cyan-600/20 to-cyan-500/10"
                        border="border-cyan-500/15"
                        iconColor="text-cyan-400"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <MiniCard icon={<PenLine size={14} className="text-violet-400" />} label="Papers Written" value={stats.papersWritten} />
                      <MiniCard icon={<Files size={14} className="text-blue-400" />} label="Revisions Done" value={stats.revisionsCompleted} />
                      <MiniCard icon={<FlaskConical size={14} className="text-emerald-400" />} label="STEM Solved" value={stats.stemSolved} />
                    </div>

                    {stats.recentDocuments.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-white/70">Recent Activity</h3>
                          <button onClick={() => setActiveTab("documents")} className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">
                            View all <ChevronRight size={11} />
                          </button>
                        </div>
                        <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                          {stats.recentDocuments.slice(0, 5).map((doc, i) => (
                            <div key={doc.id} className={`flex items-center gap-3 px-4 py-3 ${i < stats.recentDocuments.length - 1 ? "border-b border-white/6" : ""}`}>
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${typeGradient(doc.type)}`}>
                                <TypeIcon type={doc.type} size={13} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white/80 font-medium truncate">{doc.title}</p>
                                <p className="text-xs text-white/30 mt-0.5">{doc.userId ? doc.userId.slice(0, 8) + "…" : "anonymous"} · {new Date(doc.updatedAt).toLocaleDateString()}</p>
                              </div>
                              <TypeBadge type={doc.type} />
                              <span className="text-xs text-white/25 tabular-nums shrink-0">{doc.wordCount.toLocaleString()}w</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Students */}
                {activeTab === "users" && (
                  <div className="space-y-5 max-w-5xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-white mb-0.5">Students</h2>
                        <p className="text-white/35 text-sm">
                          {users.length} {hasEmailData ? "registered accounts" : "active users"}
                          {!hasEmailData && (
                            <span className="ml-2 text-[11px] text-amber-400/70">(Add SUPABASE_SERVICE_ROLE_KEY for emails & deletion)</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {deleteError && (
                      <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        <AlertCircle size={13} />
                        {deleteError}
                      </div>
                    )}

                    <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-[1fr_80px_80px_100px_100px_40px] gap-2 px-4 py-2.5 border-b border-white/6">
                        {["Student", "Docs", "Sessions", "Joined", "Last Active", ""].map((h) => (
                          <span key={h} className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{h}</span>
                        ))}
                      </div>

                      {users.length === 0 ? (
                        <div className="py-16 text-center text-white/25 text-sm">
                          No students yet — they'll appear here after signing up
                        </div>
                      ) : (
                        users.map((user, i) => (
                          <div key={user.id} className={`grid grid-cols-[1fr_80px_80px_100px_100px_40px] gap-2 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors ${i < users.length - 1 ? "border-b border-white/6" : ""}`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shrink-0">
                                <span className="text-[11px] font-bold text-white">
                                  {user.email ? user.email[0].toUpperCase() : "?"}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-white/80 font-medium truncate">{user.email ?? "—"}</p>
                                <p className="text-[10px] text-white/25 font-mono truncate">{user.id.slice(0, 12)}…</p>
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-white/70 tabular-nums">{user.documentCount}</span>
                            <span className="text-sm font-semibold text-white/70 tabular-nums">{user.sessionCount}</span>
                            <span className="text-xs text-white/30">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</span>
                            <span className="text-xs text-white/30">{user.lastSignIn ? new Date(user.lastSignIn).toLocaleDateString() : "—"}</span>
                            <div className="flex justify-end">
                              {hasEmailData && (
                                <button
                                  onClick={() => deleteUser(user.id)}
                                  disabled={deleteTarget === user.id}
                                  className="p-1.5 rounded-md text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                                  title="Delete user"
                                >
                                  {deleteTarget === user.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Documents */}
                {activeTab === "documents" && stats && (
                  <div className="space-y-5 max-w-5xl">
                    <div>
                      <h2 className="text-lg font-bold text-white mb-0.5">All Documents</h2>
                      <p className="text-white/35 text-sm">Most recent 10 documents across all students</p>
                    </div>

                    <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-[1fr_90px_80px_130px_100px] gap-2 px-4 py-2.5 border-b border-white/6">
                        {["Title", "Type", "Words", "Student", "Updated"].map((h) => (
                          <span key={h} className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{h}</span>
                        ))}
                      </div>

                      {stats.recentDocuments.length === 0 ? (
                        <div className="py-16 text-center text-white/25 text-sm">No documents yet</div>
                      ) : (
                        stats.recentDocuments.map((doc, i) => (
                          <div key={doc.id} className={`grid grid-cols-[1fr_90px_80px_130px_100px] gap-2 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors ${i < stats.recentDocuments.length - 1 ? "border-b border-white/6" : ""}`}>
                            <p className="text-sm text-white/75 font-medium truncate">{doc.title}</p>
                            <TypeBadge type={doc.type} />
                            <span className="text-xs text-white/35 tabular-nums">{doc.wordCount.toLocaleString()}w</span>
                            <span className="text-[11px] text-white/30 font-mono truncate">{doc.userId ? doc.userId.slice(0, 10) + "…" : "anon"}</span>
                            <span className="text-xs text-white/30">{new Date(doc.updatedAt).toLocaleDateString()}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({ icon, label, value, color, border, iconColor }: {
  icon: React.ReactNode; label: string; value: number;
  color: string; border: string; iconColor: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${color} border ${border} rounded-xl p-5`}>
      <div className={`mb-3 ${iconColor}`}>{icon}</div>
      <div className="text-3xl font-bold text-white tabular-nums">{value.toLocaleString()}</div>
      <div className="text-xs text-white/45 mt-1 font-medium">{label}</div>
    </div>
  );
}

function MiniCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white/[0.025] border border-white/8 rounded-xl px-4 py-3.5 flex items-center gap-3">
      {icon}
      <div>
        <div className="text-lg font-bold text-white tabular-nums">{value}</div>
        <div className="text-[11px] text-white/30">{label}</div>
      </div>
    </div>
  );
}

function typeGradient(type: string) {
  const map: Record<string, string> = {
    paper: "bg-blue-500/15",
    revision: "bg-indigo-500/15",
    stem: "bg-violet-500/15",
    study: "bg-cyan-500/15",
  };
  return map[type] ?? "bg-white/10";
}

function TypeIcon({ type, size }: { type: string; size: number }) {
  const map: Record<string, React.ReactNode> = {
    paper: <PenLine size={size} className="text-blue-400" />,
    revision: <Files size={size} className="text-indigo-400" />,
    stem: <FlaskConical size={size} className="text-violet-400" />,
    study: <GraduationCap size={size} className="text-cyan-400" />,
  };
  return <>{map[type] ?? <FileText size={size} className="text-white/40" />}</>;
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    paper: "bg-blue-500/15 text-blue-300 border-blue-500/20",
    revision: "bg-indigo-500/15 text-indigo-300 border-indigo-500/20",
    stem: "bg-violet-500/15 text-violet-300 border-violet-500/20",
    study: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
  };
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize border ${styles[type] ?? "bg-white/10 text-white/40 border-white/10"}`}>
      {type}
    </span>
  );
}
