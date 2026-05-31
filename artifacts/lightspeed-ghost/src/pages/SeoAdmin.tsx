import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

const API = "/api";

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
  const pct = budget?.percentUsed ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Published", value: pages.published ?? 0, color: "text-green-400" },
          { label: "In Review", value: pages.review ?? 0, color: "text-amber-400" },
          { label: "Draft", value: pages.draft ?? 0, color: "text-slate-400" },
          { label: "Total Pages", value: pages.total ?? 0, color: "text-blue-400" },
        ].map((m) => (
          <div key={m.label} className="bg-slate-800 rounded-lg p-4 text-center">
            <div className={`text-3xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-xs text-slate-400 mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Monthly LLM Budget</h3>
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>${budget?.totalSpend?.toFixed(4) ?? "0.00"} spent</span>
          <span>${budget?.budgetLimit ?? 8} limit</span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-green-500"}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-slate-400 flex justify-between">
          <span>Gemini: ${budget?.geminiSpend?.toFixed(4) ?? "0"}</span>
          <span>Claude: ${budget?.claudeSpend?.toFixed(4) ?? "0"}</span>
          <span>{pct}% used</span>
        </div>
        {budget?.upgraded && (
          <p className="text-xs text-green-400 mt-2">✓ Budget upgraded — Claude unlocked for all pages</p>
        )}
        {budget?.pillarRemainingThisMonth !== undefined && (
          <p className="text-xs text-blue-400 mt-1">
            Claude pillar pages: {budget.pillarUsedThisMonth}/{15} used this month ({budget.pillarRemainingThisMonth} remaining)
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Quality Issues</h3>
          {[
            { label: "Missing AI disclosure", value: pages.missing_disclosure ?? 0, color: "text-amber-400" },
            { label: "Integrity failures", value: pages.integrity_issues ?? 0, color: "text-red-400" },
          ].map((q) => (
            <div key={q.label} className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0">
              <span className="text-xs text-slate-400">{q.label}</span>
              <span className={`text-sm font-bold ${q.color}`}>{q.value}</span>
            </div>
          ))}
        </div>
        <div className="bg-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <a href="/seo/ai-paper-writer" target="_blank" rel="noopener noreferrer"
              className="block text-xs text-blue-400 hover:text-blue-300">→ Preview: AI Paper Writer</a>
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer"
              className="block text-xs text-blue-400 hover:text-blue-300">→ View sitemap.xml</a>
            <a href="/robots.txt" target="_blank" rel="noopener noreferrer"
              className="block text-xs text-blue-400 hover:text-blue-300">→ View robots.txt</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Catalog ──────────────────────────────────────────────────────────────
function CatalogTab() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [filter, setFilter] = useState("all");
  const [msg, setMsg] = useState("");

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
      await load();
    } finally { setSeeding(false); }
  };

  const filtered = filter === "all" ? catalog : catalog.filter((c) => c.status === filter || (!c.inDb && filter === "not-seeded"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 text-xs text-slate-400">
          <span className="bg-slate-700 px-2 py-1 rounded">{stats.total} in catalog</span>
          <span className="bg-slate-700 px-2 py-1 rounded">{stats.inDb} in DB</span>
        </div>
        <div className="flex gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="bg-slate-700 text-xs text-white rounded px-2 py-1 border border-slate-600">
            <option value="all">All</option>
            <option value="not-seeded">Not Seeded</option>
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="published">Published</option>
          </select>
          <button onClick={seed} disabled={seeding}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded disabled:opacity-50">
            {seeding ? "Seeding…" : "Seed Catalog"}
          </button>
        </div>
      </div>
      {msg && <div className="text-xs text-green-400 bg-green-400/10 rounded px-3 py-2">{msg}</div>}
      {loading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-400 border-b border-slate-700">
              <th className="text-left py-2 pr-3">Slug</th>
              <th className="text-left py-2 pr-3">Type</th>
              <th className="text-left py-2 pr-3">Priority</th>
              <th className="text-left py-2 pr-3">Status</th>
              <th className="text-left py-2">In DB</th>
            </tr></thead>
            <tbody>{filtered.map((c) => (
              <tr key={c.slug} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="py-1.5 pr-3 text-blue-300 font-mono">{c.slug}</td>
                <td className="py-1.5 pr-3 text-slate-300">{c.type}</td>
                <td className="py-1.5 pr-3">{c.priority}</td>
                <td className="py-1.5 pr-3"><StatusBadge status={c.status} /></td>
                <td className="py-1.5">{c.inDb ? "✓" : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-slate-500 py-8 text-sm">No pages match this filter</p>}
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
      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          placeholder="Search pages…" className="bg-slate-700 text-white text-xs rounded px-3 py-1.5 border border-slate-600 w-48" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          className="bg-slate-700 text-xs text-white rounded px-2 py-1.5 border border-slate-600">
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="review">Review</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <span className="text-xs text-slate-400 self-center">{total} total</span>
      </div>
      {actionMsg && <div className="text-xs text-green-400 bg-green-400/10 rounded px-3 py-2">{actionMsg}</div>}
      {loading ? <Spinner /> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-2 pr-3">Slug</th>
                <th className="text-left py-2 pr-3">Type</th>
                <th className="text-left py-2 pr-3">Words</th>
                <th className="text-left py-2 pr-3">LLM</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2 pr-3">Checks</th>
                <th className="text-left py-2">Actions</th>
              </tr></thead>
              <tbody>{pages.map((p) => (
                <tr key={p.slug} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="py-1.5 pr-3">
                    <a href={`/seo/${p.slug}`} target="_blank" rel="noopener noreferrer"
                      className="text-blue-300 hover:text-blue-200 font-mono">{p.slug}</a>
                  </td>
                  <td className="py-1.5 pr-3 text-slate-400">{p.page_type}</td>
                  <td className="py-1.5 pr-3">{p.word_count ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-slate-400">{p.llm_used ? p.llm_used.split("-")[0] : "—"}</td>
                  <td className="py-1.5 pr-3"><StatusBadge status={p.status} /></td>
                  <td className="py-1.5 pr-3">
                    <span className={p.has_ai_disclosure ? "text-green-400" : "text-red-400"}>AI</span>
                    {" "}<span className={p.integrity_check ? "text-green-400" : "text-amber-400"}>INT</span>
                    {" "}<span className={p.has_faq_schema ? "text-green-400" : "text-slate-500"}>FAQ</span>
                  </td>
                  <td className="py-1.5">
                    <button onClick={() => togglePublish(p.slug, p.published)}
                      className={`text-xs px-2 py-0.5 rounded ${p.published ? "bg-red-600/30 text-red-300 hover:bg-red-600/50" : "bg-green-600/30 text-green-300 hover:bg-green-600/50"}`}>
                      {p.published ? "Unpublish" : "Publish"}
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {pages.length === 0 && <p className="text-center text-slate-500 py-8 text-sm">No pages found</p>}
          </div>
          <div className="flex gap-2 justify-center">
            <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}
              className="text-xs bg-slate-700 px-3 py-1 rounded disabled:opacity-40">← Prev</button>
            <span className="text-xs text-slate-400 self-center">
              {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </span>
            <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total}
              className="text-xs bg-slate-700 px-3 py-1 rounded disabled:opacity-40">Next →</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab: Generator ────────────────────────────────────────────────────────────
function GeneratorTab() {
  const [slug, setSlug] = useState("");
  const [batchType, setBatchType] = useState("tool");
  const [batchLimit, setBatchLimit] = useState(5);
  const [autoPublish, setAutoPublish] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const generateSingle = async () => {
    if (!slug.trim()) return;
    setLoading(true); setResult(null);
    try {
      const r = await apiFetch("/seo/generate-page", {
        method: "POST",
        body: JSON.stringify({ slug: slug.trim(), autoPublish }),
      });
      setResult(r);
    } catch (e: any) { setResult({ success: false, error: e.message }); }
    setLoading(false);
  };

  const generateBatch = async () => {
    setLoading(true); setResult(null);
    try {
      const r = await apiFetch("/seo/generate-batch", {
        method: "POST",
        body: JSON.stringify({ type: batchType, limit: batchLimit, autoPublish }),
      });
      setResult(r);
    } catch (e: any) { setResult({ success: false, error: e.message }); }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Generate Single Page</h3>
        <div className="flex gap-3">
          <input value={slug} onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. ai-paper-writer"
            className="flex-1 bg-slate-700 text-white text-xs rounded px-3 py-2 border border-slate-600" />
          <button onClick={generateSingle} disabled={loading || !slug.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded disabled:opacity-50">
            Generate
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} className="rounded" />
          Auto-publish on generation
        </label>
      </div>

      <div className="bg-slate-800 rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Batch Generate</h3>
        <div className="flex gap-3 flex-wrap">
          <select value={batchType} onChange={(e) => setBatchType(e.target.value)}
            className="bg-slate-700 text-xs text-white rounded px-2 py-2 border border-slate-600">
            {["tool","service","paper-type","subject","software-specific","method-specific",
              "financial-analysis","use-case","problem-solution","comparison",
              "academic-level","citation-guide","ebook-type","ebook-platform","how-to"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input type="number" value={batchLimit} onChange={(e) => setBatchLimit(parseInt(e.target.value))}
            min={1} max={30}
            className="w-20 bg-slate-700 text-white text-xs rounded px-2 py-2 border border-slate-600" />
          <span className="text-xs text-slate-400 self-center">pages</span>
          <button onClick={generateBatch} disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-4 py-2 rounded disabled:opacity-50">
            Batch Generate
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-slate-800 rounded-lg p-6 text-center">
          <Spinner />
          <p className="text-sm text-slate-400 mt-3">Generating with Gemini 2.5 Flash / Claude Haiku…</p>
          <p className="text-xs text-slate-500 mt-1">This may take 30–90 seconds per page</p>
        </div>
      )}

      {result && !loading && (
        <div className={`rounded-lg p-5 text-sm ${result.success || result.results ? "bg-green-900/20 border border-green-700/30" : "bg-red-900/20 border border-red-700/30"}`}>
          {result.error && <p className="text-red-400">{result.error}</p>}
          {result.success && (
            <div className="space-y-1">
              <p className="text-green-400 font-medium">✓ Generated: {result.slug}</p>
              <p className="text-xs text-slate-400">Words: {result.wordCount} · Model: {result.model} · Cost: ${result.costUsd?.toFixed(6)}</p>
            </div>
          )}
          {result.results && (
            <div className="space-y-2">
              <p className="text-green-400 font-medium">Batch complete — {result.results.filter((r: any) => r.success).length}/{result.results.length} succeeded</p>
              <p className="text-xs text-slate-400">Total cost: ${result.totalCost?.toFixed(6)}</p>
              <div className="max-h-48 overflow-y-auto space-y-1 mt-2">
                {result.results.map((r: any) => (
                  <div key={r.slug} className={`text-xs ${r.success ? "text-green-300" : "text-red-300"}`}>
                    {r.success ? "✓" : "✗"} {r.slug} {r.error ? `— ${r.error}` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Gemini Spend", value: `$${(budget?.geminiSpend ?? 0).toFixed(4)}`, sub: "Gemini 2.5 Flash" },
          { label: "Claude Spend", value: `$${(budget?.claudeSpend ?? 0).toFixed(4)}`, sub: "Claude Haiku 4.5" },
          { label: "Total Spend", value: `$${(budget?.totalSpend ?? 0).toFixed(4)}`, sub: "This month" },
          { label: "Remaining", value: `$${(budget?.remainingBudget ?? 0).toFixed(4)}`, sub: "Budget left" },
        ].map((m) => (
          <div key={m.label} className="bg-slate-800 rounded-lg p-4">
            <div className="text-lg font-bold text-white">{m.value}</div>
            <div className="text-xs font-medium text-slate-300 mt-0.5">{m.label}</div>
            <div className="text-xs text-slate-500">{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 rounded-lg p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Budget: {budget?.month}</h3>
          {!budget?.upgraded && (
            <button onClick={async () => {
              setUpgrading(true);
              await apiFetch("/seo/budget/upgrade", { method: "POST" });
              const b = await apiFetch("/seo/budget/status");
              setBudget(b);
              setUpgrading(false);
            }} disabled={upgrading} className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded disabled:opacity-50">
              {upgrading ? "Upgrading…" : "Upgrade to Full Claude"}
            </button>
          )}
        </div>
        <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${budget?.percentUsed > 80 ? "bg-red-500" : "bg-blue-500"}`}
            style={{ width: `${Math.min(budget?.percentUsed ?? 0, 100)}%` }} />
        </div>
        <p className="text-xs text-slate-400 mt-2">{budget?.percentUsed ?? 0}% of ${budget?.budgetLimit ?? 8} budget used · {budget?.pagesGenerated ?? 0} pages generated</p>
      </div>

      <div className="bg-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Recent LLM Cost Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-500 border-b border-slate-700">
              <th className="text-left py-1.5 pr-3">Task</th>
              <th className="text-left py-1.5 pr-3">Model</th>
              <th className="text-right py-1.5 pr-3">In Tokens</th>
              <th className="text-right py-1.5 pr-3">Out Tokens</th>
              <th className="text-right py-1.5 pr-3">Cost</th>
              <th className="text-left py-1.5">Time</th>
            </tr></thead>
            <tbody>{log.slice(0, 25).map((l) => (
              <tr key={l.id} className="border-b border-slate-800">
                <td className="py-1.5 pr-3 text-slate-300">{l.task_type}</td>
                <td className="py-1.5 pr-3 text-slate-400">{l.model_used}</td>
                <td className="py-1.5 pr-3 text-right">{l.input_tokens?.toLocaleString()}</td>
                <td className="py-1.5 pr-3 text-right">{l.output_tokens?.toLocaleString()}</td>
                <td className="py-1.5 pr-3 text-right text-green-400">${parseFloat(l.cost_usd).toFixed(6)}</td>
                <td className="py-1.5 text-slate-500">{new Date(l.logged_at).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
          {log.length === 0 && <p className="text-center text-slate-500 py-6 text-sm">No cost log entries yet</p>}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Integrity (Academic & Compliance) ────────────────────────────────────
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "AI Disclosure", value: compliance?.has_disclosure ?? 0, total: compliance?.generated ?? 0, color: "text-blue-400" },
          { label: "Integrity OK", value: compliance?.integrity_ok ?? 0, total: compliance?.generated ?? 0, color: "text-green-400" },
          { label: "Has FAQ", value: compliance?.has_faq ?? 0, total: compliance?.generated ?? 0, color: "text-purple-400" },
          { label: "800+ words", value: compliance?.meets_word_count ?? 0, total: compliance?.generated ?? 0, color: "text-amber-400" },
        ].map((m) => (
          <div key={m.label} className="bg-slate-800 rounded-lg p-4">
            <div className={`text-2xl font-bold ${m.color}`}>{m.value}<span className="text-slate-500 text-sm font-normal">/{m.total}</span></div>
            <div className="text-xs text-slate-400 mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          Academic Integrity Issues ({audit?.issueCount ?? 0} pages affected)
        </h3>
        {audit?.issues?.length === 0 ? (
          <p className="text-green-400 text-sm">✓ All pages pass academic integrity checks</p>
        ) : (
          <div className="space-y-3">
            {audit?.issues?.map((issue: any) => (
              <div key={issue.slug} className="border border-red-800/40 bg-red-900/10 rounded p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs text-red-300 font-mono">{issue.slug}</span>
                    <ul className="mt-1 space-y-0.5">
                      {issue.violations.slice(0, 3).map((v: string, i: number) => (
                        <li key={i} className="text-xs text-slate-400">• {v}</li>
                      ))}
                    </ul>
                  </div>
                  <button onClick={() => fix(issue.slug)} disabled={fixing === issue.slug}
                    className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded disabled:opacity-50 ml-3 shrink-0">
                    {fixing === issue.slug ? "Fixing…" : "Auto-Fix"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Compliance Coverage</h3>
        {[
          { label: "EU AI Act — Content Disclosure", desc: "ai-generated meta tag + visible disclosure label on all generated pages", status: "active" },
          { label: "WCAG 2.2 Level AA", desc: "Skip links, focus rings, table captions, ARIA labels, 24px touch targets", status: "active" },
          { label: "Academic Integrity", desc: "No bypass/cheat/undetectable language. AI writing assistance framing only.", status: "active" },
          { label: "Robots.txt Crawler Policy", desc: "Training crawlers blocked, search crawlers allowed, Perplexity allowed", status: "active" },
        ].map((c) => (
          <div key={c.label} className="flex items-start gap-3 py-3 border-b border-slate-700 last:border-0">
            <span className="text-green-400 mt-0.5 shrink-0">✓</span>
            <div>
              <div className="text-xs font-medium text-slate-300">{c.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{c.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Sitemap & Robots ─────────────────────────────────────────────────────
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
        <div className="bg-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Sitemap</h3>
          <div className="space-y-2 text-xs">
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer"
              className="block text-blue-400 hover:text-blue-300">↗ View sitemap.xml</a>
            <p className="text-slate-400">Dynamic — auto-includes all published SEO pages</p>
          </div>
          <button onClick={ping} disabled={pinging}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded disabled:opacity-50">
            {pinging ? "Pinging…" : "Ping Google & Bing"}
          </button>
          {pingResult && (
            <div className={`mt-3 text-xs rounded p-2 ${pingResult.ok ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"}`}>
              {pingResult.ok ? `✓ Pinged: ${pingResult.pinged?.join(", ")}` : pingResult.error}
            </div>
          )}
        </div>
        <div className="bg-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Robots.txt</h3>
          <a href="/robots.txt" target="_blank" rel="noopener noreferrer"
            className="block text-xs text-blue-400 hover:text-blue-300 mb-3">↗ View live robots.txt</a>
          <p className="text-xs text-slate-400">Dynamically rendered. Blocks: GPTBot, CCBot, anthropic-ai, ClaudeBot, Bytespider (training). Allows: Googlebot, Bingbot, Perplexity, OAI-SearchBot.</p>
        </div>
      </div>
      <div className="bg-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Robots.txt Preview</h3>
        {robotsLoading ? <Spinner /> : (
          <pre className="text-xs text-slate-300 bg-slate-900 rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">{robots}</pre>
        )}
      </div>
    </div>
  );
}

// ── Tab: Settings ─────────────────────────────────────────────────────────────
function SettingsTab() {
  return (
    <div className="space-y-5">
      <div className="bg-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">SEO Engine Configuration</h3>
        <div className="space-y-3 text-xs text-slate-400">
          {[
            { label: "Primary LLM", value: "Gemini 2.5 Flash (gemini-2.5-flash-preview-05-20)" },
            { label: "Pillar LLM", value: "Claude Haiku 4.5 (claude-haiku-4-5) — max 15/month" },
            { label: "Monthly budget", value: "$8.00 (overridable via SEO_BUDGET_LIMIT env var)" },
            { label: "Minimum word count", value: "800 words (SEO_MIN_WORD_COUNT env var)" },
            { label: "Daily page limit", value: "30 pages (SEO_DAILY_PAGE_LIMIT env var)" },
            { label: "Auto-publish", value: "Off by default — requires manual publish or autoPublish flag" },
            { label: "Robots.txt", value: "Dynamic — served by Express, replaces static file" },
            { label: "Sitemap.xml", value: "Dynamic — includes all published SEO pages automatically" },
            { label: "WCAG standard", value: "2.2 Level AA (skip links, focus rings, ARIA, min touch targets)" },
            { label: "Academic integrity", value: "No bypass/cheat/undetectable — enforced pre-publish and post-generation" },
            { label: "EU AI Act", value: "ai-generated meta tag + visible disclosure label on all pages" },
            { label: "Page catalog size", value: "130+ predefined slugs across 15 page types" },
          ].map((s) => (
            <div key={s.label} className="flex gap-3 py-2 border-b border-slate-700 last:border-0">
              <span className="w-44 shrink-0 text-slate-300">{s.label}</span>
              <span>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-amber-400 mb-2">Required Environment Variables</h3>
        <div className="space-y-1 text-xs text-slate-400">
          <p><span className="text-amber-300 font-mono">GEMINI_API_KEY</span> — Google AI Studio API key (primary LLM for SEO)</p>
          <p><span className="text-amber-300 font-mono">ANTHROPIC_API_KEY</span> — Anthropic API key (Claude Haiku for pillar pages)</p>
          <p><span className="text-amber-300 font-mono">SEO_BUDGET_LIMIT</span> — Monthly USD budget cap (default: 8.00)</p>
          <p><span className="text-amber-300 font-mono">SEO_DAILY_PAGE_LIMIT</span> — Max pages per batch run (default: 30)</p>
        </div>
      </div>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-8 h-8 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "bg-green-600/30 text-green-300",
    review: "bg-amber-600/30 text-amber-300",
    draft: "bg-slate-600/30 text-slate-400",
    archived: "bg-red-600/30 text-red-400",
    "not-seeded": "bg-slate-700 text-slate-500",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${map[status] ?? "bg-slate-700 text-slate-400"}`}>
      {status}
    </span>
  );
}

// ── Main SeoAdmin component ───────────────────────────────────────────────────
const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "catalog", label: "Catalog" },
  { id: "pages", label: "Pages" },
  { id: "generator", label: "Generator" },
  { id: "budget", label: "Budget" },
  { id: "integrity", label: "Integrity" },
  { id: "sitemap", label: "Sitemap" },
  { id: "settings", label: "Settings" },
];

export default function SeoAdmin() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderTab = () => {
    switch (activeTab) {
      case "dashboard": return <DashboardTab />;
      case "catalog": return <CatalogTab />;
      case "pages": return <PagesTab />;
      case "generator": return <GeneratorTab />;
      case "budget": return <BudgetTab />;
      case "integrity": return <IntegrityTab />;
      case "sitemap": return <SitemapTab />;
      case "settings": return <SettingsTab />;
      default: return <DashboardTab />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">SEO Engine</h1>
          <p className="text-sm text-slate-400 mt-1">
            AI-powered SEO content engine · Gemini 2.5 Flash + Claude Haiku · $8/month budget
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 flex-wrap border-b border-slate-700 mb-6 pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-sm rounded-t font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
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
