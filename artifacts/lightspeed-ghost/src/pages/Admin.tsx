import { useState, useEffect, useCallback } from "react";
import {
  Users, FileText, GraduationCap, Shield, Loader2, AlertCircle,
  Trash2, FlaskConical, PenLine, Files, Lock, LogOut, RefreshCw,
  TrendingUp, Activity, ChevronRight, Menu, X,
  CreditCard, DollarSign, Globe, Ban, CheckCircle2, Wallet, Settings,
  Coins, BarChart3, Crown, Zap, AlertTriangle, Plus, Minus,
  ArrowUp, ArrowDown, ReceiptText, UserX, UserCheck, Edit2, Check,
  Radio, ServerCrash, Database, Clock, CheckCheck, XCircle, Signal,
  Megaphone, Link2, Eye, EyeOff, ThumbsUp, ThumbsDown,
  Wrench, ToggleLeft, ToggleRight, Timer, BarChart2,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Link } from "wouter";

const API_BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

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

type Tab = "overview" | "users" | "tools" | "documents" | "gateways" | "payments" | "credits" | "finance" | "analytics" | "logs" | "announcements" | "settings";

interface AdminTool {
  key: string;
  label: string;
  enabled: boolean;
  total: number;
  thisMonth: number;
  thisWeek: number;
  lastUsed: string | null;
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  totalRequests7d: number;
  errors7d: number;
  errorRate7d: number;
  avgMs: number;
  hasApiData: boolean;
}

interface Announcement {
  id: number;
  title: string | null;
  message: string;
  link: string | null;
  link_text: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

interface FeedbackStat {
  tool: string;
  positive: string;
  negative: string;
  total: string;
  score: string;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminStats {
  totalUsers: number;
  totalDocuments: number;
  papersWritten: number;
  revisionsCompleted: number;
  stemSolved: number;
  studySessions: number;
  humanizerCompleted: number;
  plagiarismChecks: number;
  outlineCount: number;
  totalRevenueCents: number;
  activeSubscriptions: number;
  totalCreditsIssuedCents: number;
  planDistribution: Record<string, number>;
  newUsersThisWeek: number;
  mrrCents: number;
  revenueByGateway: Record<string, { revenue: number; count: number }>;
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

interface AdminDocument {
  id: number;
  userId: string | null;
  title: string;
  type: string;
  subject: string | null;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminUser {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignIn: string | null;
  documentCount: number;
  sessionCount: number;
  plan: string;
  billing: string | null;
  creditBalance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  banned: boolean;
  banReason: string | null;
}

interface GatewaySetting {
  gateway: string;
  paused: boolean;
  notes: string | null;
  updated_at: string;
  configured: boolean;
  stats: { count: number; revenue: number };
}

interface Payment {
  id: string;
  user_id: string;
  gateway: string;
  gateway_session_id: string;
  type: string;
  plan: string | null;
  tool: string | null;
  tier: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface CreditUser {
  user_id: string;
  balance_cents: number;
  lifetime_earned_cents: number;
  lifetime_spent_cents: number;
  updated_at: string;
}

interface CreditTransaction {
  user_id: string;
  amount_cents: number;
  type: string;
  description: string;
  created_at: string;
}

interface RevenueData {
  byGateway: Array<{ gateway: string; revenue: string; count: string }>;
  byMonth: Array<{ month: string; revenue: string; count: string }>;
  byType: Array<{ type: string; revenue: string; count: string }>;
  topUsers: Array<{ user_id: string; revenue: string; count: string }>;
  summary: { total: string; this_month: string; last_month: string; pending: string };
}

interface Subscription {
  user_id: string;
  plan: string;
  billing: string | null;
  gateway: string | null;
  created_at: string;
}

interface SystemSettings {
  maintenance_mode: string;
  allow_signups: string;
  payg_enabled: string;
  starter_paper: string;
  starter_revision: string;
  starter_humanizer: string;
  starter_stem: string;
  starter_study: string;
  starter_plagiarism: string;
  starter_outline: string;
}

interface TrafficData {
  totalRegisteredUsers: number;
  totalActiveUsers: number;
  dailyActiveUsers: number;
  liveUsers: number;
  byCountry: Array<{ country: string; requests: string; users: string }>;
  byHour: Array<{ hour: string; requests: string; errors: string }>;
}

interface LogEntry {
  id: number;
  method: string;
  path: string;
  status: number;
  duration_ms: number | null;
  user_id: string | null;
  country: string;
  error_msg: string | null;
  created_at: string;
}

interface LogSummary {
  total: string;
  success: string;
  client_errors: string;
  server_errors: string;
  avg_ms: string;
}

const GATEWAY_LABELS: Record<string, string> = {
  stripe: "Stripe", paddle: "Paddle",
  lemon_squeezy: "Lemon Squeezy", paystack: "Paystack", intasend: "IntaSend",
};

const COUNTRY_NAMES: Record<string, string> = {
  KE:"Kenya",NG:"Nigeria",UG:"Uganda",TZ:"Tanzania",GH:"Ghana",ZA:"South Africa",
  RW:"Rwanda",ET:"Ethiopia",US:"United States",GB:"United Kingdom",CA:"Canada",
  AU:"Australia",IN:"India",DE:"Germany",FR:"France",NL:"Netherlands",SG:"Singapore",
  AE:"UAE",ZM:"Zambia",MW:"Malawi",ZW:"Zimbabwe",CM:"Cameroon",SN:"Senegal",
  CI:"Côte d'Ivoire",PK:"Pakistan",BD:"Bangladesh",PH:"Philippines",ID:"Indonesia",
  BR:"Brazil",MX:"Mexico",LS:"Lesotho",MZ:"Mozambique",BW:"Botswana",NA:"Namibia",
};

function countryFlag(code: string): string {
  if (!code || code === "??" || code.length !== 2) return "🌍";
  return code.toUpperCase().split("").map((c) =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join("");
}

function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code ?? "Unknown";
}

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-blue-500/12 text-blue-300 border-blue-500/20",
  pro: "bg-amber-500/12 text-amber-300 border-amber-500/20",
  campus: "bg-emerald-500/12 text-emerald-300 border-emerald-500/20",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function Admin() {
  const [password, setPassword] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [hasEmailData, setHasEmailData] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [adminTools, setAdminTools] = useState<AdminTool[]>([]);
  const [togglingTool, setTogglingTool] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [gateways, setGateways] = useState<GatewaySetting[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [togglingGateway, setTogglingGateway] = useState<string | null>(null);
  const [creditUsers, setCreditUsers] = useState<CreditUser[]>([]);
  const [creditTx, setCreditTx] = useState<CreditTransaction[]>([]);
  const [creditTotals, setCreditTotals] = useState<{ total_balance: string; total_earned: string; total_spent: string } | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subCounts, setSubCounts] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [creditAdjustUser, setCreditAdjustUser] = useState<AdminUser | null>(null);
  const [creditAdjustAmt, setCreditAdjustAmt] = useState("");
  const [creditAdjustNote, setCreditAdjustNote] = useState("");
  const [creditAdjusting, setCreditAdjusting] = useState(false);
  const [planEditUser, setPlanEditUser] = useState<AdminUser | null>(null);
  const [planEditValue, setPlanEditValue] = useState("starter");
  const [planEditing, setPlanEditing] = useState(false);
  const [banTogglingId, setBanTogglingId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "completed" | "pending" | "failed">("all");
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [requestLogs, setRequestLogs] = useState<LogEntry[]>([]);
  const [errorLogs, setErrorLogs] = useState<LogEntry[]>([]);
  const [logSummary, setLogSummary] = useState<LogSummary | null>(null);
  const [logFilter, setLogFilter] = useState<"all" | "success" | "errors">("all");
  const [waking, setWaking] = useState(false);
  const [wakeResult, setWakeResult] = useState<{ ok: boolean; uptimeSeconds?: number } | null>(null);
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [preLoginWaking, setPreLoginWaking] = useState(false);
  const [preLoginStatus, setPreLoginStatus] = useState<"idle" | "online" | "offline">("idle");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", message: "", link: "", link_text: "Learn more", color: "blue" });
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementError, setAnnouncementError] = useState("");
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStat[]>([]);
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [docTotal, setDocTotal] = useState(0);
  const [docSearch, setDocSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [pwaStats, setPwaStats] = useState<{
    totalInstalls: number; androidInstalls: number; iosInstalls: number;
    installs7d: number; installs30d: number;
    totalLaunches: number; launches7d: number; launches30d: number;
    byPlatform: Array<{ platform: string; installs: string; launches: string }>;
  } | null>(null);

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

  const loadStats = useCallback(async () => {
    setLoading(true);
    setStatsError(null);
    try { setStats(await adminFetch("/admin/stats", password) as AdminStats); }
    catch (e) { setStats(null); setStatsError(e instanceof Error ? e.message : "Failed to load stats"); }
    finally { setLoading(false); }
  }, [password]);

  const loadTools = useCallback(async () => {
    setLoading(true);
    try { setAdminTools((await adminFetch("/admin/tools", password) as { tools: AdminTool[] }).tools); }
    catch { setAdminTools([]); }
    finally { setLoading(false); }
  }, [password]);

  async function toggleTool(key: string, enabled: boolean) {
    setTogglingTool(key);
    setToggleError(null);
    try {
      await adminFetch(`/admin/tools/${key}/toggle`, password, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      setAdminTools((prev) => prev.map((t) => t.key === key ? { ...t, enabled } : t));
    } catch {
      setToggleError(`Failed to ${enabled ? "enable" : "disable"} tool — check CORS/auth`);
      setTimeout(() => setToggleError(null), 4000);
    }
    finally { setTogglingTool(null); }
  }

  async function quickSaveSetting(key: string, value: string) {
    try {
      await adminFetch("/admin/settings", password, {
        method: "POST",
        body: JSON.stringify({ settings: { [key]: value } }),
      });
    } catch { /* settings auto-save failure is non-blocking */ }
  }

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch("/admin/users", password) as { users: AdminUser[]; hasEmailData: boolean; supabaseError: string | null };
      setUsers(data.users); setHasEmailData(data.hasEmailData); setSupabaseError(data.supabaseError ?? null);
    } catch { setUsers([]); }
    finally { setLoading(false); }
  }, [password]);

  const loadGateways = useCallback(async () => {
    setLoading(true);
    try { setGateways((await adminFetch("/admin/gateways", password) as { gateways: GatewaySetting[] }).gateways); } catch { setGateways([]); }
    finally { setLoading(false); }
  }, [password]);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try { setPayments((await adminFetch("/admin/payments", password) as { payments: Payment[] }).payments); } catch { setPayments([]); }
    finally { setLoading(false); }
  }, [password]);

  const loadCredits = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch("/admin/credits", password) as {
        users: CreditUser[]; recentTransactions: CreditTransaction[];
        totals: typeof creditTotals;
      };
      setCreditUsers(data.users); setCreditTx(data.recentTransactions); setCreditTotals(data.totals);
    } catch { setCreditUsers([]); }
    finally { setLoading(false); }
  }, [password]);

  const loadRevenue = useCallback(async () => {
    setLoading(true);
    try { setRevenue(await adminFetch("/admin/revenue", password) as RevenueData); } catch { setRevenue(null); }
    finally { setLoading(false); }
  }, [password]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch("/admin/documents", password) as { documents: AdminDocument[]; total: number };
      setDocuments(data.documents);
      setDocTotal(data.total);
    } catch { setDocuments([]); setDocTotal(0); }
    finally { setLoading(false); }
  }, [password]);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch("/admin/subscriptions", password) as { subscriptions: Subscription[]; counts: Record<string, number> };
      setSubscriptions(data.subscriptions); setSubCounts(data.counts);
    } catch { setSubscriptions([]); }
    finally { setLoading(false); }
  }, [password]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try { setSettings((await adminFetch("/admin/settings", password) as { settings: SystemSettings }).settings); } catch {}
    finally { setLoading(false); }
  }, [password]);

  const loadTraffic = useCallback(async () => {
    setLoading(true);
    try { setTraffic(await adminFetch("/admin/traffic", password) as TrafficData); } catch { setTraffic(null); }
    finally { setLoading(false); }
  }, [password]);

  const loadPwaStats = useCallback(async () => {
    try { setPwaStats(await adminFetch("/admin/pwa/stats", password) as typeof pwaStats); } catch { setPwaStats(null); }
  }, [password]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch(`/admin/logs?filter=${logFilter}`, password) as {
        logs: LogEntry[]; errors: LogEntry[]; summary: LogSummary;
      };
      setRequestLogs(data.logs); setErrorLogs(data.errors); setLogSummary(data.summary);
    } catch { setRequestLogs([]); setErrorLogs([]); }
    finally { setLoading(false); }
  }, [password, logFilter]);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch("/admin/announcements", password) as { announcements: Announcement[] };
      setAnnouncements(data.announcements);
    } catch { setAnnouncements([]); }
    finally { setLoading(false); }
  }, [password]);

  const loadFeedback = useCallback(async () => {
    try {
      const data = await adminFetch("/admin/feedback", password) as { feedback: FeedbackStat[] };
      setFeedbackStats(data.feedback);
    } catch { setFeedbackStats([]); }
  }, [password]);

  async function wakeBeforeLogin() {
    setPreLoginWaking(true);
    setPreLoginStatus("idle");
    const HEALTH_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "") + "/api/healthz";
    let ok = false;
    try {
      const res = await fetch(HEALTH_URL, {
        mode: "cors",
        credentials: "omit",
        signal: AbortSignal.timeout(90_000),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    setPreLoginStatus(ok ? "online" : "offline");
    setPreLoginWaking(false);
  }

  async function wakeBackend() {
    setWaking(true); setWakeResult(null);
    try {
      const data = await adminFetch("/admin/ping", password) as { ok: boolean; uptimeSeconds: number };
      setWakeResult(data);
    } catch { setWakeResult({ ok: false }); }
    finally { setWaking(false); }
  }

  async function syncSupabase() {
    setSyncingSupabase(true);
    try { await loadUsers(); } finally { setSyncingSupabase(false); }
  }

  useEffect(() => {
    if (!isAuthed) return;
    if (activeTab === "overview") loadStats();
    if (activeTab === "tools") loadTools();
    if (activeTab === "documents") loadDocuments();
    if (activeTab === "users") { loadUsers(); loadSubscriptions(); }
    if (activeTab === "gateways") loadGateways();
    if (activeTab === "payments") loadPayments();
    if (activeTab === "credits") loadCredits();
    if (activeTab === "finance") loadRevenue();
    if (activeTab === "settings") loadSettings();
    if (activeTab === "analytics") { loadTraffic(); loadFeedback(); loadTools(); loadPwaStats(); }
    if (activeTab === "logs") loadLogs();
    if (activeTab === "announcements") loadAnnouncements();
  }, [isAuthed, activeTab]);

  useEffect(() => {
    if (activeTab === "logs" && isAuthed) loadLogs();
  }, [logFilter]);

  async function toggleGateway(gateway: string, paused: boolean) {
    setTogglingGateway(gateway);
    try {
      await adminFetch(`/admin/gateways/${gateway}`, password, { method: "PATCH", body: JSON.stringify({ paused }) });
      setGateways((prev) => prev.map((g) => g.gateway === gateway ? { ...g, paused } : g));
    } catch {} finally { setTogglingGateway(null); }
  }

  async function deleteUser(userId: string) {
    setDeleteError("");
    setDeleteTarget(userId);
    try {
      await adminFetch(`/admin/users/${userId}`, password, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    } finally { setDeleteTarget(null); }
  }

  async function toggleBan(user: AdminUser) {
    setBanTogglingId(user.id);
    try {
      await adminFetch(`/admin/users/${user.id}/ban`, password, {
        method: "PATCH",
        body: JSON.stringify({ banned: !user.banned, reason: "Admin action" }),
      });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, banned: !u.banned } : u));
    } catch {} finally { setBanTogglingId(null); }
  }

  async function submitCreditAdjust() {
    if (!creditAdjustUser || !creditAdjustAmt) return;
    setCreditAdjusting(true);
    try {
      const amt = parseInt(creditAdjustAmt, 10);
      if (isNaN(amt) || amt === 0) return;
      await adminFetch(`/admin/users/${creditAdjustUser.id}/credits`, password, {
        method: "POST",
        body: JSON.stringify({ amountCents: amt, reason: creditAdjustNote || "Admin adjustment" }),
      });
      setUsers((prev) => prev.map((u) => u.id === creditAdjustUser.id
        ? { ...u, creditBalance: u.creditBalance + amt }
        : u
      ));
      setCreditAdjustUser(null); setCreditAdjustAmt(""); setCreditAdjustNote("");
      if (activeTab === "credits") loadCredits();
    } catch {} finally { setCreditAdjusting(false); }
  }

  async function submitPlanEdit() {
    if (!planEditUser) return;
    setPlanEditing(true);
    try {
      await adminFetch(`/admin/users/${planEditUser.id}/plan`, password, {
        method: "PATCH",
        body: JSON.stringify({ plan: planEditValue }),
      });
      setUsers((prev) => prev.map((u) => u.id === planEditUser.id ? { ...u, plan: planEditValue } : u));
      setPlanEditUser(null);
    } catch {} finally { setPlanEditing(false); }
  }

  async function saveSettings() {
    if (!settings) return;
    setSettingsSaving(true);
    try {
      await adminFetch("/admin/settings", password, {
        method: "POST",
        body: JSON.stringify({ settings }),
      });
      setSettingsDirty(false);
    } catch {} finally { setSettingsSaving(false); }
  }

  function signOut() {
    sessionStorage.removeItem("admin_token");
    setPassword("");
  }

  function refreshTab() {
    if (activeTab === "users") loadUsers();
    else if (activeTab === "documents") loadDocuments();
    else if (activeTab === "gateways") loadGateways();
    else if (activeTab === "payments") loadPayments();
    else if (activeTab === "credits") loadCredits();
    else if (activeTab === "finance") loadRevenue();
    else if (activeTab === "settings") loadSettings();
    else if (activeTab === "analytics") { loadTraffic(); loadFeedback(); loadTools(); loadPwaStats(); }
    else if (activeTab === "logs") loadLogs();
    else if (activeTab === "announcements") loadAnnouncements();
    else loadStats();
  }

  async function createAnnouncement() {
    if (!newAnnouncement.message.trim()) { setAnnouncementError("Message is required"); return; }
    setAnnouncementSaving(true); setAnnouncementError("");
    try {
      await adminFetch("/admin/announcements", password, {
        method: "POST", body: JSON.stringify(newAnnouncement),
      });
      setNewAnnouncement({ title: "", message: "", link: "", link_text: "Learn more", color: "blue" });
      await loadAnnouncements();
    } catch { setAnnouncementError("Failed to create announcement"); }
    finally { setAnnouncementSaving(false); }
  }

  async function toggleAnnouncement(id: number, is_active: boolean) {
    try {
      await adminFetch(`/admin/announcements/${id}`, password, {
        method: "PATCH", body: JSON.stringify({ is_active }),
      });
      setAnnouncements((prev) => prev.map((a) => a.id === id ? { ...a, is_active } : a));
    } catch {}
  }

  async function deleteAnnouncement(id: number) {
    try {
      await adminFetch(`/admin/announcements/${id}`, password, { method: "DELETE" });
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch {}
  }

  async function saveEditAnnouncement() {
    if (!editingAnnouncement) return;
    setAnnouncementSaving(true);
    try {
      await adminFetch(`/admin/announcements/${editingAnnouncement.id}`, password, {
        method: "PATCH", body: JSON.stringify(editingAnnouncement),
      });
      setAnnouncements((prev) => prev.map((a) => a.id === editingAnnouncement.id ? editingAnnouncement : a));
      setEditingAnnouncement(null);
    } catch {}
    finally { setAnnouncementSaving(false); }
  }

  // ── Auth Gate ───────────────────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center px-6">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-red-600/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[300px] h-[200px] bg-blue-600/6 rounded-full blur-[100px]" />
        </div>
        <div className="relative w-full max-w-sm">
          <Link href="/"><Logo size={28} textSize="text-sm" className="mb-12 w-fit cursor-pointer opacity-80 hover:opacity-100 transition-opacity" /></Link>
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
                      type="password" value={inputPassword}
                      onChange={(e) => setInputPassword(e.target.value)}
                      placeholder="Enter admin password" required autoFocus
                      className="w-full pl-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-red-500/40 focus:bg-white/[0.07] transition-all"
                    />
                  </div>
                </div>
                {authError && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    <AlertCircle size={13} className="shrink-0" />{authError}
                  </div>
                )}
                <button type="submit" disabled={authLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                >
                  {authLoading ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                  {authLoading ? "Verifying…" : "Access Panel"}
                </button>
              </form>
              <div className="mt-6 pt-5 border-t border-white/8 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/25">Backend offline?</span>
                    <button
                      type="button"
                      onClick={wakeBeforeLogin}
                      disabled={preLoginWaking}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-white/40 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/8 disabled:opacity-40 transition-all"
                    >
                      {preLoginWaking
                        ? <><Loader2 size={11} className="animate-spin" /> Waking…</>
                        : preLoginStatus === "online"
                          ? <><Signal size={11} className="text-emerald-400" /><span className="text-emerald-400">Online ✓</span></>
                          : preLoginStatus === "offline"
                            ? <><Signal size={11} className="text-red-400" /><span className="text-red-400">Unreachable — retry?</span></>
                            : <><Signal size={11} /> Wake server</>
                      }
                    </button>
                  </div>
                  {preLoginWaking && (
                    <p className="text-[10px] text-white/20 text-right">Cold start may take up to 60s&hellip;</p>
                  )}
                  {preLoginStatus === "offline" && !preLoginWaking && (
                    <p className="text-[10px] text-red-400/50 text-right">Check VITE_API_URL on Vercel and ALLOWED_ORIGINS on Render.</p>
                  )}
                </div>
                <div className="flex justify-center">
                  <Link href="/app"><span className="text-xs text-white/25 hover:text-white/50 transition-colors cursor-pointer">Back to app →</span></Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview",       label: "Overview",       icon: Activity },
    { id: "users",          label: "Users",          icon: Users },
    { id: "tools",          label: "Tools",          icon: Wrench },
    { id: "documents",      label: "Documents",      icon: FileText },
    { id: "analytics",      label: "Analytics",      icon: TrendingUp },
    { id: "logs",           label: "Logs",           icon: Radio },
    { id: "gateways",       label: "Gateways",       icon: Globe },
    { id: "payments",       label: "Payments",       icon: CreditCard },
    { id: "credits",        label: "Credits",        icon: Coins },
    { id: "finance",        label: "Finance",        icon: BarChart3 },
    { id: "announcements",  label: "Announcements",  icon: Megaphone },
    { id: "settings",       label: "Settings",       icon: Settings },
  ];

  const filteredUsers = userSearch
    ? users.filter((u) => (u.email ?? u.id).toLowerCase().includes(userSearch.toLowerCase()))
    : users;

  const filteredPayments = paymentFilter === "all" ? payments
    : payments.filter((p) => p.status === paymentFilter);

  return (
    <div className="min-h-screen bg-[#04080f] text-white">
      {mobileNav && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMobileNav(false)} />}

      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-56 bg-white/[0.02] border-r border-white/8 flex flex-col transition-transform duration-200 ${mobileNav ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          <div className="px-4 py-5 border-b border-white/8">
            <Logo size={24} textSize="text-xs" className="opacity-80" />
            <div className="mt-2 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[10px] text-white/35 font-medium uppercase tracking-widest">Admin</span>
            </div>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setMobileNav(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === t.id ? "bg-white/8 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                <t.icon size={14} className={activeTab === t.id ? "text-red-400" : ""} />
                {t.label}
              </button>
            ))}
          </nav>
          <div className="px-3 py-4 border-t border-white/8">
            <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/35 hover:text-white/60 hover:bg-white/5 transition-all">
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="flex items-center gap-2 px-5 py-3.5 border-b border-white/8 bg-white/[0.01] shrink-0">
            <button className="lg:hidden text-white/40 hover:text-white/70 transition-colors" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X size={18} /> : <Menu size={18} />}
            </button>
            <h1 className="text-sm font-semibold text-white/80 capitalize">{activeTab}</h1>
            <div className="ml-auto flex items-center gap-2">
              {wakeResult && (
                <span className={`text-[10px] font-medium px-2 py-1 rounded-lg border ${wakeResult.ok ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                  {wakeResult.ok ? `✓ Online · ${wakeResult.uptimeSeconds ? Math.floor(wakeResult.uptimeSeconds / 60) + "m uptime" : ""}` : "✗ Offline"}
                </span>
              )}
              <button onClick={syncSupabase} disabled={syncingSupabase}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/40 hover:text-white/70 hover:bg-white/8 transition-all disabled:opacity-40 border border-white/8"
                title="Refresh user data from Supabase"
              >
                {syncingSupabase ? <Loader2 size={11} className="animate-spin" /> : <Database size={11} />}
                <span className="hidden sm:inline">Sync</span>
              </button>
              <button onClick={wakeBackend} disabled={waking}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/40 hover:text-emerald-400 hover:bg-emerald-500/8 transition-all disabled:opacity-40 border border-white/8"
                title="Ping backend to wake it up"
              >
                {waking ? <Loader2 size={11} className="animate-spin" /> : <Signal size={11} />}
                <span className="hidden sm:inline">Wake</span>
              </button>
              <button onClick={refreshTab} disabled={loading}
                className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/8 transition-all disabled:opacity-40"
                title="Refresh current tab"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-5 py-6">
            {/* ── Overview ─────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="space-y-6 max-w-5xl">
                <SectionHeader title="Platform Overview" sub="Live metrics across all users and tools" />
                {!stats && loading ? <Spinner /> : !stats && statsError ? (
                  <div className="bg-red-500/8 border border-red-500/15 rounded-xl px-5 py-6 flex flex-col items-center gap-3 text-center">
                    <AlertCircle size={22} className="text-red-400" />
                    <div>
                      <p className="text-sm font-semibold text-white/80">Could not load overview stats</p>
                      <p className="text-xs text-white/35 mt-1 font-mono">{statsError}</p>
                    </div>
                    <button onClick={loadStats} className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                      <RefreshCw size={11} /> Retry
                    </button>
                  </div>
                ) : stats ? (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <OverviewCard icon={<Users size={18} />} label="Users" value={stats.totalUsers} color="from-blue-600/20 to-blue-500/10" border="border-blue-500/15" iconColor="text-blue-400" />
                      <OverviewCard icon={<FileText size={18} />} label="Documents" value={stats.totalDocuments} color="from-indigo-600/20 to-indigo-500/10" border="border-indigo-500/15" iconColor="text-indigo-400" />
                      <OverviewCard icon={<DollarSign size={18} />} label="Total Revenue" value={stats.totalRevenueCents} format="money" color="from-emerald-600/20 to-emerald-500/10" border="border-emerald-500/15" iconColor="text-emerald-400" />
                      <OverviewCard icon={<Crown size={18} />} label="Active Subs" value={stats.activeSubscriptions} color="from-amber-600/20 to-amber-500/10" border="border-amber-500/15" iconColor="text-amber-400" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
                      <OverviewCard icon={<TrendingUp size={18} />} label="MRR (30 days)" value={stats.mrrCents} format="money" color="from-emerald-600/15 to-emerald-500/5" border="border-emerald-500/12" iconColor="text-emerald-400" />
                      <OverviewCard icon={<Users size={18} />} label="New Users (7 days)" value={stats.newUsersThisWeek} color="from-blue-600/15 to-blue-500/5" border="border-blue-500/12" iconColor="text-blue-400" />
                      <div className="bg-gradient-to-br from-violet-600/10 to-violet-500/5 border border-violet-500/12 rounded-xl p-4">
                        <p className="text-xs text-white/40 mb-2 font-medium">Plan Distribution</p>
                        <div className="space-y-1.5">
                          {[["starter", "text-blue-400"], ["pro", "text-amber-400"], ["campus", "text-emerald-400"]].map(([plan, color]) => (
                            <div key={plan} className="flex items-center justify-between">
                              <span className={`text-[11px] font-semibold capitalize ${color}`}>{plan}</span>
                              <span className="text-xs text-white/60 tabular-nums">{(stats.planDistribution[plan] ?? 0).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white/[0.025] border border-white/8 rounded-xl p-4">
                        <p className="text-xs text-white/40 mb-2 font-medium">AI Tools Breakdown</p>
                        <div className="space-y-1.5">
                          {[
                            ["Humanizer", stats.humanizerCompleted, "text-pink-400"],
                            ["Plagiarism", stats.plagiarismChecks, "text-cyan-400"],
                            ["Outlines", stats.outlineCount, "text-indigo-400"],
                          ].map(([label, val, color]) => (
                            <div key={label as string} className="flex items-center justify-between">
                              <span className={`text-[11px] font-semibold ${color}`}>{label}</span>
                              <span className="text-xs text-white/60 tabular-nums">{(val as number).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      <MiniCard icon={<PenLine size={14} className="text-violet-400" />} label="Papers" value={stats.papersWritten} />
                      <MiniCard icon={<Files size={14} className="text-blue-400" />} label="Revisions" value={stats.revisionsCompleted} />
                      <MiniCard icon={<FlaskConical size={14} className="text-cyan-400" />} label="STEM Solved" value={stats.stemSolved} />
                      <MiniCard icon={<GraduationCap size={14} className="text-amber-400" />} label="Study Sessions" value={stats.studySessions} />
                      <MiniCard icon={<Coins size={14} className="text-orange-400" />} label="Credits Issued" value={stats.totalCreditsIssuedCents} format="money" />
                    </div>
                    {Object.keys(stats.revenueByGateway).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-white/70 mb-3">Revenue by Gateway</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          {Object.entries(stats.revenueByGateway).map(([gw, data]) => (
                            <div key={gw} className="bg-white/[0.025] border border-white/8 rounded-xl px-4 py-3.5">
                              <p className="text-xs text-white/40 mb-1">{GATEWAY_LABELS[gw] ?? gw}</p>
                              <p className="text-base font-bold text-white">${(data.revenue / 100).toFixed(2)}</p>
                              <p className="text-[10px] text-white/25 mt-0.5">{data.count} txns</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {stats.recentDocuments.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-white/70">Recent Activity</h3>
                          <button onClick={() => setActiveTab("documents")} className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">View all <ChevronRight size={11} /></button>
                        </div>
                        <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                          {stats.recentDocuments.slice(0, 5).map((doc, i) => (
                            <div key={doc.id} className={`flex items-center gap-3 px-4 py-3 ${i < 4 ? "border-b border-white/6" : ""}`}>
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${typeGradient(doc.type)}`}>
                                <TypeIcon type={doc.type} size={13} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white/80 font-medium truncate">{doc.title}</p>
                                <p className="text-xs text-white/30 mt-0.5">{doc.userId ? doc.userId.slice(0, 8) + "…" : "anon"} · {new Date(doc.updatedAt).toLocaleDateString()}</p>
                              </div>
                              <TypeBadge type={doc.type} />
                              <span className="text-xs text-white/25 tabular-nums shrink-0">{doc.wordCount.toLocaleString()}w</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* ── Quick Access to All Panels ── */}
                    <div>
                      <h3 className="text-sm font-semibold text-white/70 mb-3">Quick Access</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                        {([
                          { id: "users",         label: "Users",          sub: "Accounts & bans",           icon: Users,        color: "text-blue-400",    bg: "bg-blue-500/8",    border: "border-blue-500/12" },
                          { id: "tools",         label: "Tools",          sub: "Enable, monitor & stats",   icon: Wrench,       color: "text-rose-400",    bg: "bg-rose-500/8",    border: "border-rose-500/12" },
                          { id: "documents",     label: "Documents",      sub: "All generated content",     icon: FileText,     color: "text-indigo-400",  bg: "bg-indigo-500/8",  border: "border-indigo-500/12" },
                          { id: "analytics",     label: "Analytics",      sub: "Traffic & usage",           icon: TrendingUp,   color: "text-violet-400",  bg: "bg-violet-500/8",  border: "border-violet-500/12" },
                          { id: "logs",          label: "Logs",           sub: "API request logs",          icon: Radio,        color: "text-cyan-400",    bg: "bg-cyan-500/8",    border: "border-cyan-500/12" },
                          { id: "gateways",      label: "Gateways",       sub: "Payment gateway config",    icon: Globe,        color: "text-teal-400",    bg: "bg-teal-500/8",    border: "border-teal-500/12" },
                          { id: "payments",      label: "Payments",       sub: "Transaction history",       icon: CreditCard,   color: "text-green-400",   bg: "bg-green-500/8",   border: "border-green-500/12" },
                          { id: "credits",       label: "Credits",        sub: "Balances & topups",         icon: Coins,        color: "text-orange-400",  bg: "bg-orange-500/8",  border: "border-orange-500/12" },
                          { id: "finance",       label: "Finance",        sub: "Revenue & reports",         icon: BarChart3,    color: "text-emerald-400", bg: "bg-emerald-500/8", border: "border-emerald-500/12" },
                          { id: "announcements", label: "Announcements",  sub: "Banner messages",           icon: Megaphone,    color: "text-pink-400",    bg: "bg-pink-500/8",    border: "border-pink-500/12" },
                          { id: "settings",      label: "Settings",       sub: "Platform config",           icon: Settings,     color: "text-white/50",    bg: "bg-white/5",       border: "border-white/10" },
                        ] as const).map(({ id, label, sub, icon: Icon, color, bg, border }) => (
                          <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex items-start gap-2.5 p-3 rounded-xl ${bg} border ${border} hover:bg-white/8 hover:border-white/15 transition-all text-left group`}
                          >
                            <div className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-white/10 transition-colors`}>
                              <Icon size={13} className={color} />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold ${color}`}>{label}</p>
                              <p className="text-[10px] text-white/30 leading-tight mt-0.5">{sub}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : <Empty text="Stats unavailable" />}
              </div>
            )}

            {/* ── Users ─────────────────────────────────────────────────── */}
            {activeTab === "users" && (
              <div className="space-y-5 max-w-6xl">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <SectionHeader title="Users" sub={`${users.length} ${hasEmailData ? "registered accounts" : "known users"}`} />
                  <input
                    type="text" placeholder="Search by email or ID…" value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-64 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/25 transition-all"
                  />
                </div>
                {supabaseError && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300">
                    <span className="font-semibold">Note:</span> {supabaseError}
                  </div>
                )}
                {deleteError && <ErrorBanner text={deleteError} />}
                <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_64px_68px_80px_90px_88px_88px_64px] gap-2 px-4 py-2.5 border-b border-white/6">
                    {["User", "Docs", "Sessions", "Plan", "Credits", "Joined", "Last Active", ""].map((h) => (
                      <span key={h} className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{h}</span>
                    ))}
                  </div>
                  {loading ? <div className="py-12 flex justify-center"><Loader2 size={16} className="animate-spin text-white/30" /></div>
                    : filteredUsers.length === 0 ? <Empty text="No users found" />
                    : filteredUsers.map((user, i) => (
                    <div key={user.id} className={`grid grid-cols-[1fr_64px_68px_80px_90px_88px_88px_64px] gap-2 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors ${i < filteredUsers.length - 1 ? "border-b border-white/6" : ""} ${user.banned ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shrink-0 text-[11px] font-bold text-white">
                          {user.email ? user.email[0].toUpperCase() : "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white/80 font-medium truncate">{user.email ?? "—"}</p>
                          <p className="text-[10px] text-white/25 font-mono truncate">{user.id.slice(0, 10)}…</p>
                        </div>
                        {user.banned && <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/20 shrink-0">BANNED</span>}
                      </div>
                      <span className="text-sm font-semibold text-white/70 tabular-nums">{user.documentCount}</span>
                      <span className="text-sm font-semibold text-white/70 tabular-nums">{user.sessionCount}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border w-fit capitalize ${PLAN_COLORS[user.plan] ?? PLAN_COLORS.starter}`}>{user.plan}</span>
                      <span className="text-xs text-amber-300 font-mono tabular-nums">{user.creditBalance.toLocaleString()} cr</span>
                      <span className="text-xs text-white/30">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</span>
                      <span className="text-xs text-white/40">{user.lastSignIn ? new Date(user.lastSignIn).toLocaleDateString() : <span className="text-white/20">—</span>}</span>
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setCreditAdjustUser(user); setCreditAdjustAmt(""); setCreditAdjustNote(""); }} title="Adjust credits"
                          className="p-1.5 rounded-md text-white/20 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                          <Coins size={11} />
                        </button>
                        <button onClick={() => { setPlanEditUser(user); setPlanEditValue(user.plan); }} title="Edit plan"
                          className="p-1.5 rounded-md text-white/20 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                          <Edit2 size={11} />
                        </button>
                        {hasEmailData && (
                          <>
                            <button onClick={() => toggleBan(user)} disabled={banTogglingId === user.id} title={user.banned ? "Unban" : "Ban"}
                              className="p-1.5 rounded-md text-white/20 hover:text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-40">
                              {banTogglingId === user.id ? <Loader2 size={11} className="animate-spin" /> : user.banned ? <UserCheck size={11} /> : <UserX size={11} />}
                            </button>
                            <button onClick={() => deleteUser(user.id)} disabled={deleteTarget === user.id} title="Delete user"
                              className="p-1.5 rounded-md text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
                              {deleteTarget === user.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tools ────────────────────────────────────────────────── */}
            {activeTab === "tools" && (
              <div className="space-y-6 max-w-5xl">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <SectionHeader title="AI Tools" sub="Monitor usage, error rates, and enable or disable each tool" />
                  <button onClick={loadTools} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
                    <RefreshCw size={11} /> Refresh
                  </button>
                </div>
                {toggleError && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                    <span>{toggleError}</span>
                  </div>
                )}
                {loading && adminTools.length === 0 ? <Spinner /> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {adminTools.map((tool) => {
                      const toolIcons: Record<string, React.ReactNode> = {
                        write:      <PenLine size={16} className="text-blue-400" />,
                        outline:    <FileText size={16} className="text-indigo-400" />,
                        revision:   <Files size={16} className="text-violet-400" />,
                        humanizer:  <Zap size={16} className="text-pink-400" />,
                        plagiarism: <Shield size={16} className="text-cyan-400" />,
                        stem:       <FlaskConical size={16} className="text-amber-400" />,
                        study:      <GraduationCap size={16} className="text-emerald-400" />,
                      };
                      const toolColors: Record<string, string> = {
                        write:      "from-blue-600/10 to-blue-500/5 border-blue-500/12",
                        outline:    "from-indigo-600/10 to-indigo-500/5 border-indigo-500/12",
                        revision:   "from-violet-600/10 to-violet-500/5 border-violet-500/12",
                        humanizer:  "from-pink-600/10 to-pink-500/5 border-pink-500/12",
                        plagiarism: "from-cyan-600/10 to-cyan-500/5 border-cyan-500/12",
                        stem:       "from-amber-600/10 to-amber-500/5 border-amber-500/12",
                        study:      "from-emerald-600/10 to-emerald-500/5 border-emerald-500/12",
                      };
                      const rate7d = tool.totalRequests7d > 0 ? tool.errorRate7d : null;
                      const rate30d = tool.totalRequests > 0 ? tool.errorRate : null;
                      const activeRate = rate7d !== null ? rate7d : (rate30d ?? 0);
                      const isError = tool.hasApiData && activeRate >= 20 && (rate7d !== null ? tool.totalRequests7d > 0 : tool.totalRequests > 0);
                      const isWarning = tool.hasApiData && activeRate >= 5 && activeRate < 20;
                      const isClean = tool.hasApiData && tool.errorCount > 0 && tool.errors7d === 0;
                      return (
                        <div key={tool.key} className={`bg-gradient-to-br ${toolColors[tool.key] ?? "from-white/5 to-white/2 border-white/8"} border rounded-2xl p-5 space-y-4 ${!tool.enabled ? "opacity-50" : ""}`}>
                          {/* Header row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                                {toolIcons[tool.key]}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white/90">{tool.label}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {tool.enabled ? (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                                      <CheckCircle2 size={9} /> Active
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold text-white/30">
                                      <XCircle size={9} /> Disabled
                                    </span>
                                  )}
                                  {isError && (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400">
                                      <AlertCircle size={9} /> High errors
                                    </span>
                                  )}
                                  {!isError && isWarning && (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400">
                                      <AlertTriangle size={9} /> Elevated errors
                                    </span>
                                  )}
                                  {isClean && (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400/70">
                                      <CheckCircle2 size={9} /> Clean 7d
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Toggle */}
                            <button
                              onClick={() => toggleTool(tool.key, !tool.enabled)}
                              disabled={togglingTool === tool.key}
                              className="shrink-0 transition-opacity disabled:opacity-40"
                              title={tool.enabled ? "Disable tool" : "Enable tool"}
                            >
                              {togglingTool === tool.key ? (
                                <Loader2 size={20} className="animate-spin text-white/30" />
                              ) : tool.enabled ? (
                                <ToggleRight size={28} className="text-emerald-400" />
                              ) : (
                                <ToggleLeft size={28} className="text-white/20" />
                              )}
                            </button>
                          </div>

                          {/* Stats grid */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-black/20 rounded-xl px-3 py-2.5 text-center">
                              <p className="text-base font-bold text-white tabular-nums">{tool.total.toLocaleString()}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">All time</p>
                            </div>
                            <div className="bg-black/20 rounded-xl px-3 py-2.5 text-center">
                              <p className="text-base font-bold text-white tabular-nums">{tool.thisMonth.toLocaleString()}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">This month</p>
                            </div>
                            <div className="bg-black/20 rounded-xl px-3 py-2.5 text-center">
                              <p className="text-base font-bold text-white tabular-nums">{tool.thisWeek.toLocaleString()}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">This week</p>
                            </div>
                          </div>

                          {/* Error rate + response time row */}
                          <div className="flex items-center justify-between text-xs border-t border-white/6 pt-3">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1 text-white/40">
                                <BarChart2 size={10} />
                                {!tool.hasApiData ? (
                                  <span className="text-white/25">No API data</span>
                                ) : rate7d !== null ? (
                                  <span className={isError ? "text-red-400 font-semibold" : isWarning ? "text-amber-400 font-semibold" : "text-white/50"}>
                                    {rate7d}% errors <span className="text-white/25 font-normal">(7d · {tool.errors7d}/{tool.totalRequests7d})</span>
                                  </span>
                                ) : (
                                  <span className={isError ? "text-red-400 font-semibold" : isWarning ? "text-amber-400 font-semibold" : "text-white/50"}>
                                    {tool.errorRate}% errors <span className="text-white/25 font-normal">(30d · {tool.errorCount}/{tool.totalRequests})</span>
                                  </span>
                                )}
                              </span>
                              {tool.avgMs > 0 && (
                                <span className="flex items-center gap-1 text-white/40">
                                  <Timer size={10} />
                                  <span className="text-white/50">{tool.avgMs}ms avg</span>
                                </span>
                              )}
                            </div>
                            <span className="text-white/25 text-[10px]">
                              {tool.lastUsed ? `Last used ${new Date(tool.lastUsed).toLocaleDateString()}` : "Never used"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {!loading && adminTools.length === 0 && (
                  <Empty text="No tool data — push to Render to seed system settings" />
                )}
              </div>
            )}

            {/* ── Documents ─────────────────────────────────────────────── */}
            {activeTab === "documents" && (
              <div className="space-y-5 max-w-5xl">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <SectionHeader title="All Documents" sub={`${docTotal.toLocaleString()} total · showing up to 200`} />
                  <div className="flex gap-2 items-center flex-wrap">
                    <input
                      type="text" placeholder="Search title…" value={docSearch}
                      onChange={(e) => setDocSearch(e.target.value)}
                      className="w-48 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/25 transition-all"
                    />
                    <button onClick={loadDocuments} disabled={loading}
                      className="px-3 py-1.5 rounded-xl bg-white/8 border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/12 transition-all disabled:opacity-40"
                    >Search</button>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {(["all", "paper", "revision", "humanizer", "stem", "study", "plagiarism", "outline"] as const).map((t) => (
                    <button key={t} onClick={() => setDocTypeFilter(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${docTypeFilter === t ? "bg-white/10 text-white" : "text-white/35 hover:text-white/60"}`}
                    >{t === "all" ? "All Types" : t}</button>
                  ))}
                </div>
                <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_100px_80px_140px_100px] gap-2 px-4 py-2.5 border-b border-white/6">
                    {["Title", "Type", "Words", "User", "Updated"].map((h) => (
                      <span key={h} className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{h}</span>
                    ))}
                  </div>
                  {loading && documents.length === 0
                    ? <div className="py-12 flex justify-center"><Loader2 size={16} className="animate-spin text-white/30" /></div>
                    : (() => {
                        const filtered = documents.filter((d) => {
                          if (docTypeFilter !== "all" && d.type !== docTypeFilter) return false;
                          if (docSearch.trim() && !d.title.toLowerCase().includes(docSearch.toLowerCase())) return false;
                          return true;
                        });
                        if (filtered.length === 0) return <Empty text="No documents found" />;
                        return filtered.map((doc, i) => (
                          <div key={doc.id} className={`grid grid-cols-[1fr_100px_80px_140px_100px] gap-2 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors ${i < filtered.length - 1 ? "border-b border-white/6" : ""}`}>
                            <p className="text-sm text-white/75 font-medium truncate" title={doc.title}>{doc.title}</p>
                            <TypeBadge type={doc.type} />
                            <span className="text-xs text-white/35 tabular-nums">{doc.wordCount.toLocaleString()}w</span>
                            <span className="text-[11px] text-white/30 font-mono truncate" title={doc.userId ?? ""}>{doc.userId ? doc.userId.slice(0, 10) + "…" : "anon"}</span>
                            <span className="text-xs text-white/30">{new Date(doc.updatedAt).toLocaleDateString()}</span>
                          </div>
                        ));
                      })()
                  }
                </div>
              </div>
            )}

            {/* ── Gateways ──────────────────────────────────────────────── */}
            {activeTab === "gateways" && (
              <div className="space-y-5 max-w-3xl">
                <SectionHeader title="Payment Gateways" sub="Pause or enable individual payment processors" />
                {loading && !gateways.length ? <Spinner /> : gateways.length === 0
                  ? <Empty text="No gateway data yet — ensure DB is initialized" />
                  : (
                  <div className="space-y-3">
                    {gateways.map((g) => (
                      <div key={g.gateway} className="bg-white/[0.02] border border-white/8 rounded-xl px-5 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2.5 mb-1">
                              <span className="font-semibold text-sm text-white">{GATEWAY_LABELS[g.gateway] ?? g.gateway}</span>
                              {g.configured
                                ? <Badge color="green"><CheckCircle2 size={9} /> Configured</Badge>
                                : <Badge color="amber"><Settings size={9} /> Needs API keys</Badge>}
                              {g.paused && <Badge color="red"><Ban size={9} /> Paused</Badge>}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-white/35">
                              <span className="flex items-center gap-1"><DollarSign size={10} />${(g.stats.revenue / 100).toFixed(2)} revenue</span>
                              <span className="flex items-center gap-1"><Wallet size={10} />{g.stats.count} transactions</span>
                            </div>
                          </div>
                          <button onClick={() => toggleGateway(g.gateway, !g.paused)} disabled={togglingGateway === g.gateway}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${g.paused ? "bg-green-500/12 text-green-400 border border-green-500/20 hover:bg-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"}`}
                          >
                            {togglingGateway === g.gateway ? <Loader2 size={12} className="animate-spin" /> : g.paused ? "Enable" : "Pause"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3 text-xs text-blue-300/70 space-y-1">
                  <p className="font-medium text-blue-300/90">Routing order (by user location):</p>
                  <p>🇰🇪 🇺🇬 🇹🇿 East Africa → IntaSend (mobile money)</p>
                  <p>🌍 Rest of Africa → Paystack (card + mobile)</p>
                  <p>🌐 US, EU, AU → Stripe</p>
                  <p>🌏 Rest of world → Paddle</p>
                  <p>⚠️ High-risk → Paystack (3D Secure)</p>
                </div>
              </div>
            )}

            {/* ── Payments ──────────────────────────────────────────────── */}
            {activeTab === "payments" && (
              <div className="space-y-5 max-w-6xl">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <SectionHeader title="Payment Transactions" sub="All payments across all gateways" />
                  <div className="flex gap-1.5">
                    {(["all", "completed", "pending", "failed"] as const).map((f) => (
                      <button key={f} onClick={() => setPaymentFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${paymentFilter === f ? "bg-white/10 text-white" : "text-white/35 hover:text-white/60"}`}
                      >{f}</button>
                    ))}
                  </div>
                </div>
                <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_90px_80px_80px_80px_100px_100px] gap-2 px-4 py-2.5 border-b border-white/6">
                    {["User", "Gateway", "Type", "Tool", "Amount", "Date", "Status"].map((h) => (
                      <span key={h} className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{h}</span>
                    ))}
                  </div>
                  {loading ? <div className="py-12 flex justify-center"><Loader2 size={16} className="animate-spin text-white/30" /></div>
                    : filteredPayments.length === 0 ? <Empty text="No payments yet" />
                    : filteredPayments.map((p, i) => (
                    <div key={p.id} className={`grid grid-cols-[1fr_90px_80px_80px_80px_100px_100px] gap-2 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors ${i < filteredPayments.length - 1 ? "border-b border-white/6" : ""}`}>
                      <span className="text-[11px] text-white/50 font-mono truncate">{p.user_id.slice(0, 12)}…</span>
                      <span className="text-xs text-white/60">{GATEWAY_LABELS[p.gateway] ?? p.gateway}</span>
                      <span className="text-xs text-white/60 capitalize">{p.type}</span>
                      <span className="text-xs text-white/45 capitalize">{p.tool ?? p.plan ?? "—"}</span>
                      <span className="text-xs font-semibold text-white tabular-nums">${(p.amount_cents / 100).toFixed(2)}</span>
                      <span className="text-xs text-white/30">{new Date(p.created_at).toLocaleDateString()}</span>
                      <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${
                        p.status === "completed" ? "bg-green-500/12 text-green-400 border-green-500/20"
                        : p.status === "failed" ? "bg-red-500/12 text-red-400 border-red-500/20"
                        : "bg-amber-500/12 text-amber-400 border-amber-500/20"
                      }`}>{p.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Credits ───────────────────────────────────────────────── */}
            {activeTab === "credits" && (
              <div className="space-y-6 max-w-5xl">
                <SectionHeader title="Credits" sub="User credit balances and transaction history" />
                {creditTotals && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-4">
                      <p className="text-xs text-amber-400/60 mb-1">Total Balance</p>
                      <p className="text-2xl font-bold text-amber-400">{Number(creditTotals.total_balance).toLocaleString()} cr</p>
                      <p className="text-[11px] text-white/30 mt-0.5">≈ ${(Number(creditTotals.total_balance) / 100).toFixed(2)}</p>
                    </div>
                    <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-4">
                      <p className="text-xs text-emerald-400/60 mb-1">Total Earned (all time)</p>
                      <p className="text-2xl font-bold text-emerald-400">{Number(creditTotals.total_earned).toLocaleString()} cr</p>
                      <p className="text-[11px] text-white/30 mt-0.5">≈ ${(Number(creditTotals.total_earned) / 100).toFixed(2)}</p>
                    </div>
                    <div className="bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-4">
                      <p className="text-xs text-red-400/60 mb-1">Total Spent (all time)</p>
                      <p className="text-2xl font-bold text-red-400">{Number(creditTotals.total_spent).toLocaleString()} cr</p>
                      <p className="text-[11px] text-white/30 mt-0.5">≈ ${(Number(creditTotals.total_spent) / 100).toFixed(2)}</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-3">Top Credit Balances</h3>
                    <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                      {loading ? <div className="py-8 flex justify-center"><Loader2 size={16} className="animate-spin text-white/30" /></div>
                        : creditUsers.length === 0 ? <Empty text="No credit data yet" />
                        : creditUsers.slice(0, 15).map((u, i) => (
                        <div key={u.user_id} className={`flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors ${i < Math.min(creditUsers.length, 15) - 1 ? "border-b border-white/6" : ""}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/50 font-mono truncate">{u.user_id.slice(0, 16)}…</p>
                            <p className="text-[10px] text-white/25 mt-0.5">Spent: {u.lifetime_spent_cents.toLocaleString()} cr</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-amber-400 tabular-nums">{u.balance_cents.toLocaleString()} cr</p>
                            <p className="text-[10px] text-white/30">≈ ${(u.balance_cents / 100).toFixed(2)}</p>
                          </div>
                          <button onClick={() => { const usr = users.find((x) => x.id === u.user_id); if (usr) { setCreditAdjustUser(usr); setCreditAdjustAmt(""); setCreditAdjustNote(""); } else { setCreditAdjustUser({ id: u.user_id, email: null, createdAt: null, lastSignIn: null, documentCount: 0, sessionCount: 0, plan: "starter", billing: null, creditBalance: u.balance_cents, lifetimeEarned: u.lifetime_earned_cents, lifetimeSpent: u.lifetime_spent_cents, banned: false, banReason: null }); setCreditAdjustAmt(""); setCreditAdjustNote(""); } }}
                            className="p-1.5 rounded-md text-white/20 hover:text-amber-400 hover:bg-amber-500/10 transition-all" title="Adjust credits">
                            <Edit2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-3">Recent Transactions</h3>
                    <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                      {loading ? <div className="py-8 flex justify-center"><Loader2 size={16} className="animate-spin text-white/30" /></div>
                        : creditTx.length === 0 ? <Empty text="No transactions yet" />
                        : creditTx.map((tx, i) => (
                        <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < creditTx.length - 1 ? "border-b border-white/6" : ""}`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tx.amount_cents > 0 ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                            {tx.amount_cents > 0 ? <ArrowUp size={12} className="text-emerald-400" /> : <ArrowDown size={12} className="text-red-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/60 truncate">{tx.description}</p>
                            <p className="text-[10px] text-white/25 mt-0.5">{tx.user_id.slice(0, 12)}… · {new Date(tx.created_at).toLocaleDateString()}</p>
                          </div>
                          <span className={`text-sm font-bold tabular-nums ${tx.amount_cents > 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {tx.amount_cents > 0 ? "+" : ""}{tx.amount_cents.toLocaleString()} cr
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Finance ───────────────────────────────────────────────── */}
            {activeTab === "finance" && (
              <div className="space-y-6 max-w-5xl">
                <SectionHeader title="Finance" sub="Breakdown of all completed payments and revenue" />
                {loading && !revenue ? <Spinner /> : revenue ? (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-4">
                        <p className="text-xs text-emerald-400/60 mb-1">Total Revenue</p>
                        <p className="text-2xl font-bold text-white">${(Number(revenue.summary.total) / 100).toFixed(2)}</p>
                      </div>
                      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-4">
                        <p className="text-xs text-blue-400/60 mb-1">This Month</p>
                        <p className="text-2xl font-bold text-white">${(Number(revenue.summary.this_month) / 100).toFixed(2)}</p>
                        {Number(revenue.summary.last_month) > 0 && (
                          <p className={`text-[11px] mt-0.5 ${Number(revenue.summary.this_month) >= Number(revenue.summary.last_month) ? "text-emerald-400" : "text-red-400"}`}>
                            {Number(revenue.summary.this_month) >= Number(revenue.summary.last_month) ? "▲" : "▼"} vs last month
                          </p>
                        )}
                      </div>
                      <div className="bg-white/[0.02] border border-white/8 rounded-xl px-4 py-4">
                        <p className="text-xs text-white/40 mb-1">Last Month</p>
                        <p className="text-2xl font-bold text-white">${(Number(revenue.summary.last_month) / 100).toFixed(2)}</p>
                      </div>
                      <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-4">
                        <p className="text-xs text-amber-400/60 mb-1">Pending</p>
                        <p className="text-2xl font-bold text-amber-400">${(Number(revenue.summary.pending) / 100).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      <div>
                        <h3 className="text-sm font-semibold text-white/70 mb-3">By Gateway</h3>
                        <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                          {revenue.byGateway.length === 0 ? <Empty text="No data" /> : revenue.byGateway.map((r, i) => (
                            <div key={r.gateway} className={`flex items-center gap-3 px-4 py-3 ${i < revenue.byGateway.length - 1 ? "border-b border-white/6" : ""}`}>
                              <div className="flex-1">
                                <p className="text-sm text-white/80">{GATEWAY_LABELS[r.gateway] ?? r.gateway}</p>
                                <p className="text-[10px] text-white/30 mt-0.5">{r.count} transactions</p>
                              </div>
                              <p className="text-sm font-bold text-white">${(Number(r.revenue) / 100).toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white/70 mb-3">By Type</h3>
                        <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                          {revenue.byType.length === 0 ? <Empty text="No data" /> : revenue.byType.map((r, i) => (
                            <div key={r.type} className={`flex items-center gap-3 px-4 py-3 ${i < revenue.byType.length - 1 ? "border-b border-white/6" : ""}`}>
                              <div className="flex-1">
                                <p className="text-sm text-white/80 capitalize">{r.type}</p>
                                <p className="text-[10px] text-white/30 mt-0.5">{r.count} payments</p>
                              </div>
                              <p className="text-sm font-bold text-white">${(Number(r.revenue) / 100).toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white/70 mb-3">Top Paying Users</h3>
                        <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                          {revenue.topUsers.length === 0 ? <Empty text="No data" /> : revenue.topUsers.map((u, i) => (
                            <div key={u.user_id} className={`flex items-center gap-3 px-4 py-3 ${i < revenue.topUsers.length - 1 ? "border-b border-white/6" : ""}`}>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white/50 font-mono truncate">{u.user_id.slice(0, 14)}…</p>
                                <p className="text-[10px] text-white/25 mt-0.5">{u.count} payments</p>
                              </div>
                              <p className="text-sm font-bold text-emerald-400">${(Number(u.revenue) / 100).toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white/70 mb-3">Monthly Breakdown</h3>
                      <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                        <div className="grid grid-cols-[120px_1fr_80px_80px] gap-3 px-4 py-2.5 border-b border-white/6">
                          {["Month", "Revenue bar", "Revenue", "Payments"].map((h) => (
                            <span key={h} className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{h}</span>
                          ))}
                        </div>
                        {revenue.byMonth.length === 0 ? <Empty text="No monthly data yet" /> : (() => {
                          const maxRev = Math.max(...revenue.byMonth.map((r) => Number(r.revenue)), 1);
                          return revenue.byMonth.map((r, i) => (
                            <div key={r.month} className={`grid grid-cols-[120px_1fr_80px_80px] gap-3 items-center px-4 py-3 ${i < revenue.byMonth.length - 1 ? "border-b border-white/6" : ""}`}>
                              <span className="text-sm text-white/70 font-mono">{r.month}</span>
                              <div className="h-2 bg-white/6 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500/60 rounded-full transition-all" style={{ width: `${(Number(r.revenue) / maxRev) * 100}%` }} />
                              </div>
                              <span className="text-sm font-semibold text-white tabular-nums">${(Number(r.revenue) / 100).toFixed(2)}</span>
                              <span className="text-xs text-white/35 tabular-nums">{r.count}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </>
                ) : <Empty text="No revenue data yet" />}
              </div>
            )}

            {/* ── Analytics ─────────────────────────────────────────────── */}
            {activeTab === "analytics" && (
              <div className="space-y-6 max-w-5xl">
                <SectionHeader title="Traffic & Analytics" sub="Real-time and historical usage by region" />
                {!traffic && loading ? <Spinner /> : traffic ? (
                  <>
                    {/* KPI row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <OverviewCard icon={<Users size={18} />} label="Registered Users" value={traffic.totalRegisteredUsers} color="from-blue-600/20 to-blue-500/10" border="border-blue-500/15" iconColor="text-blue-400" />
                      <OverviewCard icon={<Activity size={18} />} label="Active (All Time)" value={traffic.totalActiveUsers} color="from-violet-600/20 to-violet-500/10" border="border-violet-500/15" iconColor="text-violet-400" />
                      <OverviewCard icon={<Clock size={18} />} label="Daily Active (24h)" value={traffic.dailyActiveUsers} color="from-amber-600/20 to-amber-500/10" border="border-amber-500/15" iconColor="text-amber-400" />
                      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600/20 to-emerald-500/10 border border-emerald-500/15 rounded-xl p-5">
                        <div className="text-emerald-400 mb-3 flex items-center gap-2">
                          <Radio size={18} />
                          {traffic.liveUsers > 0 && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                        </div>
                        <div className="text-2xl font-bold text-white tabular-nums">{traffic.liveUsers}</div>
                        <div className="text-xs text-white/45 mt-1 font-medium">Live Now (5 min)</div>
                      </div>
                    </div>

                    {/* 24h request bar chart */}
                    {traffic.byHour.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-white/70 mb-3">Requests — Last 24 Hours</h3>
                        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-4">
                          <div className="flex items-end gap-1 h-24">
                            {(() => {
                              const max = Math.max(...traffic.byHour.map((h) => Number(h.requests)), 1);
                              return traffic.byHour.map((h, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur rounded px-1.5 py-1 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    {h.hour} · {h.requests} req{Number(h.errors) > 0 ? ` · ${h.errors} err` : ""}
                                  </div>
                                  <div className="w-full rounded-t-sm" style={{ height: `${(Number(h.requests) / max) * 88}px`, background: Number(h.errors) > Number(h.requests) * 0.1 ? "rgb(239 68 68 / 0.5)" : "rgb(99 102 241 / 0.6)" }} />
                                </div>
                              ));
                            })()}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-[10px] text-white/30">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-500/60 inline-block" />Normal</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/50 inline-block" />&gt;10% errors</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* By country */}
                    <div>
                      <h3 className="text-sm font-semibold text-white/70 mb-3">Traffic by Region (30 days)</h3>
                      <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                        {traffic.byCountry.length === 0 ? <Empty text="No traffic recorded yet — data builds as users make requests" /> : (
                          <>
                            <div className="grid grid-cols-[1fr_1fr_100px_100px] gap-2 px-4 py-2.5 border-b border-white/6">
                              {["Country", "", "Requests", "Unique Users"].map((h) => (
                                <span key={h} className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{h}</span>
                              ))}
                            </div>
                            {(() => {
                              const maxReq = Math.max(...traffic.byCountry.map((r) => Number(r.requests)), 1);
                              return traffic.byCountry.map((r, i) => (
                                <div key={r.country} className={`grid grid-cols-[1fr_1fr_100px_100px] gap-2 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors ${i < traffic.byCountry.length - 1 ? "border-b border-white/6" : ""}`}>
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-lg leading-none">{countryFlag(r.country)}</span>
                                    <span className="text-sm text-white/80 font-medium">{countryName(r.country)}</span>
                                    <span className="text-[10px] text-white/25 font-mono">{r.country}</span>
                                  </div>
                                  <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500/50 rounded-full" style={{ width: `${(Number(r.requests) / maxReq) * 100}%` }} />
                                  </div>
                                  <span className="text-sm font-semibold text-white/70 tabular-nums">{Number(r.requests).toLocaleString()}</span>
                                  <span className="text-sm text-white/40 tabular-nums">{Number(r.users).toLocaleString()}</span>
                                </div>
                              ));
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : <Empty text="Analytics unavailable" />}

                {/* Tool Health Summary */}
                {adminTools.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                      <BarChart2 size={13} className="text-indigo-400" /> Tool Health (30 day window)
                    </h3>
                    <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-[1fr_80px_80px_80px_110px_100px] gap-2 px-4 py-2.5 border-b border-white/6">
                        {["Tool", "Enabled", "Requests", "Errors", "Error Rate", "Last Used"].map((h) => (
                          <span key={h} className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{h}</span>
                        ))}
                      </div>
                      {adminTools.map((tool, i) => {
                        const rate7d = tool.totalRequests7d > 0 ? tool.errorRate7d : null;
                        const displayRate = rate7d !== null ? rate7d : (tool.hasApiData ? tool.errorRate : null);
                        const periodLabel = rate7d !== null ? "7d" : "30d";
                        const errCount = rate7d !== null ? tool.errors7d : tool.errorCount;
                        const isHigh = displayRate !== null && displayRate >= 20;
                        const isMed = displayRate !== null && displayRate >= 5 && displayRate < 20;
                        return (
                          <div key={tool.key} className={`grid grid-cols-[1fr_80px_80px_80px_110px_100px] gap-2 items-center px-4 py-3 ${i < adminTools.length - 1 ? "border-b border-white/5" : ""}`}>
                            <span className="text-sm font-medium text-white/75">{tool.label}</span>
                            <span className={`text-xs font-semibold ${tool.enabled ? "text-emerald-400" : "text-white/25"}`}>{tool.enabled ? "On" : "Off"}</span>
                            <span className="text-sm text-white/50 tabular-nums">{tool.hasApiData ? tool.totalRequests.toLocaleString() : <span className="text-white/20">—</span>}</span>
                            <span className={`text-sm tabular-nums font-semibold ${errCount > 0 ? "text-red-400" : "text-white/30"}`}>{tool.hasApiData ? errCount : <span className="text-white/20">—</span>}</span>
                            <div className="flex items-center gap-1.5">
                              {displayRate === null ? (
                                <span className="text-[10px] text-white/20">No data</span>
                              ) : tool.errorCount > 0 && tool.errors7d === 0 ? (
                                <span className="text-[10px] text-emerald-400/70 font-semibold">Clean 7d</span>
                              ) : (
                                <>
                                  <span className={`text-sm font-bold tabular-nums ${isHigh ? "text-red-400" : isMed ? "text-amber-400" : "text-emerald-400"}`}>{displayRate}%</span>
                                  <span className="text-[10px] text-white/25">{periodLabel}</span>
                                </>
                              )}
                            </div>
                            <span className="text-xs text-white/30">{tool.lastUsed ? new Date(tool.lastUsed).toLocaleDateString() : <span className="text-white/20">—</span>}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PWA Install Stats */}
                {pwaStats !== null && (
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                      <span className="text-blue-400">⚡</span> PWA Installs
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      {[
                        { label: "Confirmed Installs", value: pwaStats.totalInstalls, sub: `+${pwaStats.installs7d} this week`, color: "text-blue-400" },
                        { label: "Android", value: pwaStats.androidInstalls, sub: "via install prompt", color: "text-emerald-400" },
                        { label: "iOS", value: pwaStats.iosInstalls, sub: "via Add to Home Screen", color: "text-sky-400" },
                        { label: "Standalone Opens", value: pwaStats.totalLaunches, sub: `${pwaStats.launches7d} in last 7d`, color: "text-violet-400" },
                      ].map(({ label, value, sub, color }) => (
                        <div key={label} className="bg-white/[0.02] border border-white/8 rounded-xl p-4">
                          <div className={`text-2xl font-bold tabular-nums mb-0.5 ${color}`}>{value}</div>
                          <div className="text-xs text-white/50 font-medium">{label}</div>
                          <div className="text-[10px] text-white/25 mt-0.5">{sub}</div>
                        </div>
                      ))}
                    </div>
                    {pwaStats.totalInstalls === 0 && pwaStats.totalLaunches === 0 && (
                      <p className="text-xs text-white/25 italic px-1">No installs tracked yet. Data appears here as users install the PWA on Android or iOS.</p>
                    )}
                  </div>
                )}

                {/* Quality feedback */}
                {feedbackStats.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                      <ThumbsUp size={13} className="text-emerald-400" /> Tool Quality Ratings (30 days)
                    </h3>
                    <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-[1fr_80px_80px_80px_90px] gap-2 px-4 py-2.5 border-b border-white/6">
                        {["Tool", "👍 Positive", "👎 Negative", "Total", "Score"].map((h) => (
                          <span key={h} className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{h}</span>
                        ))}
                      </div>
                      {feedbackStats.map((f, i) => (
                        <div key={f.tool} className={`grid grid-cols-[1fr_80px_80px_80px_90px] gap-2 items-center px-4 py-3 ${i < feedbackStats.length - 1 ? "border-b border-white/5" : ""}`}>
                          <span className="text-sm font-medium text-white/75 capitalize">{f.tool.replace(/_/g, " ")}</span>
                          <span className="text-sm font-semibold text-emerald-400 tabular-nums">{f.positive}</span>
                          <span className="text-sm font-semibold text-red-400 tabular-nums">{f.negative}</span>
                          <span className="text-sm text-white/40 tabular-nums">{f.total}</span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${f.score ?? 0}%` }} />
                            </div>
                            <span className={`text-xs font-bold tabular-nums ${Number(f.score) >= 70 ? "text-emerald-400" : Number(f.score) >= 40 ? "text-amber-400" : "text-red-400"}`}>{f.score}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Logs ──────────────────────────────────────────────────── */}
            {activeTab === "logs" && (
              <div className="space-y-5 max-w-6xl">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <SectionHeader title="Request Logs" sub="Last 200 API requests and all server errors" />
                  <div className="flex gap-1.5">
                    {(["all", "success", "errors"] as const).map((f) => (
                      <button key={f} onClick={() => setLogFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${logFilter === f ? "bg-white/10 text-white" : "text-white/35 hover:text-white/60"}`}
                      >{f}</button>
                    ))}
                  </div>
                </div>

                {/* Summary stats */}
                {logSummary && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { label: "Total (24h)", value: logSummary.total, color: "text-white" },
                      { label: "Success", value: logSummary.success, color: "text-green-400" },
                      { label: "Client Errors (4xx)", value: logSummary.client_errors, color: "text-amber-400" },
                      { label: "Server Errors (5xx)", value: logSummary.server_errors, color: "text-red-400" },
                      { label: "Avg Response", value: logSummary.avg_ms ? `${logSummary.avg_ms}ms` : "—", color: "text-blue-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-white/[0.025] border border-white/8 rounded-xl px-4 py-3">
                        <p className="text-[10px] text-white/35 mb-1">{label}</p>
                        <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Server error log */}
                {errorLogs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-400/80 mb-3 flex items-center gap-2">
                      <ServerCrash size={14} /> Server Errors (5xx)
                    </h3>
                    <div className="bg-red-500/5 border border-red-500/15 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-[70px_200px_60px_80px_1fr_110px] gap-2 px-4 py-2.5 border-b border-red-500/10">
                        {["Method", "Path", "Status", "Country", "Error", "Time"].map((h) => (
                          <span key={h} className="text-[10px] font-semibold text-red-400/40 uppercase tracking-wide">{h}</span>
                        ))}
                      </div>
                      {errorLogs.map((e, i) => (
                        <div key={e.id} className={`grid grid-cols-[70px_200px_60px_80px_1fr_110px] gap-2 items-start px-4 py-3 hover:bg-red-500/5 transition-colors ${i < errorLogs.length - 1 ? "border-b border-red-500/8" : ""}`}>
                          <MethodBadge method={e.method} />
                          <span className="text-xs text-white/60 font-mono truncate">{e.path}</span>
                          <span className="text-xs font-bold text-red-400 tabular-nums">{e.status}</span>
                          <span className="text-xs text-white/40">{countryFlag(e.country)} {e.country}</span>
                          <span className="text-xs text-red-300/70 break-all">{e.error_msg ?? "No message captured"}</span>
                          <span className="text-[10px] text-white/25">{new Date(e.created_at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Request log */}
                <div>
                  <h3 className="text-sm font-semibold text-white/70 mb-3">Request Log</h3>
                  <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[70px_1fr_60px_80px_70px_80px_110px] gap-2 px-4 py-2.5 border-b border-white/6">
                      {["Method", "Path", "Status", "Country", "Time", "User", "When"].map((h) => (
                        <span key={h} className="text-[10px] font-semibold text-white/25 uppercase tracking-wide">{h}</span>
                      ))}
                    </div>
                    {loading ? <div className="py-12 flex justify-center"><Loader2 size={16} className="animate-spin text-white/30" /></div>
                      : requestLogs.length === 0 ? <Empty text="No requests logged yet" />
                      : requestLogs.map((log, i) => (
                      <div key={log.id} className={`grid grid-cols-[70px_1fr_60px_80px_70px_80px_110px] gap-2 items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors ${i < requestLogs.length - 1 ? "border-b border-white/5" : ""}`}>
                        <MethodBadge method={log.method} />
                        <span className="text-xs text-white/55 font-mono truncate" title={log.path}>{log.path}</span>
                        <span className={`text-xs font-bold tabular-nums ${log.status < 300 ? "text-green-400" : log.status < 400 ? "text-blue-400" : log.status < 500 ? "text-amber-400" : "text-red-400"}`}>{log.status}</span>
                        <span className="text-xs text-white/35">{countryFlag(log.country)} {log.country}</span>
                        <span className="text-xs text-white/30 tabular-nums">{log.duration_ms != null ? `${log.duration_ms}ms` : "—"}</span>
                        <span className="text-[10px] text-white/25 font-mono truncate">{log.user_id ? log.user_id.slice(0, 8) + "…" : "anon"}</span>
                        <span className="text-[10px] text-white/25">{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Announcements ─────────────────────────────────────────── */}
            {activeTab === "announcements" && (
              <div className="space-y-6 max-w-3xl">
                <SectionHeader title="Announcements" sub="Post messages that users see as a banner in their panel" />

                {/* Create new */}
                <div className="bg-white/[0.02] border border-white/8 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white/70">New Announcement</h3>
                  {announcementError && <ErrorBanner text={announcementError} />}
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Title <span className="text-white/20">(optional)</span></label>
                      <input type="text" value={newAnnouncement.title}
                        onChange={(e) => setNewAnnouncement((p) => ({ ...p, title: e.target.value }))}
                        placeholder="e.g. Scheduled maintenance"
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/25 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Message <span className="text-red-400/60">*</span></label>
                      <textarea rows={2} value={newAnnouncement.message}
                        onChange={(e) => setNewAnnouncement((p) => ({ ...p, message: e.target.value }))}
                        placeholder="e.g. We're upgrading servers on Sunday 2–4am UTC. Expect brief downtime."
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/25 transition-all resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5">Link URL <span className="text-white/20">(optional)</span></label>
                        <input type="url" value={newAnnouncement.link}
                          onChange={(e) => setNewAnnouncement((p) => ({ ...p, link: e.target.value }))}
                          placeholder="https://..."
                          className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/25 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5">Link Label</label>
                        <input type="text" value={newAnnouncement.link_text}
                          onChange={(e) => setNewAnnouncement((p) => ({ ...p, link_text: e.target.value }))}
                          placeholder="Learn more"
                          className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/25 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Color</label>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { key: "blue",    cls: "bg-blue-500/20 text-blue-300 ring-blue-500" },
                          { key: "amber",   cls: "bg-amber-500/20 text-amber-300 ring-amber-500" },
                          { key: "red",     cls: "bg-red-500/20 text-red-300 ring-red-500" },
                          { key: "emerald", cls: "bg-emerald-500/20 text-emerald-300 ring-emerald-500" },
                          { key: "violet",  cls: "bg-violet-500/20 text-violet-300 ring-violet-500" },
                        ].map(({ key, cls }) => (
                          <button key={key} onClick={() => setNewAnnouncement((p) => ({ ...p, color: key }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${cls} ${newAnnouncement.color === key ? "ring-2 ring-offset-1 ring-offset-[#04080f]" : "opacity-50 hover:opacity-80"}`}
                          >{key}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Preview */}
                  {newAnnouncement.message && (
                    <AnnouncementPreview a={{ ...newAnnouncement, id: 0, is_active: true, created_at: "" } as Announcement} />
                  )}
                  <button onClick={createAnnouncement} disabled={announcementSaving || !newAnnouncement.message.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {announcementSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    Post Announcement
                  </button>
                </div>

                {/* Existing announcements */}
                <div>
                  <h3 className="text-sm font-semibold text-white/70 mb-3">Posted Announcements</h3>
                  {loading ? <Spinner /> : announcements.length === 0 ? <Empty text="No announcements yet — create your first one above" /> : (
                    <div className="space-y-3">
                      {announcements.map((a) => (
                        <div key={a.id} className={`bg-white/[0.02] border rounded-xl p-4 transition-all ${a.is_active ? "border-white/10" : "border-white/5 opacity-50"}`}>
                          {editingAnnouncement?.id === a.id ? (
                            <div className="space-y-3">
                              <input type="text" value={editingAnnouncement.title ?? ""}
                                onChange={(e) => setEditingAnnouncement((p) => p ? { ...p, title: e.target.value } : p)}
                                placeholder="Title"
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/25 transition-all"
                              />
                              <textarea rows={2} value={editingAnnouncement.message}
                                onChange={(e) => setEditingAnnouncement((p) => p ? { ...p, message: e.target.value } : p)}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/25 transition-all resize-none"
                              />
                              <input type="url" value={editingAnnouncement.link ?? ""}
                                onChange={(e) => setEditingAnnouncement((p) => p ? { ...p, link: e.target.value } : p)}
                                placeholder="Link URL"
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/25 transition-all"
                              />
                              <div className="flex gap-2">
                                <button onClick={saveEditAnnouncement} disabled={announcementSaving}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                  {announcementSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save
                                </button>
                                <button onClick={() => setEditingAnnouncement(null)}
                                  className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/8 transition-all"
                                >Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <AnnouncementPreview a={a} />
                              <div className="flex items-center gap-2 mt-3">
                                <span className="text-[10px] text-white/25">{new Date(a.created_at).toLocaleString()}</span>
                                <div className="flex-1" />
                                <button onClick={() => toggleAnnouncement(a.id, !a.is_active)} title={a.is_active ? "Deactivate" : "Activate"}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/8 transition-all">
                                  {a.is_active ? <EyeOff size={11} /> : <Eye size={11} />}
                                  {a.is_active ? "Hide" : "Show"}
                                </button>
                                <button onClick={() => setEditingAnnouncement(a)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                                  <Edit2 size={11} /> Edit
                                </button>
                                <button onClick={() => deleteAnnouncement(a.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                  <Trash2 size={11} /> Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Settings ──────────────────────────────────────────────── */}
            {activeTab === "settings" && (
              <div className="space-y-6 max-w-2xl">
                <div className="flex items-start justify-between">
                  <SectionHeader title="System Settings" sub="Configure platform-wide behaviour" />
                  <button onClick={saveSettings} disabled={settingsSaving || !settingsDirty}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {settingsSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    {settingsSaving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
                {loading && !settings ? <Spinner /> : settings ? (
                  <div className="space-y-4">
                    {/* Toggles */}
                    <SettingsCard title="Platform Controls">
                      <SettingsToggle label="Maintenance Mode" sub="Block all user access while you deploy" value={settings.maintenance_mode === "true"} onChange={(v) => { const val = String(v); setSettings((s) => s ? { ...s, maintenance_mode: val } : s); setSettingsDirty(true); quickSaveSetting("maintenance_mode", val); }} />
                      <SettingsToggle label="Allow New Signups" sub="Let new users create accounts" value={settings.allow_signups === "true"} onChange={(v) => { const val = String(v); setSettings((s) => s ? { ...s, allow_signups: val } : s); setSettingsDirty(true); quickSaveSetting("allow_signups", val); }} />
                      <SettingsToggle label="PAYG Enabled" sub="Allow pay-per-use purchases (all tools)" value={settings.payg_enabled === "true"} onChange={(v) => { const val = String(v); setSettings((s) => s ? { ...s, payg_enabled: val } : s); setSettingsDirty(true); quickSaveSetting("payg_enabled", val); }} />
                    </SettingsCard>

                    {/* Starter limits */}
                    <SettingsCard title="Starter Plan Monthly Limits">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: "starter_paper" as const,      label: "Papers" },
                          { key: "starter_revision" as const,   label: "Revisions" },
                          { key: "starter_humanizer" as const,  label: "Humanizer" },
                          { key: "starter_stem" as const,       label: "STEM Solves" },
                          { key: "starter_study" as const,      label: "Study Sessions" },
                          { key: "starter_plagiarism" as const, label: "Plagiarism" },
                          { key: "starter_outline" as const,    label: "Outlines" },
                        ].map(({ key, label }) => (
                          <div key={key}>
                            <label className="block text-xs text-white/40 mb-1.5">{label} / month</label>
                            <input type="number" min="0" value={settings[key]}
                              onChange={(e) => { setSettings((s) => s ? { ...s, [key]: e.target.value } : s); setSettingsDirty(true); }}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 transition-all"
                            />
                          </div>
                        ))}
                      </div>
                    </SettingsCard>
                  </div>
                ) : <Empty text="Settings unavailable" />}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── Credit Adjust Modal ──────────────────────────────────────────── */}
      {creditAdjustUser && (
        <Modal title="Adjust Credits" onClose={() => setCreditAdjustUser(null)}>
          <p className="text-xs text-white/40 mb-4 font-mono truncate">{creditAdjustUser.email ?? creditAdjustUser.id}</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Amount (credits) — use negative to deduct</label>
              <div className="flex gap-2">
                <button onClick={() => setCreditAdjustAmt((v) => String(-(Math.abs(Number(v) || 0))))} className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold"><Minus size={12} /></button>
                <input type="number" value={creditAdjustAmt} onChange={(e) => setCreditAdjustAmt(e.target.value)} placeholder="e.g. 500"
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 transition-all" />
                <button onClick={() => setCreditAdjustAmt((v) => String(Math.abs(Number(v) || 0)))} className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold"><Plus size={12} /></button>
              </div>
              <p className="text-[10px] text-white/25 mt-1">Current balance: {creditAdjustUser.creditBalance.toLocaleString()} credits</p>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Reason / note</label>
              <input type="text" value={creditAdjustNote} onChange={(e) => setCreditAdjustNote(e.target.value)} placeholder="e.g. Goodwill bonus"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/25 transition-all" />
            </div>
            <button onClick={submitCreditAdjust} disabled={creditAdjusting || !creditAdjustAmt}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {creditAdjusting ? <Loader2 size={13} className="animate-spin" /> : <Coins size={13} />}
              Apply Adjustment
            </button>
          </div>
        </Modal>
      )}

      {/* ── Plan Edit Modal ──────────────────────────────────────────────── */}
      {planEditUser && (
        <Modal title="Edit Plan" onClose={() => setPlanEditUser(null)}>
          <p className="text-xs text-white/40 mb-4 font-mono truncate">{planEditUser.email ?? planEditUser.id}</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Plan</label>
              <select value={planEditValue} onChange={(e) => setPlanEditValue(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 transition-all">
                <option value="starter">Starter (free)</option>
                <option value="pro">Pro</option>
                <option value="campus">Campus</option>
              </select>
            </div>
            <div className="bg-amber-500/8 border border-amber-500/15 rounded-xl px-3 py-2.5 text-xs text-amber-400/80">
              ⚠️ This manually overrides the user's subscription. Make sure their payment has been verified before granting paid plans.
            </div>
            <button onClick={submitPlanEdit} disabled={planEditing}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {planEditing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Update Plan
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function AnnouncementPreview({ a }: { a: { title: string | null; message: string; link: string | null; link_text: string; color: string } }) {
  const colorMap: Record<string, string> = {
    blue:    "bg-blue-500/10 border-blue-500/20 text-blue-200",
    amber:   "bg-amber-500/10 border-amber-500/20 text-amber-200",
    red:     "bg-red-500/10 border-red-500/20 text-red-200",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
    violet:  "bg-violet-500/10 border-violet-500/20 text-violet-200",
  };
  const cls = colorMap[a.color] ?? colorMap.blue;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 border rounded-xl text-sm ${cls}`}>
      <Megaphone size={14} className="shrink-0" />
      <span className="flex-1 min-w-0">
        {a.title && <span className="font-semibold mr-2">{a.title}</span>}
        {a.message}
      </span>
      {a.link && (
        <a href={a.link} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 shrink-0 underline underline-offset-2 hover:opacity-80 transition-opacity text-xs font-semibold">
          {a.link_text} <Link2 size={10} />
        </a>
      )}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-0.5">{title}</h2>
      <p className="text-white/35 text-sm">{sub}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24 text-white/30 gap-2.5">
      <Loader2 size={18} className="animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-16 text-center text-white/25 text-sm">{text}</div>;
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
      <AlertCircle size={13} />{text}
    </div>
  );
}

function Badge({ color, children }: { color: "green" | "amber" | "red" | "blue"; children: React.ReactNode }) {
  const cls = {
    green: "bg-green-500/12 text-green-400 border-green-500/20",
    amber: "bg-amber-500/12 text-amber-400 border-amber-500/20",
    red:   "bg-red-500/12 text-red-400 border-red-500/20",
    blue:  "bg-blue-500/12 text-blue-400 border-blue-500/20",
  }[color];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 border rounded-full ${cls}`}>{children}</span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const styles: Record<string, string> = {
    GET:    "bg-blue-500/15 text-blue-300 border-blue-500/20",
    POST:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    PATCH:  "bg-amber-500/15 text-amber-300 border-amber-500/20",
    PUT:    "bg-violet-500/15 text-violet-300 border-violet-500/20",
    DELETE: "bg-red-500/15 text-red-300 border-red-500/20",
  };
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 border rounded font-mono ${styles[method] ?? "bg-white/10 text-white/50 border-white/15"}`}>
      {method}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0a0f1a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <p className="text-sm font-semibold text-white">{title}</p>
          <button onClick={onClose} className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/8 transition-all"><X size={15} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.025] border border-white/8 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/6">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">{title}</p>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function SettingsToggle({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-white/80">{label}</p>
        <p className="text-[11px] text-white/30 mt-0.5">{sub}</p>
      </div>
      <button onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${value ? "bg-primary" : "bg-white/15"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function OverviewCard({ icon, label, value, color, border, iconColor, format }: {
  icon: React.ReactNode; label: string; value: number;
  color: string; border: string; iconColor: string; format?: "money";
}) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${color} border ${border} rounded-xl p-5`}>
      <div className={`mb-3 ${iconColor}`}>{icon}</div>
      <div className="text-2xl font-bold text-white tabular-nums">
        {format === "money" ? `$${(value / 100).toFixed(2)}` : value.toLocaleString()}
      </div>
      <div className="text-xs text-white/45 mt-1 font-medium">{label}</div>
    </div>
  );
}

function MiniCard({ icon, label, value, format }: { icon: React.ReactNode; label: string; value: number; format?: "money" }) {
  return (
    <div className="bg-white/[0.025] border border-white/8 rounded-xl px-4 py-3.5 flex items-center gap-3">
      {icon}
      <div>
        <div className="text-lg font-bold text-white tabular-nums">
          {format === "money" ? `$${(value / 100).toFixed(2)}` : value}
        </div>
        <div className="text-[11px] text-white/30">{label}</div>
      </div>
    </div>
  );
}

function typeGradient(type: string) {
  const map: Record<string, string> = { paper: "bg-blue-500/15", revision: "bg-indigo-500/15", stem: "bg-violet-500/15", study: "bg-cyan-500/15" };
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
