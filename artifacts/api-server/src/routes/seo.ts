/**
 * SEO Admin API Router — mounted under /api via app.use("/api", router).
 * All admin routes are /seo/... here, which become /api/seo/... externally.
 * Public routes (robots.txt, sitemap.xml, /seo/:slug) live in seo-public.ts.
 */
import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import {
  seedCatalog,
  generatePage,
  generateBatch,
  publishPage,
  unpublishPage,
  getDashboardSummary,
} from "../seo-engine/orchestrator";
import { getBudgetStatus, markBudgetUpgraded } from "../seo-engine/budget-tracker";
import { renderRobotsTxt } from "../seo-engine/html-renderer";
import { PAGE_CATALOG } from "../seo-engine/page-catalog";
import { checkAcademicIntegrity, sanitizeContent } from "../seo-engine/compliance-checker";

// Admin guard helpers — req.adminAuth is resolved by the admin router middleware
// which runs before seoRouter because adminRouter is registered first in routes/index.ts
function isAdmin(req: Request): boolean {
  return req.adminAuth?.authorized ?? false;
}
function isSuperAdmin(req: Request): boolean {
  return req.adminAuth?.isSuperAdmin ?? false;
}

const router = Router();

// ── Budget status — GET /api/seo/budget/status ────────────────────────────────
router.get("/seo/budget/status", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    res.json(await getBudgetStatus());
  } catch {
    res.status(500).json({ error: "Failed to fetch budget" });
  }
});

router.post("/seo/budget/upgrade", async (req: Request, res: Response) => {
  if (!isSuperAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    await markBudgetUpgraded();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to upgrade budget" });
  }
});

// ── Dashboard summary — GET /api/seo/dashboard/summary ───────────────────────
router.get("/seo/dashboard/summary", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    res.json(await getDashboardSummary());
  } catch {
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

// ── Get all SEO pages — GET /api/seo/pages ───────────────────────────────────
router.get("/seo/pages", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }

  const {
    status, type, tool, software, paperType, financialFocus,
    search, limit = "50", offset = "0",
  } = req.query as Record<string, string>;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (status) { conditions.push(`status = $${p++}`); params.push(status); }
    if (type) { conditions.push(`page_type = $${p++}`); params.push(type); }
    if (tool) { conditions.push(`tool_focus = $${p++}`); params.push(tool); }
    if (software) { conditions.push(`software_focus = $${p++}`); params.push(software); }
    if (paperType) { conditions.push(`paper_type_focus = $${p++}`); params.push(paperType); }
    if (financialFocus) { conditions.push(`financial_focus = $${p++}`); params.push(financialFocus); }
    if (search) { conditions.push(`(title ILIKE $${p} OR slug ILIKE $${p})`); params.push(`%${search}%`); p++; }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT id, slug, title, meta_description, page_type, status, published,
              word_count, unique_data_points, has_faq_schema, has_ai_disclosure,
              integrity_check, llm_used, llm_cost_usd, tool_focus, software_focus,
              paper_type_focus, financial_focus, audience_segment, created_at, updated_at
       FROM seo_pages ${where}
       ORDER BY updated_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const total = await pool.query(`SELECT COUNT(*) FROM seo_pages ${where}`, params);

    res.json({ pages: rows, total: parseInt(total.rows[0].count), limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    logger.error({ err }, "[seo-api] GET /seo/pages failed");
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});

// ── Get single page — GET /api/seo/page/:slug ────────────────────────────────
router.get("/seo/page/:slug", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rows } = await pool.query(`SELECT * FROM seo_pages WHERE slug = $1`, [req.params.slug]);
  if (rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.json(rows[0]);
});

// ── Update page (inline editing) — PUT /api/seo/page/:slug ───────────────────
router.put("/seo/page/:slug", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { title, metaDescription, contentHtml, status: newStatus } = req.body;

  try {
    const updates: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (title !== undefined) { updates.push(`title = $${p++}`); params.push(title); }
    if (metaDescription !== undefined) { updates.push(`meta_description = $${p++}`); params.push(metaDescription); }
    if (contentHtml !== undefined) {
      const sanitized = sanitizeContent(contentHtml);
      updates.push(`content_html = $${p++}`);
      params.push(sanitized);
    }
    if (newStatus !== undefined) { updates.push(`status = $${p++}`); params.push(newStatus); }
    updates.push(`updated_at = now()`);

    params.push(req.params.slug);
    await pool.query(
      `UPDATE seo_pages SET ${updates.join(", ")} WHERE slug = $${p}`,
      params
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Update failed" });
  }
});

// ── Publish / unpublish ───────────────────────────────────────────────────────
router.post("/seo/page/:slug/publish", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const ok = await publishPage(String(req.params.slug));
  res.json({ ok });
});

router.post("/seo/page/:slug/unpublish", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const ok = await unpublishPage(String(req.params.slug));
  res.json({ ok });
});

// ── Delete page — DELETE /api/seo/page/:slug ─────────────────────────────────
router.delete("/seo/page/:slug", async (req: Request, res: Response) => {
  if (!isSuperAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  await pool.query(`DELETE FROM seo_pages WHERE slug = $1`, [req.params.slug]);
  res.json({ ok: true });
});

// ── Generate single page — POST /api/seo/generate-page ───────────────────────
router.post("/seo/generate-page", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { slug, autoPublish = false } = req.body;
  if (!slug) { res.status(400).json({ error: "slug required" }); return; }

  try {
    const result = await generatePage(slug, { autoPublish });
    res.json(result);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, slug, error });
  }
});

// ── Batch generate — POST /api/seo/generate-batch ────────────────────────────
router.post("/seo/generate-batch", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { slugs, type, limit = 10, autoPublish = false } = req.body;

  try {
    const result = await generateBatch({ slugs, type, limit, autoPublish });
    res.json(result);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error });
  }
});

// ── Seed catalog — POST /api/seo/catalog/seed ────────────────────────────────
router.post("/seo/catalog/seed", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const result = await seedCatalog();
    res.json(result);
  } catch {
    res.status(500).json({ error: "Seed failed" });
  }
});

// ── Get catalog — GET /api/seo/catalog ───────────────────────────────────────
router.get("/seo/catalog", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const { rows } = await pool.query(`SELECT slug, status, published, word_count, llm_used FROM seo_pages`);
    type CatalogRow = { slug: string; status: string; published: boolean; word_count: number | null; llm_used: string | null };
    const dbMap = new Map<string, CatalogRow>(rows.map((r) => [r.slug as string, r as CatalogRow]));

    const catalog = PAGE_CATALOG.map((spec) => ({
      slug: spec.slug,
      type: spec.type,
      title: spec.title,
      priority: spec.priority,
      toolFocus: spec.toolFocus,
      inDb: dbMap.has(spec.slug),
      status: dbMap.get(spec.slug)?.status ?? "not-seeded",
      published: dbMap.get(spec.slug)?.published ?? false,
      wordCount: dbMap.get(spec.slug)?.word_count ?? null,
      llmUsed: dbMap.get(spec.slug)?.llm_used ?? null,
    }));

    res.json({ catalog, totalInCatalog: PAGE_CATALOG.length, totalInDb: rows.length });
  } catch {
    res.status(500).json({ error: "Failed to fetch catalog" });
  }
});

// ── Integrity audit — GET /api/seo/audit/integrity ───────────────────────────
router.get("/seo/audit/integrity", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const { rows } = await pool.query(
      `SELECT slug, title, content_html FROM seo_pages WHERE content_html IS NOT NULL`
    );

    const issues: Array<{ slug: string; title: string; violations: string[] }> = [];
    for (const row of rows) {
      const result = checkAcademicIntegrity(row.content_html ?? "");
      if (!result.passed) {
        issues.push({ slug: row.slug, title: row.title, violations: result.violations });
      }
    }

    res.json({ total: rows.length, issueCount: issues.length, issues });
  } catch {
    res.status(500).json({ error: "Integrity audit failed" });
  }
});

// ── Auto-fix integrity — POST /api/seo/audit/integrity/fix/:slug ─────────────
router.post("/seo/audit/integrity/fix/:slug", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { slug } = req.params;
  try {
    const { rows } = await pool.query(`SELECT content_html FROM seo_pages WHERE slug = $1`, [slug]);
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }

    const result = checkAcademicIntegrity(rows[0].content_html ?? "");
    await pool.query(
      `UPDATE seo_pages SET content_html = $1, integrity_check = true, updated_at = now() WHERE slug = $2`,
      [result.sanitized, slug]
    );
    res.json({ ok: true, fixedViolations: result.violations.length });
  } catch {
    res.status(500).json({ error: "Fix failed" });
  }
});

// ── LLM cost log — GET /api/seo/budget/log ───────────────────────────────────
router.get("/seo/budget/log", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rows } = await pool.query(
    `SELECT * FROM seo_llm_cost_log ORDER BY logged_at DESC LIMIT 100`
  );
  res.json({ log: rows });
});

// ── Sitemap ping — POST /api/seo/sitemap/ping ────────────────────────────────
router.post("/seo/sitemap/ping", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const sitemapUrl = encodeURIComponent("https://lightspeedghost.com/sitemap.xml");
    await Promise.allSettled([
      fetch(`https://www.google.com/ping?sitemap=${sitemapUrl}`),
      fetch(`https://www.bing.com/ping?sitemap=${sitemapUrl}`),
    ]);
    res.json({ ok: true, pinged: ["google", "bing"] });
  } catch {
    res.json({ ok: false, error: "Ping failed" });
  }
});

// ── Compliance log — GET /api/seo/dashboard/compliance ───────────────────────
router.get("/seo/dashboard/compliance", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const { rows } = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE has_ai_disclosure = true) as has_disclosure,
        COUNT(*) FILTER (WHERE integrity_check = true) as integrity_ok,
        COUNT(*) FILTER (WHERE has_faq_schema = true) as has_faq,
        COUNT(*) FILTER (WHERE word_count >= 800) as meets_word_count,
        COUNT(*) FILTER (WHERE content_html IS NOT NULL) as generated,
        COUNT(*) as total
       FROM seo_pages`
    );
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

// ── Robots.txt preview — GET /api/seo/robots/preview ─────────────────────────
router.get("/seo/robots/preview", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json({ robots: renderRobotsTxt([]) });
});

export default router;
