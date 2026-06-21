import React, { useState, useEffect, useCallback } from "react";
import MarkdownIt from "markdown-it";

const API = "/api";

// Markdown → HTML for the manual page author. `html:false` keeps writers from
// pasting raw markup; linkify turns bare URLs into links. The rendered HTML is
// injected into the SEO page <main>, which is styled by /seo-page.css.
const mdRenderer = new MarkdownIt({ html: false, linkify: true, typographer: true });

// The 15 page_type values accepted by the seo_pages CHECK constraint.
const MANUAL_PAGE_TYPES = [
  "how-to", "tool", "service", "paper-type", "subject", "software-specific",
  "method-specific", "financial-analysis", "use-case", "problem-solution",
  "comparison", "academic-level", "citation-guide", "ebook-type", "ebook-platform",
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function adminHeaders() {
  const pw = sessionStorage.getItem("admin_token") ?? "";
  const email = sessionStorage.getItem("admin_email") ?? "";
  const h: Record<string, string> = { "Content-Type": "application/json", "x-admin-password": pw };
  if (email) h["x-admin-email"] = email;
  return h;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { ...adminHeaders(), ...(opts.headers as Record<string, string> ?? {}) },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-14">
      <div className="w-7 h-7 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">{children}</h3>;
}

function Stat({ label, value, sub, color = "text-white" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs font-medium text-slate-300 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published:     "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
    review:        "bg-amber-500/15 text-amber-300 border border-amber-500/25",
    draft:         "bg-slate-600/30 text-slate-400 border border-slate-600/30",
    archived:      "bg-red-500/15 text-red-400 border border-red-500/25",
    "not-seeded":  "bg-slate-700/40 text-slate-500 border border-slate-700/40",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-slate-700 text-slate-400"}`}>
      {status}
    </span>
  );
}

function Toast({ msg, variant = "success" }: { msg: string; variant?: "success" | "error" }) {
  if (!msg) return null;
  return (
    <div className={`text-xs rounded-xl px-4 py-2.5 flex items-center gap-2 ${
      variant === "success"
        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
        : "bg-red-500/10 border border-red-500/20 text-red-400"
    }`}>
      <span>{variant === "success" ? "✓" : "✗"}</span> {msg}
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = "primary", size = "sm", className = "" }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "success" | "amber" | "purple";
  size?: "xs" | "sm";
  className?: string;
}) {
  const variantCls = {
    primary:   "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600",
    danger:    "bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-600/30",
    success:   "bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-600/30",
    amber:     "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/30",
    purple:    "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/30",
  }[variant];
  const sizeCls = size === "xs" ? "text-[10px] px-2 py-0.5" : "text-xs px-3.5 py-1.5";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${sizeCls} ${variantCls} rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

// ── Tab: Write (manual page authoring) ────────────────────────────────────────
const inputCls =
  "w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60";

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-xs font-medium text-slate-300 mb-1.5">
      {children}
      {hint && <span className="text-slate-500 font-normal"> — {hint}</span>}
    </label>
  );
}

function CheckRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${ok ? "text-emerald-300" : "text-slate-400"}`}>
      <span>{ok ? "✓" : "○"}</span> {children}
    </div>
  );
}

function WriteTab() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [metaDescription, setMetaDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [pageType, setPageType] = useState("how-to");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" }>({ msg: "", variant: "success" });
  const [lastUrl, setLastUrl] = useState("");
  const [check, setCheck] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  // Keep slug auto-derived from the title until the writer edits it themselves.
  useEffect(() => {
    if (!slugEdited) setSlug(slugify(title));
  }, [title, slugEdited]);

  const previewHtml = body.trim() ? mdRenderer.render(body) : "";
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const hasFaq = /frequently asked questions|\bfaq\b|common questions/i.test(body);
  const hasH1 = /^#\s|<h1/i.test(body);

  // Auto rule-check: whenever the body changes, run it (debounced) through the
  // same server-side validation that publish enforces, so the report can't drift.
  useEffect(() => {
    const html = body.trim() ? mdRenderer.render(body) : "";
    if (html.length < 30) { setCheck(null); setChecking(false); return; }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch("/seo/page/check", { method: "POST", body: JSON.stringify({ contentHtml: html }) });
        setCheck(r);
      } catch { /* transient — keep the last good report */ } finally {
        setChecking(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [body]);

  async function save(status: "draft" | "published") {
    if (!title.trim()) { setToast({ msg: "Add a title first", variant: "error" }); return; }
    if (wordCount < 50) { setToast({ msg: "Write some body content first", variant: "error" }); return; }
    setSaving(true);
    setToast({ msg: "", variant: "success" });
    try {
      const r = await apiFetch("/seo/page/manual", {
        method: "POST",
        body: JSON.stringify({ slug, title, metaDescription, keywords, pageType, contentHtml: previewHtml, status }),
      });
      setLastUrl(r.url ?? `/seo/${slug}`);
      setToast({
        msg: status === "published" ? `Published live at ${r.url}` : `Saved as draft (${r.wordCount} words)`,
        variant: "success",
      });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Save failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setTitle(""); setSlug(""); setSlugEdited(false); setMetaDescription("");
    setKeywords(""); setPageType("how-to"); setBody(""); setLastUrl(""); setToast({ msg: "", variant: "success" });
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>✍️ Write a page</CardTitle>
            <p className="text-xs text-slate-400 -mt-2 max-w-2xl">
              You do the keyword research; write the page here in Markdown and publish it yourself. No AI generation,
              no budget used. The page is served server-rendered at <code className="text-blue-300">/seo/&lt;slug&gt;</code>{" "}
              so Google, Bing and AI answer engines can read it.
            </p>
          </div>
          <Btn variant="secondary" onClick={resetForm}>New / clear</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Left: the form ── */}
        <div className="space-y-4">
          <Card>
            <div className="space-y-3">
              <div>
                <FieldLabel hint="aim for 50–60 characters">Title</FieldLabel>
                <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="AI Lab Report Writer for Chemistry Students" />
              </div>
              <div>
                <FieldLabel hint="the URL — auto-filled from the title, editable">Slug</FieldLabel>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 whitespace-nowrap">/seo/</span>
                  <input className={inputCls} value={slug}
                    onChange={(e) => { setSlugEdited(true); setSlug(slugify(e.target.value)); }}
                    placeholder="ai-lab-report-writer-chemistry" />
                </div>
              </div>
              <div>
                <FieldLabel hint="aim for 140–160 characters">Meta description</FieldLabel>
                <textarea className={`${inputCls} resize-none`} rows={2} value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Write clean, structured chemistry lab reports faster with AI assistance…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Page type</FieldLabel>
                  <select className={inputCls} value={pageType} onChange={(e) => setPageType(e.target.value)}>
                    {MANUAL_PAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel hint="comma-separated">Keywords</FieldLabel>
                  <input className={inputCls} value={keywords} onChange={(e) => setKeywords(e.target.value)}
                    placeholder="lab report writer, chemistry" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <FieldLabel hint="Markdown — start with “# Heading”, use ## for sections, add a FAQ section">Page body</FieldLabel>
            <textarea
              className={`${inputCls} font-mono leading-relaxed`}
              rows={18}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"# AI Lab Report Writer for Chemistry Students\n\nOpening paragraph that answers the search intent directly…\n\n## How it works\n\n1. Paste your data\n2. …\n\n## Frequently asked questions\n\n**Is this allowed by my university?**\nYes — it is a writing-support tool…"}
            />
          </Card>
        </div>

        {/* ── Right: rule check + checklist + live preview ── */}
        <div className="space-y-4">
          <Card>
            <CardTitle>
              🔎 Rule check
              <span className="text-[10px] font-normal text-slate-500 ml-1">
                {checking ? "checking…" : "automatic"}
              </span>
            </CardTitle>
            {!check ? (
              <p className="text-xs text-slate-500">
                Paste or write your blog — it’s checked automatically against the publishing rules
                (prohibited phrasing, length, data points, FAQ) as you go.
              </p>
            ) : (
              <div className="space-y-2">
                <div className={`text-xs font-semibold ${check.passed ? "text-emerald-300" : "text-amber-300"}`}>
                  {check.passed ? "✓ Passes all publishing rules" : "⚠ Review before publishing"}
                </div>
                <CheckRow ok={check.integrityPassed}>No prohibited / academic-integrity phrasing</CheckRow>
                <CheckRow ok={check.wordCount >= 800}>Word count {check.wordCount} (≥ 800)</CheckRow>
                <CheckRow ok={check.uniqueDataPoints >= 8}>Data points {check.uniqueDataPoints} (≥ 8)</CheckRow>
                <CheckRow ok={check.hasFAQ}>Has a FAQ section</CheckRow>

                {check.violations?.length > 0 && (
                  <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                    <div className="font-semibold mb-1">Prohibited content detected:</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {check.violations.map((vv: string, i: number) => <li key={i}>{vv}</li>)}
                    </ul>
                  </div>
                )}
                {check.willRewrite && (
                  <div className="text-[11px] text-amber-300/90">
                    ⓘ On publish, flagged phrases are auto-rewritten to compliant wording.
                  </div>
                )}
                {check.issues?.length > 0 && (
                  <ul className="text-[11px] text-slate-400 list-disc pl-4 space-y-0.5 pt-1">
                    {check.issues.map((it: string, i: number) => <li key={i}>{it}</li>)}
                  </ul>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>SEO checklist</CardTitle>
            <div className="space-y-2">
              <CheckRow ok={title.length >= 30 && title.length <= 65}>Title length ({title.length} chars)</CheckRow>
              <CheckRow ok={metaDescription.length >= 120 && metaDescription.length <= 165}>Meta description ({metaDescription.length} chars)</CheckRow>
              <CheckRow ok={hasH1}>Body starts with an H1 (<code className="text-slate-500"># …</code>)</CheckRow>
              <CheckRow ok={wordCount >= 800}>Word count ({wordCount}) — aim for 800+</CheckRow>
              <CheckRow ok={hasFaq}>Has a FAQ section</CheckRow>
              <CheckRow ok={keywords.trim().length > 0}>Keywords added</CheckRow>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Btn variant="secondary" onClick={() => save("draft")} disabled={saving}>
                {saving ? "Saving…" : "Save as draft"}
              </Btn>
              <Btn variant="success" onClick={() => save("published")} disabled={saving}>
                {saving ? "Saving…" : "Publish now"}
              </Btn>
              {lastUrl && (
                <a href={lastUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 ml-auto">↗ View page</a>
              )}
            </div>
            <div className="mt-3"><Toast msg={toast.msg} variant={toast.variant} /></div>
          </Card>

          <Card>
            <CardTitle>Live preview</CardTitle>
            {previewHtml ? (
              <div className="bg-white text-slate-900 rounded-lg p-5 max-h-[460px] overflow-auto prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className="text-xs text-slate-500">Start typing in the body field to see the rendered page here.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Dashboard ────────────────────────────────────────────────────────────
function DashboardTab() {
  const [data, setData] = useState<any>(null);
  const [budget, setBudget] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/seo/dashboard/summary"),
      apiFetch("/seo/budget/status"),
    ]).then(([sum, bud]) => { setData(sum); setBudget(bud); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const pages = data?.pages ?? {};
  const pct = Math.round(budget?.percentUsed ?? 0);
  const budgetColor = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-5">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Published" value={pages.published ?? 0} color="text-emerald-400" sub="Live pages" />
        <Stat label="In Review" value={pages.review ?? 0} color="text-amber-400" sub="Needs approval" />
        <Stat label="Draft" value={pages.draft ?? 0} color="text-slate-400" sub="Not published" />
        <Stat label="Total" value={pages.total ?? 0} color="text-blue-400" sub="In database" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Budget card */}
        <Card>
          <CardTitle>Monthly LLM Budget — {budget?.month}</CardTitle>
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>${(budget?.totalSpend ?? 0).toFixed(4)} spent</span>
            <span className="font-medium text-white">{pct}%</span>
            <span>${budget?.budgetLimit ?? 8} limit</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${budgetColor}`}
              style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <div className="text-center">
              <div className="text-slate-300 font-medium">${(budget?.geminiSpend ?? 0).toFixed(4)}</div>
              <div className="text-slate-500">Gemini 2.5 Flash spend</div>
            </div>
            <div className="text-center">
              <div className="text-slate-300 font-medium">{budget?.pagesGenerated ?? 0}</div>
              <div className="text-slate-500">Pages generated</div>
            </div>
          </div>
          <p className="text-[10px] text-purple-400 mt-3 bg-purple-500/10 rounded-lg px-3 py-1.5">
            Gemini 2.5 Flash · $0.075/M input · $0.30/M output · free tier: 50 req/24hr
          </p>
        </Card>

        {/* Quick actions + quality issues */}
        <Card>
          <CardTitle>Quick Actions</CardTitle>
          <div className="space-y-2 mb-4">
            {[
              { href: "/seo/ai-paper-writer", label: "↗ Preview: AI Paper Writer" },
              { href: "/sitemap.xml", label: "↗ View sitemap.xml" },
              { href: "/robots.txt", label: "↗ View robots.txt" },
            ].map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
                className="block text-xs text-blue-400 hover:text-blue-300 transition-colors py-0.5">
                {l.label}
              </a>
            ))}
          </div>
          {(pages.missing_disclosure > 0 || pages.integrity_issues > 0) && (
            <div className="border-t border-slate-700/50 pt-3 space-y-1.5">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Quality Issues</div>
              {pages.missing_disclosure > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Missing AI disclosure</span>
                  <span className="text-amber-400 font-semibold">{pages.missing_disclosure}</span>
                </div>
              )}
              {pages.integrity_issues > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Integrity failures</span>
                  <span className="text-red-400 font-semibold">{pages.integrity_issues}</span>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* SemRush known issues tracker */}
      <Card>
        <CardTitle>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold">S</span>
          SemRush Issues — Resolved Status
        </CardTitle>
        <div className="space-y-2">
          {[
            { issue: "Title tag too long (was 78 chars)", fix: "Shortened to 52 chars: 'Light Speed Ghost — AI Academic Writing for Students'", status: "fixed" },
            { issue: "Missing H1 heading (SPA doesn't render H1 for crawlers)", fix: "Added hidden sr-only H1 to index.html body", status: "fixed" },
            { issue: "Invalid structured data — Institution Offer price ambiguous", fix: "Removed price field; set availability to PreOrder", status: "fixed" },
            { issue: "Invalid structured data — SearchAction query-input format", fix: "Updated target to use EntryPoint @type with urlTemplate", status: "fixed" },
          ].map((item) => (
            <div key={item.issue} className="flex items-start gap-3 py-2.5 border-b border-slate-700/40 last:border-0">
              <span className={`mt-0.5 shrink-0 text-base ${item.status === "fixed" ? "text-emerald-400" : "text-amber-400"}`}>
                {item.status === "fixed" ? "✓" : "○"}
              </span>
              <div className="min-w-0">
                <div className="text-xs text-slate-300 font-medium">{item.issue}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{item.fix}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Tab: Catalog ──────────────────────────────────────────────────────────────
const BATCH_PAGE_TYPES = [
  "tool","service","paper-type","subject","software-specific","method-specific",
  "financial-analysis","use-case","problem-solution","comparison",
  "academic-level","citation-guide","ebook-type","ebook-platform","how-to",
];

function CatalogTab() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [batchType, setBatchType] = useState("tool");
  const [batchLimit, setBatchLimit] = useState(10);
  const [filter, setFilter] = useState("all");
  const [msg, setMsg] = useState("");
  const [msgVariant, setMsgVariant] = useState<"success" | "error">("success");

  const load = useCallback(async () => {
    setLoading(true);
    const d = await apiFetch("/seo/catalog");
    setCatalog(d.catalog ?? []);
    setStats({ total: d.totalInCatalog, inDb: d.totalInDb });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const seed = async () => {
    setSeeding(true);
    try {
      const res = await apiFetch("/seo/catalog/seed", { method: "POST" });
      setMsg(`Seeded ${res.seeded} new pages, ${res.existing} already existed`);
      setMsgVariant("success");
      await load();
    } finally { setSeeding(false); }
  };

  const generateBatch = async () => {
    setGenerating(true);
    setMsg("");
    try {
      const r = await apiFetch("/seo/generate-batch", {
        method: "POST",
        body: JSON.stringify({ type: batchType, limit: batchLimit, autoPublish: false }),
      });
      setMsg(r.message ?? "Batch started — pages appear in Pages/Review as they finish.");
      setMsgVariant("success");
      // Generation runs in the background; refresh the catalog as pages land.
      setTimeout(() => { load(); }, 8000);
    } catch (e: any) {
      setMsg(`Generation error: ${e.message}`);
      setMsgVariant("error");
    } finally {
      setGenerating(false);
    }
  };

  const filtered = filter === "all" ? catalog : catalog.filter((c) => c.status === filter || (!c.inDb && filter === "not-seeded"));
  const pendingCount = catalog.filter((c) => c.status === "not-seeded" || c.status === "draft").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          <span className="bg-slate-700/60 border border-slate-600/40 text-slate-300 text-xs px-3 py-1 rounded-lg">
            {stats.total ?? 0} in catalog
          </span>
          <span className="bg-slate-700/60 border border-slate-600/40 text-slate-300 text-xs px-3 py-1 rounded-lg">
            {stats.inDb ?? 0} in DB
          </span>
          {pendingCount > 0 && (
            <span className="bg-amber-500/15 border border-amber-500/25 text-amber-300 text-xs px-3 py-1 rounded-lg">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="bg-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 border border-slate-600/60 focus:outline-none focus:border-blue-500/60">
            <option value="all">All pages</option>
            <option value="not-seeded">Not seeded</option>
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="published">Published</option>
          </select>
          <Btn onClick={seed} disabled={seeding} variant="secondary">{seeding ? "Seeding…" : "Seed Catalog"}</Btn>
        </div>
      </div>

      {/* Catalog page generator */}
      <Card>
        <CardTitle>Generate Catalog Pages</CardTitle>
        <p className="text-[11px] text-slate-500 mb-3">
          Generate content for unseeded/draft catalog pages using Gemini 2.5 Flash. For AI-driven article clusters, use the Pipeline tab.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Page type</label>
            <select value={batchType} onChange={(e) => setBatchType(e.target.value)}
              className="bg-slate-900/60 text-xs text-slate-200 rounded-lg px-3 py-2 border border-slate-600/60 focus:outline-none focus:border-blue-500/60 w-44">
              <option value="all">All types</option>
              {BATCH_PAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Limit</label>
            <input type="number" value={batchLimit} onChange={(e) => setBatchLimit(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
              min={1} max={30}
              className="w-20 bg-slate-900/60 text-white text-xs rounded-lg px-3 py-2 border border-slate-600/60 focus:outline-none" />
          </div>
          <Btn onClick={generateBatch} disabled={generating} variant="primary">
            {generating ? "Generating…" : `Generate up to ${batchLimit} pages`}
          </Btn>
        </div>
        {generating && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
            Generating with Gemini 2.5 Flash — allow 30–90s per page
          </div>
        )}
      </Card>

      {msg && <Toast msg={msg} variant={msgVariant} />}
      {loading ? <Spinner /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-700/40">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800/80 border-b border-slate-700/60">
                {["Slug", "Type", "Priority", "Status", "In DB"].map((h) => (
                  <th key={h} className="text-left py-2.5 px-3 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.slug} className={`border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${i % 2 === 0 ? "" : "bg-slate-900/20"}`}>
                  <td className="py-2 px-3 text-blue-400 font-mono text-[10px]">{c.slug}</td>
                  <td className="py-2 px-3 text-slate-300">{c.type}</td>
                  <td className="py-2 px-3 text-slate-400">{c.priority}</td>
                  <td className="py-2 px-3"><StatusBadge status={c.status} /></td>
                  <td className="py-2 px-3 text-emerald-400">{c.inDb ? "✓" : <span className="text-slate-600">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-slate-500 py-10 text-sm">No pages match this filter</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Pages ────────────────────────────────────────────────────────────────
function PagesTab() {
  const [pages, setPages] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  const [actionMsg, setActionMsg] = useState("");
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search) params.set("search", search);
    const d = await apiFetch(`/seo/pages?${params}`);
    setPages(d.pages ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [offset, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const togglePublish = async (slug: string, published: boolean) => {
    await apiFetch(`/seo/page/${slug}/${published ? "unpublish" : "publish"}`, { method: "POST" });
    setActionMsg(`${published ? "Unpublished" : "Published"}: ${slug}`);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          placeholder="Search pages…"
          className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 border border-slate-600/60 w-48 focus:outline-none focus:border-blue-500/60 placeholder:text-slate-500" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          className="bg-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 border border-slate-600/60 focus:outline-none focus:border-blue-500/60">
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="review">Review</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <span className="text-xs text-slate-400 ml-auto">{total} pages total</span>
      </div>
      {actionMsg && <Toast msg={actionMsg} />}
      {loading ? <Spinner /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-700/40">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700/60">
                  {["Slug", "Type", "Words", "Model", "Status", "Checks", "Action"].map((h) => (
                    <th key={h} className="text-left py-2.5 px-3 text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pages.map((p, i) => (
                  <tr key={p.slug} className={`border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${i % 2 === 0 ? "" : "bg-slate-900/20"}`}>
                    <td className="py-2 px-3">
                      <a href={`/seo/${p.slug}`} target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-mono text-[10px] transition-colors">{p.slug}</a>
                    </td>
                    <td className="py-2 px-3 text-slate-400">{p.page_type}</td>
                    <td className="py-2 px-3 text-slate-300">{p.word_count ?? <span className="text-slate-600">—</span>}</td>
                    <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">{p.llm_used ? p.llm_used.split("-")[0] : "—"}</td>
                    <td className="py-2 px-3"><StatusBadge status={p.status} /></td>
                    <td className="py-2 px-3">
                      <div className="flex gap-1">
                        <span title="AI Disclosure" className={`text-[9px] px-1 py-0.5 rounded ${p.has_ai_disclosure ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>AI</span>
                        <span title="Integrity" className={`text-[9px] px-1 py-0.5 rounded ${p.integrity_check ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>INT</span>
                        <span title="FAQ Schema" className={`text-[9px] px-1 py-0.5 rounded ${p.has_faq_schema ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/60 text-slate-500"}`}>FAQ</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <Btn onClick={() => togglePublish(p.slug, p.published)}
                        variant={p.published ? "danger" : "success"} size="xs">
                        {p.published ? "Unpublish" : "Publish"}
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages.length === 0 && <p className="text-center text-slate-500 py-10 text-sm">No pages found</p>}
          </div>
          <div className="flex items-center gap-3 justify-center">
            <Btn onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} variant="secondary">← Prev</Btn>
            <span className="text-xs text-slate-400">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
            <Btn onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} variant="secondary">Next →</Btn>
          </div>
        </>
      )}
    </div>
  );
}


// ── Tab: Budget ───────────────────────────────────────────────────────────────
function BudgetTab() {
  const [budget, setBudget] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch("/seo/budget/status"),
      apiFetch("/seo/budget/log"),
    ]).then(([b, l]) => { setBudget(b); setLog(l.log ?? []); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Gemini Spend" value={`$${(budget?.geminiSpend ?? 0).toFixed(4)}`} sub="Gemini 2.5 Flash" color="text-blue-400" />
        <Stat label="Claude Spend" value={`$${(budget?.claudeSpend ?? 0).toFixed(4)}`} sub="Claude Haiku 4.5" color="text-violet-400" />
        <Stat label="Total Spend" value={`$${(budget?.totalSpend ?? 0).toFixed(4)}`} sub="This month" color="text-white" />
        <Stat label="Remaining" value={`$${(budget?.remainingBudget ?? 0).toFixed(2)}`} sub="Budget left" color="text-emerald-400" />
      </div>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <CardTitle>Budget — {budget?.month}</CardTitle>
          {!budget?.upgraded && (
            <Btn onClick={async () => {
              setUpgrading(true);
              await apiFetch("/seo/budget/upgrade", { method: "POST" });
              setBudget(await apiFetch("/seo/budget/status"));
              setUpgrading(false);
            }} disabled={upgrading} variant="amber">
              {upgrading ? "Upgrading…" : "Upgrade to Full Claude"}
            </Btn>
          )}
        </div>
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>${(budget?.totalSpend ?? 0).toFixed(4)} of ${budget?.budgetLimit ?? 8} used</span>
          <span className="font-medium text-white">{Math.round(budget?.percentUsed ?? 0)}%</span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${(budget?.percentUsed ?? 0) > 80 ? "bg-red-500" : "bg-blue-500"}`}
            style={{ width: `${Math.min(budget?.percentUsed ?? 0, 100)}%` }} />
        </div>
        <p className="text-[10px] text-slate-500 mt-2">{budget?.pagesGenerated ?? 0} pages generated this month</p>
        {budget?.upgraded && (
          <p className="text-xs text-emerald-400 mt-2 bg-emerald-500/10 rounded-lg px-3 py-1.5">
            ✓ Budget upgraded — Claude unlocked for all pages this month
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Recent LLM Cost Log</CardTitle>
        <div className="overflow-x-auto rounded-lg border border-slate-700/40">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-700/60">
                {["Task", "Model", "In", "Out", "Cost", "Time"].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-slate-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.slice(0, 25).map((l) => (
                <tr key={l.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                  <td className="py-1.5 px-3 text-slate-300">{l.task_type}</td>
                  <td className="py-1.5 px-3 text-slate-500 font-mono text-[10px]">{l.model_used}</td>
                  <td className="py-1.5 px-3 text-right text-slate-400">{l.input_tokens?.toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-right text-slate-400">{l.output_tokens?.toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-right text-emerald-400 font-mono">${parseFloat(l.cost_usd).toFixed(6)}</td>
                  <td className="py-1.5 px-3 text-slate-500">{new Date(l.logged_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {log.length === 0 && <p className="text-center text-slate-500 py-8 text-sm">No cost log entries yet</p>}
        </div>
      </Card>
    </div>
  );
}

// ── Tab: Integrity ────────────────────────────────────────────────────────────
function IntegrityTab() {
  const [audit, setAudit] = useState<any>(null);
  const [compliance, setCompliance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [a, c] = await Promise.all([
      apiFetch("/seo/audit/integrity"),
      apiFetch("/seo/dashboard/compliance"),
    ]);
    setAudit(a); setCompliance(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const fix = async (slug: string) => {
    setFixing(slug);
    await apiFetch(`/seo/audit/integrity/fix/${slug}`, { method: "POST" });
    await load();
    setFixing(null);
  };

  if (loading) return <Spinner />;

  const complianceStats = [
    { label: "AI Disclosure", value: compliance?.has_disclosure ?? 0, total: compliance?.generated ?? 0, color: "text-blue-400" },
    { label: "Integrity OK", value: compliance?.integrity_ok ?? 0, total: compliance?.generated ?? 0, color: "text-emerald-400" },
    { label: "Has FAQ Schema", value: compliance?.has_faq ?? 0, total: compliance?.generated ?? 0, color: "text-violet-400" },
    { label: "800+ Words", value: compliance?.meets_word_count ?? 0, total: compliance?.generated ?? 0, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {complianceStats.map((m) => (
          <div key={m.label} className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${m.color}`}>
              {m.value}<span className="text-slate-600 text-sm font-normal">/{m.total}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardTitle>Academic Integrity Issues ({audit?.issueCount ?? 0} pages)</CardTitle>
        {audit?.issues?.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 rounded-xl px-4 py-3">
            <span>✓</span> All pages pass academic integrity checks
          </div>
        ) : (
          <div className="space-y-2.5">
            {audit?.issues?.map((issue: any) => (
              <div key={issue.slug} className="border border-red-500/20 bg-red-900/10 rounded-xl p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <span className="text-xs text-red-300 font-mono">{issue.slug}</span>
                    <ul className="mt-1.5 space-y-0.5">
                      {issue.violations.slice(0, 3).map((v: string, i: number) => (
                        <li key={i} className="text-[10px] text-slate-400">• {v}</li>
                      ))}
                    </ul>
                  </div>
                  <Btn onClick={() => fix(issue.slug)} disabled={fixing === issue.slug} variant="danger" size="xs">
                    {fixing === issue.slug ? "Fixing…" : "Auto-Fix"}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Compliance Coverage</CardTitle>
        <div className="space-y-0">
          {[
            { label: "EU AI Act — Content Disclosure", desc: "ai-generated meta tag + visible disclosure label on all generated pages" },
            { label: "WCAG 2.2 Level AA", desc: "Skip links, focus rings, table captions, ARIA labels, 24px touch targets" },
            { label: "Academic Integrity", desc: "No bypass/cheat/undetectable language. AI writing assistance framing only." },
            { label: "Robots.txt Crawler Policy", desc: "Training crawlers blocked, search crawlers allowed, Perplexity allowed" },
          ].map((c) => (
            <div key={c.label} className="flex items-start gap-3 py-3 border-b border-slate-700/40 last:border-0">
              <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
              <div>
                <div className="text-xs font-medium text-slate-200">{c.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Tab: Sitemap ──────────────────────────────────────────────────────────────
function SitemapTab() {
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<any>(null);
  const [robots, setRobots] = useState("");
  const [robotsLoading, setRobotsLoading] = useState(true);

  useEffect(() => {
    apiFetch("/seo/robots/preview").then((d) => { setRobots(d.robots ?? ""); }).finally(() => setRobotsLoading(false));
  }, []);

  const ping = async () => {
    setPinging(true);
    try { setPingResult(await apiFetch("/seo/sitemap/ping", { method: "POST" })); }
    catch { setPingResult({ ok: false, error: "Ping failed" }); }
    setPinging(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Sitemap</CardTitle>
          <div className="space-y-2 text-xs mb-4">
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer"
              className="block text-blue-400 hover:text-blue-300 transition-colors">↗ View sitemap.xml</a>
            <p className="text-slate-500">Dynamic — auto-includes all published SEO pages on every request</p>
          </div>
          <Btn onClick={ping} disabled={pinging}>{pinging ? "Pinging…" : "Ping Google & Bing"}</Btn>
          {pingResult && (
            <div className={`mt-3 text-xs rounded-lg p-3 ${pingResult.ok ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20" : "text-red-400 bg-red-400/10 border border-red-400/20"}`}>
              {pingResult.ok ? `✓ Pinged: ${pingResult.pinged?.join(", ")}` : pingResult.error}
            </div>
          )}
        </Card>
        <Card>
          <CardTitle>Robots.txt</CardTitle>
          <a href="/robots.txt" target="_blank" rel="noopener noreferrer"
            className="block text-xs text-blue-400 hover:text-blue-300 mb-3 transition-colors">↗ View live robots.txt</a>
          <div className="space-y-1.5 text-[10px] text-slate-500">
            <p><span className="text-red-400">Blocked:</span> GPTBot, CCBot, anthropic-ai, ClaudeBot, Bytespider</p>
            <p><span className="text-emerald-400">Allowed:</span> Googlebot, Bingbot, Perplexity, OAI-SearchBot</p>
          </div>
        </Card>
      </div>
      <Card>
        <CardTitle>Robots.txt Preview</CardTitle>
        {robotsLoading ? <Spinner /> : (
          <pre className="text-[10px] text-slate-300 bg-slate-900/80 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap max-h-72 overflow-y-auto font-mono leading-relaxed">
            {robots}
          </pre>
        )}
      </Card>
    </div>
  );
}

// ── Tab: Settings ─────────────────────────────────────────────────────────────
function SettingsTab() {
  const [scheduler, setScheduler] = useState<{ enabled: boolean; time: string; nextRunAt: string | null; geminiKeySet?: boolean; cronTokenSet?: boolean; gscConfigured?: boolean; ga4Configured?: boolean; redditConfigured?: boolean; lastRuns: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastErr, setToastErr] = useState("");

  useEffect(() => {
    apiFetch("/seo/scheduler/status")
      .then(setScheduler)
      .catch(() => setScheduler(null))
      .finally(() => setLoading(false));
  }, []);

  const save = async (patch: { enabled?: boolean; time?: string }) => {
    setSaving(true);
    if (scheduler) setScheduler({ ...scheduler, ...patch });
    try {
      await apiFetch("/seo/scheduler/settings", { method: "PATCH", body: JSON.stringify(patch) });
      const updated = await apiFetch("/seo/scheduler/status");
      setScheduler(updated);
      setToast("Settings saved");
      setTimeout(() => setToast(""), 3000);
    } catch {
      setToastErr("Failed to save settings");
      setTimeout(() => setToastErr(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  const triggerNow = async () => {
    try {
      await apiFetch("/seo/scheduler/trigger", { method: "POST", body: "{}" });
      setToast("Pipeline triggered — check Review tab in ~3 minutes");
      setTimeout(() => setToast(""), 5000);
    } catch {
      setToastErr("Trigger failed");
      setTimeout(() => setToastErr(""), 3000);
    }
  };

  const staticConfig = [
    { label: "Generation LLM", value: "Gemini 2.5 Flash", note: "research, topic, outline, content, clusters · free tier · override via SEO_GEMINI_MODEL" },
    { label: "Monthly budget", value: "$25.00", note: "Gemini-only spend cap · override via SEO_BUDGET_LIMIT" },
    { label: "Topic data", value: "GSC + GA4 + catalog", note: "Search Console quick-wins & GA4 revenue if configured, else catalog gaps" },
    { label: "Community research", value: "Reddit (OAuth)", note: "needs REDDIT_CLIENT_ID/SECRET · falls back to AI knowledge" },
    { label: "Min word count", value: "800 words", note: "per page minimum · override via SEO_MIN_WORD_COUNT" },
    { label: "Daily page limit", value: "30 pages", note: "per batch run · override via SEO_DAILY_PAGE_LIMIT" },
    { label: "Robots.txt", value: "Dynamic", note: "served by Express · training crawlers blocked" },
    { label: "Sitemap.xml", value: "Dynamic", note: "auto-includes all published SEO pages" },
    { label: "WCAG standard", value: "2.2 Level AA", note: "skip links, focus rings, ARIA, 24px touch targets" },
    { label: "Academic integrity", value: "Enforced", note: "no bypass/cheat/undetectable · AI writing assistance framing only" },
    { label: "EU AI Act", value: "Compliant", note: "ai-generated meta tag + visible disclosure on all pages" },
    { label: "Page catalog", value: "130+ slugs", note: "across 15 page types · seed from Catalog tab" },
  ];

  const envVars = [
    { name: "GEMINI_API_KEY", desc: "Google AI Studio key — required; powers all research, topic selection & generation" },
    { name: "SEO_GEMINI_MODEL", desc: "Optional model override (default gemini-2.5-flash; use gemini-2.5-pro with billing)" },
    { name: "GOOGLE_SERVICE_ACCOUNT_JSON", desc: "GCP service-account JSON — enables Search Console + GA4 data-driven topics" },
    { name: "GSC_SITE_URL", desc: "Exact Search Console property URL, e.g. https://lightspeedghost.com/" },
    { name: "GA4_PROPERTY_ID", desc: "Numeric GA4 property ID — weights topics by tool-page revenue" },
    { name: "REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET", desc: "Reddit app creds — real community research signal (else AI-knowledge fallback)" },
    { name: "SEO_CRON_TOKEN", desc: "Secret guarding the external daily cron at /api/seo/cron/run" },
    { name: "SEO_BUDGET_LIMIT", desc: "Monthly USD budget cap (default: 25.00)" },
    { name: "SEO_DAILY_PAGE_LIMIT", desc: "Max catalog pages per batch run (default: 30)" },
  ];

  return (
    <div className="space-y-5">
      {/* Saveable scheduler settings */}
      <Card>
        <CardTitle>Scheduler Settings</CardTitle>
        {toast && <div className="mb-3"><Toast msg={toast} variant="success" /></div>}
        {toastErr && <div className="mb-3"><Toast msg={toastErr} variant="error" /></div>}

        {loading ? <Spinner /> : scheduler === null ? (
          <p className="text-xs text-slate-500">Scheduler unavailable — configure GEMINI_API_KEY to enable</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2.5 border-b border-slate-700/40">
              <div>
                <p className="text-xs text-slate-200 font-medium">Daily Auto-Scheduler</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {scheduler.enabled
                    ? `Runs daily at ${scheduler.time} UTC · next run: ${scheduler.nextRunAt ? new Date(scheduler.nextRunAt).toLocaleString() : "unknown"}`
                    : "Disabled — enable to generate article clusters automatically every day"}
                </p>
              </div>
              <button
                onClick={() => save({ enabled: !scheduler.enabled })}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-40 ${scheduler.enabled ? "bg-emerald-500" : "bg-slate-600"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${scheduler.enabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {scheduler.enabled && (
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-xs text-slate-400 shrink-0">Run time (UTC)</label>
                <input
                  type="time"
                  defaultValue={scheduler.time}
                  onBlur={(e) => { if (e.target.value && e.target.value !== scheduler.time) save({ time: e.target.value }); }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 w-32"
                />
                <Btn onClick={triggerNow} disabled={saving} variant="secondary" size="sm">Run Now</Btn>
                <span className="text-[10px] text-slate-500">Time saves on blur</span>
              </div>
            )}

            {scheduler.lastRuns.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Recent scheduler runs</p>
                <div className="space-y-1">
                  {scheduler.lastRuns.slice(0, 3).map((run: any, i: number) => (
                    <div key={i} className={`text-[10px] px-2.5 py-1.5 rounded-lg ${run.status === "started" ? "bg-emerald-500/10 text-emerald-300" : run.status === "skipped" ? "bg-slate-700/40 text-slate-400" : "bg-red-500/10 text-red-400"}`}>
                      {new Date(run.createdAt).toLocaleString()} — {run.status}: {String(run.detail).slice(0, 80)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Automation / external cron status */}
      <Card>
        <CardTitle>⏱ Automation status (external cron)</CardTitle>
        {loading ? <Spinner /> : (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400 -mt-2">
              The reliable way to run the AI engine on the free hosting tier: point an UptimeRobot
              (or cron-job.org) monitor at the URL below. It self-throttles to once/day and keeps the
              server awake. Manual posting via the Write tab needs none of this.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3">
                <div className={`text-sm font-semibold ${scheduler?.geminiKeySet ? "text-emerald-400" : "text-red-400"}`}>
                  {scheduler?.geminiKeySet ? "✓ Detected" : "✗ Not set"}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">GEMINI_API_KEY — required to generate</div>
              </div>
              <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3">
                <div className={`text-sm font-semibold ${scheduler?.cronTokenSet ? "text-emerald-400" : "text-amber-400"}`}>
                  {scheduler?.cronTokenSet ? "✓ Detected" : "✗ Not set"}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">SEO_CRON_TOKEN — guards the cron URL</div>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">UptimeRobot URL</p>
              <code className="block text-[10px] text-blue-300 bg-slate-900/70 border border-slate-700/50 rounded-lg px-2.5 py-2 break-all">
                https://lightspeedghost-5szz.onrender.com/api/seo/cron/run?token=&lt;SEO_CRON_TOKEN&gt;
              </code>
              <p className="text-[10px] text-slate-500 mt-1">
                {scheduler?.cronTokenSet
                  ? "Replace <SEO_CRON_TOKEN> with the value you set in Render. Last automated run shown above."
                  : "Set SEO_CRON_TOKEN in Render → Environment, then use it in place of the placeholder."}
              </p>
            </div>
            {scheduler?.lastRuns?.length ? (
              <p className="text-[10px] text-slate-400">
                Last automated run: {new Date(scheduler.lastRuns[0].createdAt).toLocaleString()} — {scheduler.lastRuns[0].status}
              </p>
            ) : (
              <p className="text-[10px] text-slate-500">No automated runs recorded yet.</p>
            )}
          </div>
        )}
      </Card>

      {/* Data-source integrations */}
      <Card>
        <CardTitle>🔌 Integrations</CardTitle>
        {loading ? <Spinner /> : (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400 -mt-2">
              These power the automated engine's research and topic selection. All optional — the engine
              falls back to catalog gaps + AI knowledge without them. See <code className="text-blue-300">docs/SEO-SETUP.md</code>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Gemini (generation)", on: scheduler?.geminiKeySet, env: "GEMINI_API_KEY", required: true },
                { label: "Search Console", on: scheduler?.gscConfigured, env: "GOOGLE_SERVICE_ACCOUNT_JSON + GSC_SITE_URL" },
                { label: "Google Analytics 4", on: scheduler?.ga4Configured, env: "GOOGLE_SERVICE_ACCOUNT_JSON + GA4_PROPERTY_ID" },
                { label: "Reddit research", on: scheduler?.redditConfigured, env: "REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET" },
                { label: "Daily cron", on: scheduler?.cronTokenSet, env: "SEO_CRON_TOKEN" },
              ].map((it) => (
                <div key={it.label} className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3">
                  <div className={`text-sm font-semibold ${it.on ? "text-emerald-400" : it.required ? "text-red-400" : "text-slate-500"}`}>
                    {it.on ? "✓ Connected" : it.required ? "✗ Required" : "✗ Not set"}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">{it.label}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5 break-all">{it.env}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Static config reference */}
      <Card>
        <CardTitle>Engine Configuration</CardTitle>
        <div className="space-y-0">
          {staticConfig.map((s) => (
            <div key={s.label} className="flex gap-3 py-2.5 border-b border-slate-700/40 last:border-0">
              <span className="w-36 shrink-0 text-xs text-slate-300 font-medium">{s.label}</span>
              <div className="min-w-0">
                <span className="text-xs text-slate-200">{s.value}</span>
                <span className="text-[10px] text-slate-500 ml-2">{s.note}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Env vars */}
      <div className="bg-amber-900/15 border border-amber-700/30 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-amber-400 mb-3">Required Environment Variables</h3>
        <div className="space-y-2">
          {envVars.map((e) => (
            <div key={e.name} className="flex gap-3 text-xs">
              <code className="text-amber-300 font-mono shrink-0 w-44">{e.name}</code>
              <span className="text-slate-400">{e.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Review Queue ─────────────────────────────────────────────────────────

const PAGE_TYPE_COLORS: Record<string, string> = {
  hook:        "text-sky-400",
  comparison:  "text-violet-400",
  breakdown:   "text-amber-400",
  alternative: "text-rose-400",
  trust:       "text-emerald-400",
};

function ReviewTab() {
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState<string | null>(null);
  const [toast, setToast]       = useState("");
  const [toastErr, setToastErr] = useState("");

  const showToast = (msg: string, err = false) => {
    if (err) { setToastErr(msg); setTimeout(() => setToastErr(""), 5000); }
    else      { setToast(msg);   setTimeout(() => setToast(""), 5000); }
  };

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/seo/pipeline/review-queue");
      setClusters(data.clusters ?? []);
    } catch {
      showToast("Failed to load review queue", true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePublish = async (clusterId: string) => {
    setBusy(clusterId);
    try {
      const res = await apiFetch(`/seo/pipeline/cluster/${clusterId}/publish-all`, { method: "POST", body: "{}" });
      showToast(`Published ${res.published} pages`);
      await load();
    } catch (err: any) {
      showToast(err.message ?? "Publish failed", true);
    } finally {
      setBusy(null);
    }
  };

  const handleDiscard = async (clusterId: string) => {
    if (!confirm("Move all 5 pages to draft? They won't be published.")) return;
    setBusy(clusterId);
    try {
      await apiFetch(`/seo/pipeline/cluster/${clusterId}/discard`, { method: "POST", body: "{}" });
      showToast("Pages moved to draft");
      await load();
    } catch (err: any) {
      showToast(err.message ?? "Discard failed", true);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Review Queue</h2>
          <p className="text-xs text-slate-500 mt-0.5">Read each article below, then Publish All or Discard. Competitor was chosen by AI.</p>
        </div>
        <button onClick={load} className="text-xs text-slate-500 hover:text-white transition-colors">↻ Refresh</button>
      </div>

      {toast    && <Toast msg={toast} variant="success" />}
      {toastErr && <Toast msg={toastErr} variant="error" />}

      {clusters.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-sm font-medium text-white">Nothing to review</p>
            <p className="text-xs text-slate-500 mt-1">Enable the daily scheduler or start a manual pipeline — articles appear here when complete.</p>
          </div>
        </Card>
      ) : (
        clusters.map((cluster) => {
          const pages = cluster.pages ?? [];
          const totalWords = pages.reduce((s: number, p: any) => s + (p.wordCount ?? 0), 0);
          return (
            <Card key={cluster.id}>
              {/* Cluster header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white leading-snug">{cluster.topic}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25">
                      {cluster.toolFocus}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/40">
                      vs {cluster.competitor}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {totalWords.toLocaleString()} words · {pages.length} pages · {new Date(cluster.completedAt ?? cluster.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDiscard(cluster.id)}
                    disabled={busy === cluster.id}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => handlePublish(cluster.id)}
                    disabled={busy === cluster.id}
                    className="text-xs px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-40"
                  >
                    {busy === cluster.id ? "Publishing…" : "Publish All 5"}
                  </button>
                </div>
              </div>

              {/* Pages list */}
              <div className="space-y-2">
                {pages.map((page: any) => (
                  <div key={page.slug} className="flex items-center gap-3 px-3 py-2 bg-slate-900/50 rounded-lg border border-slate-700/40">
                    <span className={`text-[10px] font-bold w-2.5 ${PAGE_TYPE_COLORS[page.pageType] ?? "text-slate-400"}`}>
                      {page.pageNumber}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider w-20 shrink-0 ${PAGE_TYPE_COLORS[page.pageType] ?? "text-slate-400"}`}>
                      {page.pageType}
                    </span>
                    <span className="text-xs text-slate-300 flex-1 min-w-0 truncate">{page.title ?? page.slug}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">{page.wordCount ? `${page.wordCount.toLocaleString()}w` : "—"}</span>
                    <a
                      href={`/seo/${page.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-blue-400 hover:text-blue-300 shrink-0"
                    >
                      Preview →
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ── Tab: Pipeline ─────────────────────────────────────────────────────────────

const TOOL_FOCUS_OPTIONS = [
  { value: "paper-writer", label: "AI Paper Writer" },
  { value: "humanizer",    label: "LightSpeed Humanizer" },
  { value: "plagiarism",   label: "AI & Plagiarism Checker" },
  { value: "stem",         label: "STEM Solver" },
  { value: "study",        label: "AI Study Assistant" },
  { value: "revision",     label: "Paper Revision" },
  { value: "outline",      label: "Outline Builder" },
  { value: "ebook",        label: "Ebook Generator" },
];

const STAGE_LABELS: Record<string, string> = {
  pending:    "Pending",
  researching: "Step 1: Researching (Reddit + AI)",
  outlining:  "Step 2: Building Outline",
  write_1:    "Step 3: Writing Page 1 — Hook",
  write_2:    "Step 3: Writing Page 2 — Comparison",
  write_3:    "Step 3: Writing Page 3 — Breakdown",
  write_4:    "Step 3: Writing Page 4 — Competitor Alt",
  write_5:    "Step 3: Writing Page 5 — Trust",
  complete:   "Complete",
  failed:     "Failed",
};

const PAGE_TYPE_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  hook:        { label: "Hook",       color: "text-blue-400",   desc: "Traffic magnet — informational intent" },
  comparison:  { label: "Comparison", color: "text-amber-400",  desc: "High-intent — best X tools" },
  breakdown:   { label: "Breakdown",  color: "text-violet-400", desc: "Educational depth — how X works" },
  alternative: { label: "Alternative",color: "text-rose-400",   desc: "Competitor comparison — buyer intent" },
  trust:       { label: "Trust",      color: "text-emerald-400",desc: "Social proof — review/does it work" },
};

function PipelineTab() {
  const [dailyLimit, setDailyLimit]   = useState<{ used: number; limit: number; canStart: boolean } | null>(null);
  const [clusters, setClusters]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [starting, setStarting]       = useState(false);
  const [polling, setPolling]         = useState<string | null>(null);
  const [toast, setToast]             = useState("");
  const [toastErr, setToastErr]       = useState("");

  const [topic, setTopic]             = useState("");
  const [toolFocus, setToolFocus]     = useState("paper-writer");
  const [autoPublish, setAutoPublish] = useState(false);
  const [scheduler, setScheduler]     = useState<{ enabled: boolean; time: string; nextRunAt: string | null; lastRuns: any[] } | null>(null);
  const [schedSaving, setSchedSaving] = useState(false);

  const showToast = (msg: string, err = false) => {
    if (err) { setToastErr(msg); setTimeout(() => setToastErr(""), 5000); }
    else      { setToast(msg);   setTimeout(() => setToast(""), 5000); }
  };

  const load = useCallback(async () => {
    try {
      const [lim, cls, sched] = await Promise.all([
        apiFetch("/seo/pipeline/daily-limit"),
        apiFetch("/seo/pipeline/clusters"),
        apiFetch("/seo/scheduler/status").catch(() => null),
      ]);
      setDailyLimit(lim);
      setClusters(cls.clusters ?? []);
      if (sched) setScheduler(sched);
    } catch {
      showToast("Failed to load pipeline data", true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll active cluster status every 4 seconds
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      try {
        const cluster = await apiFetch(`/seo/pipeline/cluster/${polling}`);
        setClusters((prev) => prev.map((c) => c.id === polling ? cluster : c));
        if (["complete", "failed"].includes(cluster.status)) {
          setPolling(null);
          load(); // refresh daily limit
        }
      } catch { /* ignore poll errors */ }
    }, 4000);
    return () => clearInterval(interval);
  }, [polling, load]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const body: Record<string, unknown> = { autoPublish };
      if (topic.trim()) { body.topic = topic.trim(); body.toolFocus = toolFocus; }
      const res = await apiFetch("/seo/pipeline/start", {
        method: "POST",
        body: JSON.stringify(body),
      });
      showToast(`Pipeline started: "${res.topic ?? topic}"`);
      setTopic("");
      setPolling(res.clusterId);
      await load();
    } catch (err: any) {
      showToast(err.message ?? "Failed to start pipeline", true);
    } finally {
      setStarting(false);
    }
  };

  const saveScheduler = async (patch: { enabled?: boolean; time?: string }) => {
    setSchedSaving(true);
    try {
      await apiFetch("/seo/scheduler/settings", { method: "PATCH", body: JSON.stringify(patch) });
      const sched = await apiFetch("/seo/scheduler/status");
      setScheduler(sched);
    } catch { showToast("Failed to save scheduler", true); }
    finally { setSchedSaving(false); }
  };

  const triggerScheduler = async () => {
    try {
      await apiFetch("/seo/scheduler/trigger", { method: "POST", body: "{}" });
      showToast("Scheduler triggered — pages will appear in Review tab in ~3 minutes");
    } catch (err: any) {
      showToast(err.message ?? "Trigger failed", true);
    }
  };

  const handleResume = async (clusterId: string) => {
    try {
      await apiFetch(`/seo/pipeline/cluster/${clusterId}/resume`, { method: "POST", body: JSON.stringify({}) });
      showToast("Pipeline resumed");
      setPolling(clusterId);
      await load();
    } catch (err: any) {
      showToast(err.message ?? "Failed to resume", true);
    }
  };

  if (loading) return <Spinner />;

  const used     = dailyLimit?.used    ?? 0;
  const limit    = dailyLimit?.limit   ?? 5;
  const canStart = dailyLimit?.canStart ?? true;
  const limitPct = Math.round((used / limit) * 100);

  return (
    <div className="space-y-5">
      {/* Daily quota card */}
      <Card>
        <CardTitle>Daily Pipeline Quota</CardTitle>
        <div className="flex items-end justify-between mb-2">
          <div>
            <span className={`text-3xl font-bold ${used >= limit ? "text-red-400" : "text-white"}`}>{used}</span>
            <span className="text-slate-400 text-sm ml-1">/ {limit} pages in last 24 hrs</span>
          </div>
          <span className="text-xs text-slate-500">{limit - used} remaining · resets 24 hrs after last generation</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all ${used >= limit ? "bg-red-500" : used >= 3 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(limitPct, 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500">5 pages = 1 cluster. Gemini 2.5 Flash: 50 req/24hr free tier · 5 req/5min. 17s delays between stages keep within rate limits.</p>
      </Card>

      {/* Daily scheduler card */}
      <Card>
        <CardTitle>📅 Daily Auto-Scheduler</CardTitle>
        {scheduler ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">{scheduler.enabled ? "Enabled" : "Disabled"}</p>
                <p className="text-[11px] text-slate-500">
                  {scheduler.enabled
                    ? `Runs daily at ${scheduler.time} UTC — next: ${scheduler.nextRunAt ? new Date(scheduler.nextRunAt).toLocaleString() : "unknown"}`
                    : "Scheduler is off. Enable to generate articles automatically every day."}
                </p>
              </div>
              <button
                onClick={() => saveScheduler({ enabled: !scheduler.enabled })}
                disabled={schedSaving}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${scheduler.enabled ? "bg-emerald-500" : "bg-slate-600"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${scheduler.enabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            {scheduler.enabled && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-400 shrink-0">Run time (UTC):</label>
                <input
                  type="time"
                  defaultValue={scheduler.time}
                  onBlur={(e) => { if (e.target.value) saveScheduler({ time: e.target.value }); }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <Btn onClick={triggerScheduler} size="sm" variant="secondary" className="ml-auto">
                  Run Now
                </Btn>
              </div>
            )}
            {scheduler.lastRuns.length > 0 && (
              <div className="mt-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Recent runs</p>
                <div className="space-y-1">
                  {scheduler.lastRuns.slice(0, 3).map((run, i) => (
                    <div key={i} className={`text-[10px] px-2 py-1 rounded ${run.status === "started" ? "bg-emerald-500/10 text-emerald-300" : run.status === "skipped" ? "bg-slate-700/40 text-slate-400" : "bg-red-500/10 text-red-400"}`}>
                      {new Date(run.createdAt).toLocaleString()} — {run.status}: {String(run.detail).slice(0, 80)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Loading scheduler status…</p>
        )}
      </Card>

      {/* Start new pipeline */}
      <Card>
        <CardTitle>Start New Article Pipeline</CardTitle>

        {toast    && <Toast msg={toast} variant="success" />}
        {toastErr && <Toast msg={toastErr} variant="error" />}

        <div className="space-y-3 mt-2">
          {/* AI mode notice */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2.5 text-[11px] text-purple-300">
            <strong>AI-driven by default.</strong> Leave topic blank and the system picks the best opportunity using Google Search Console + Analytics data. Competitor is always AI-selected during research.
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Topic override <span className="text-slate-600">(optional)</span></label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Leave blank for AI to choose — or e.g. AI essay writing for PhD students"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {topic.trim() && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Tool to Promote <span className="text-slate-500">(required when topic is set)</span></label>
              <select
                value={toolFocus}
                onChange={(e) => setToolFocus(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {TOOL_FOCUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* 5-page structure preview */}
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/40">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">5 pages that will be generated</p>
            <div className="space-y-1">
              {Object.entries(PAGE_TYPE_LABELS).map(([type, info], i) => (
                <div key={type} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-600 w-3">{i + 1}</span>
                  <span className={`font-medium ${info.color} w-20 shrink-0`}>{info.label}</span>
                  <span className="text-slate-500">{info.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <Btn
            onClick={handleStart}
            disabled={starting || !canStart}
            variant="purple"
            size="sm"
            className="w-full"
          >
            {starting ? "Starting pipeline…" : !canStart ? `Daily limit reached (${used}/${limit})` : topic.trim() ? "Start Pipeline with This Topic →" : "Let AI Pick Best Topic & Start →"}
          </Btn>
        </div>
      </Card>

      {/* Cluster list */}
      {clusters.length > 0 && (
        <Card>
          <CardTitle>Article Clusters ({clusters.length})</CardTitle>
          <div className="space-y-3">
            {clusters.map((cluster) => {
              const isActive = ["researching","outlining","writing_1","writing_2","writing_3","writing_4","writing_5"].includes(cluster.status);
              const pages    = cluster.pages ?? [];

              return (
                <div key={cluster.id} className={`rounded-xl border p-4 ${
                  cluster.status === "complete" ? "border-emerald-500/20 bg-emerald-500/5" :
                  cluster.status === "failed"   ? "border-red-500/20 bg-red-500/5" :
                  isActive                       ? "border-blue-500/20 bg-blue-500/5" :
                                                   "border-slate-700/40 bg-slate-900/40"
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{cluster.topic}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Tool: {cluster.toolFocus} · Competitor: {cluster.competitor} · {pages.length}/5 pages
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive && polling === cluster.id && (
                        <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                      )}
                      <StatusBadge status={cluster.status === "complete" ? "published" : cluster.status === "failed" ? "archived" : "review"} />
                    </div>
                  </div>

                  {/* Stage progress */}
                  <p className="text-[10px] text-slate-400 mb-2">
                    {STAGE_LABELS[cluster.currentStage] ?? cluster.currentStage}
                    {cluster.pagesCompleted > 0 && ` · ${cluster.pagesCompleted}/5 pages written`}
                  </p>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        cluster.status === "complete" ? "bg-emerald-500" :
                        cluster.status === "failed"   ? "bg-red-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${cluster.status === "complete" ? 100 : Math.round((cluster.pagesCompleted / 5) * 100)}%` }}
                    />
                  </div>

                  {/* Generated pages */}
                  {pages.length > 0 && (
                    <div className="grid grid-cols-5 gap-1.5 mb-2">
                      {pages.map((p: any) => {
                        const info = PAGE_TYPE_LABELS[p.pageType] ?? { label: p.pageType, color: "text-slate-400", desc: "" };
                        return (
                          <a
                            key={p.slug}
                            href={`/seo/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`${info.label} — ${p.wordCount ?? "?"}w · ${p.published ? "published" : p.status}`}
                            className={`rounded-lg p-1.5 text-center border transition-all hover:opacity-80 ${
                              p.published ? "border-emerald-500/30 bg-emerald-500/10" : "border-slate-700/40 bg-slate-800/40"
                            }`}
                          >
                            <div className={`text-[9px] font-bold ${info.color}`}>{info.label}</div>
                            <div className="text-[8px] text-slate-600">{p.wordCount ?? "?"}w</div>
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {/* Error message */}
                  {cluster.errorMessage && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-2">
                      <p className="text-[10px] text-red-400">{cluster.errorMessage}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {cluster.status === "failed" && (
                      <Btn variant="amber" size="xs" onClick={() => handleResume(cluster.id)}>
                        Retry Pipeline
                      </Btn>
                    )}
                    {isActive && polling !== cluster.id && (
                      <Btn variant="secondary" size="xs" onClick={() => setPolling(cluster.id)}>
                        Watch Progress
                      </Btn>
                    )}
                    {cluster.status === "complete" && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        ✓ All 5 pages ready · {new Date(cluster.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {clusters.length === 0 && (
        <div className="text-center py-10 text-slate-500 text-sm">
          No article clusters yet. Start your first pipeline above.
        </div>
      )}
    </div>
  );
}

// ── Main SeoAdmin component ───────────────────────────────────────────────────

const TABS = [
  { id: "write",     label: "Write",     icon: "✍️" },
  { id: "review",    label: "Review",    icon: "✅" },
  { id: "pipeline",  label: "Pipeline",  icon: "🚀" },
  { id: "dashboard", label: "Dashboard", icon: "⚡" },
  { id: "catalog",   label: "Catalog",   icon: "📋" },
  { id: "pages",     label: "Pages",     icon: "📄" },
  { id: "budget",    label: "Budget",    icon: "💰" },
  { id: "integrity", label: "Integrity", icon: "🛡" },
  { id: "sitemap",   label: "Sitemap",   icon: "🗺" },
  { id: "settings",  label: "Settings",  icon: "⚙" },
];

export default function SeoAdmin() {
  // Open on the Dashboard — it shows the whole system (manual + AI-generated
  // pages, budget, scheduler) so neither engine looks "switched off".
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderTab = () => {
    switch (activeTab) {
      case "write":      return <WriteTab />;
      case "review":     return <ReviewTab />;
      case "pipeline":   return <PipelineTab />;
      case "dashboard":  return <DashboardTab />;
      case "catalog":   return <CatalogTab />;
      case "pages":     return <PagesTab />;
      case "budget":    return <BudgetTab />;
      case "integrity":  return <IntegrityTab />;
      case "sitemap":    return <SitemapTab />;
      case "settings":   return <SettingsTab />;
      default:           return <ReviewTab />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Page header */}
        <div className="mb-6 pb-5 border-b border-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">⚡</span>
                SEO Engine
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Two engines, one pipeline — write pages by hand in <span className="text-slate-300">Write</span>, and/or let the AI auto-generate clusters (Gemini 2.5 Flash) via <span className="text-slate-300">Pipeline</span> &amp; the daily scheduler. Both publish server-rendered to <span className="text-slate-300">/seo/&lt;slug&gt;</span>.
              </p>
            </div>
            <a
              href="/seo/ai-paper-writer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-400/40 rounded-lg px-3 py-1.5 transition-all"
            >
              ↗ Preview live page
            </a>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 flex-wrap mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <span className="text-[11px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>{renderTab()}</div>
      </div>
    </div>
  );
}
