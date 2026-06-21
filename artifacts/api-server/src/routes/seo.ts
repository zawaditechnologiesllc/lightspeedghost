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
import {
  startPipeline,
  resumePipeline,
  getCluster,
  listClusters,
  getDailyPipelineUsage,
  getReviewQueue,
  publishCluster,
  discardCluster,
} from "../seo-engine/pipeline";
import { selectTopic } from "../seo-engine/topic-selector";
import { getSchedulerStatus, restartScheduler, triggerNow } from "../seo-engine/scheduler";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { renderRobotsTxt } from "../seo-engine/html-renderer";
import { PAGE_CATALOG } from "../seo-engine/page-catalog";
import { checkAcademicIntegrity, sanitizeContent, validatePage } from "../seo-engine/compliance-checker";
import { buildPageSchemas } from "../seo-engine/schema-engine";

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

// ── Manual page authoring — POST /api/seo/page/manual ────────────────────────
// Lets an admin write and post their OWN SEO page (human-authored) without the
// AI generator. `contentHtml` is the inner HTML for <main> (the renderer wraps
// it with the site header/footer, meta, schema and styles). Upserts by slug so
// "save draft" then "publish" from the editor is idempotent; refuses to clobber
// an existing AI-generated page that happens to share the slug.
const MANUAL_PAGE_TYPES = new Set([
  "tool", "service", "paper-type", "subject", "software-specific", "method-specific",
  "financial-analysis", "use-case", "problem-solution", "comparison", "academic-level",
  "citation-guide", "ebook-type", "ebook-platform", "how-to",
]);
const MANUAL_STATUSES = new Set(["draft", "review", "published", "archived"]);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

router.post("/seo/page/manual", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }

  const {
    slug: rawSlug, title, metaDescription = "", keywords = "",
    pageType = "how-to", contentHtml, status = "draft", faqs = [],
  } = req.body as {
    slug?: string; title?: string; metaDescription?: string;
    keywords?: string | string[]; pageType?: string; contentHtml?: string;
    status?: string; faqs?: Array<{ question: string; answer: string }>;
  };

  const slug = slugify(String(rawSlug ?? title ?? ""));
  if (!slug) { res.status(400).json({ error: "A slug or title is required" }); return; }
  if (!title || !title.trim()) { res.status(400).json({ error: "A title is required" }); return; }
  if (!contentHtml || contentHtml.trim().length < 50) {
    res.status(400).json({ error: "Page body is required — write some content first" });
    return;
  }

  const type = MANUAL_PAGE_TYPES.has(pageType) ? pageType : "how-to";
  const finalStatus = MANUAL_STATUSES.has(status) ? status : "draft";
  const published = finalStatus === "published";
  const keywordList = (Array.isArray(keywords) ? keywords : String(keywords).split(","))
    .map((k) => k.trim()).filter(Boolean);

  try {
    // Guard: don't let a manual save overwrite an AI-generated page by slug collision.
    const existing = await pool.query(
      `SELECT llm_used FROM seo_pages WHERE slug = $1`, [slug],
    );
    if (existing.rows.length > 0 && existing.rows[0].llm_used && existing.rows[0].llm_used !== "manual") {
      res.status(409).json({
        error: `The slug "${slug}" already belongs to an AI-generated page. Edit it from the Pages tab, or pick a different slug.`,
      });
      return;
    }

    const sanitized = sanitizeContent(contentHtml);
    const v = validatePage(sanitized);
    const schemaJson = JSON.stringify(
      buildPageSchemas({
        pageType: type, title, description: metaDescription, slug,
        faqs: Array.isArray(faqs) ? faqs : [],
      }),
    );

    await pool.query(
      `INSERT INTO seo_pages (
        slug, title, meta_description, content_html, schema_json, keywords, page_type,
        word_count, unique_data_points, has_faq_schema, has_ai_disclosure, integrity_check,
        llm_used, llm_cost_usd, status, published
      ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,true,$11,'manual',0,$12,$13)
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        meta_description = EXCLUDED.meta_description,
        content_html = EXCLUDED.content_html,
        schema_json = EXCLUDED.schema_json,
        keywords = EXCLUDED.keywords,
        page_type = EXCLUDED.page_type,
        word_count = EXCLUDED.word_count,
        unique_data_points = EXCLUDED.unique_data_points,
        has_faq_schema = EXCLUDED.has_faq_schema,
        integrity_check = EXCLUDED.integrity_check,
        status = EXCLUDED.status,
        published = EXCLUDED.published,
        updated_at = now()`,
      [
        slug, title, metaDescription, sanitized, schemaJson, keywordList, type,
        v.wordCount, v.uniqueDataPoints, v.hasFAQ, v.integrityCheck,
        finalStatus, published,
      ],
    );

    logger.info({ slug, status: finalStatus, wordCount: v.wordCount }, "[seo-api] Manual page saved");
    res.json({ ok: true, slug, status: finalStatus, published, wordCount: v.wordCount, url: `/seo/${slug}` });
  } catch (err) {
    logger.error({ err }, "[seo-api] POST /seo/page/manual failed");
    res.status(500).json({ error: "Failed to save page" });
  }
});

// ── Rule check (no save) — POST /api/seo/page/check ──────────────────────────
// Runs the SAME compliance + quality validation used at save time, so the Write
// tab can show a live pass/fail report the moment you paste a blog. Pure regex,
// no LLM, no cost — safe to call on every keystroke (debounced client-side).
router.post("/seo/page/check", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { contentHtml } = req.body as { contentHtml?: string };
  if (typeof contentHtml !== "string") { res.status(400).json({ error: "contentHtml required" }); return; }

  const integrity = checkAcademicIntegrity(contentHtml);
  const v = validatePage(contentHtml);

  res.json({
    passed:           integrity.passed && v.wordCount >= 800 && v.uniqueDataPoints >= 8 && v.hasFAQ,
    wordCount:        v.wordCount,
    uniqueDataPoints: v.uniqueDataPoints,
    hasFAQ:           v.hasFAQ,
    hasAIDisclosure:  v.hasAIDisclosure,
    integrityPassed:  integrity.passed,
    violations:       integrity.violations,   // prohibited phrases/patterns detected
    issues:           v.issues,               // quality gaps (word count, data points, FAQ…)
    willRewrite:      integrity.sanitized !== contentHtml, // sanitiser will edit on publish
  });
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
// Responds instantly; the Gemini generation (10–30s) runs in the background and
// the page shows up in Pages/Review when done.
router.post("/seo/generate-page", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { slug, autoPublish = false } = req.body;
  if (!slug) { res.status(400).json({ error: "slug required" }); return; }
  res.status(202).json({ ok: true, slug, message: "Generating — the page appears in Pages/Review when it's done" });
  setImmediate(() => {
    generatePage(slug, { autoPublish }).catch((err) => logger.error({ err, slug }, "[seo-api] generate-page failed"));
  });
});

// ── Batch generate — POST /api/seo/generate-batch ────────────────────────────
// Responds instantly; the batch (a series of Gemini calls — minutes) runs in the
// background. Guarded so a second click doesn't start an overlapping batch.
let batchInFlight = false;
router.post("/seo/generate-batch", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { slugs, type, limit = 10, autoPublish = false } = req.body;
  if (batchInFlight) {
    res.status(200).json({ ok: true, started: false, message: "A batch is already generating — refresh Pages/Review for progress" });
    return;
  }
  res.status(202).json({ ok: true, started: true, message: "Batch started — pages appear in Pages/Review as they finish" });
  batchInFlight = true;
  setImmediate(async () => {
    try {
      const result = await generateBatch({ slugs, type, limit, autoPublish });
      logger.info({ generated: result.results.filter((r) => r.success).length, cost: result.totalCost }, "[seo-api] generate-batch complete");
    } catch (err) {
      logger.error({ err }, "[seo-api] generate-batch failed");
    } finally {
      batchInFlight = false;
    }
  });
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

// ══════════════════════════════════════════════════════════════════════════════
// Pipeline API — 3-step article cluster generation
// ══════════════════════════════════════════════════════════════════════════════

// ── Daily pipeline usage — GET /api/seo/pipeline/daily-limit ─────────────────
router.get("/seo/pipeline/daily-limit", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    res.json(await getDailyPipelineUsage());
  } catch {
    res.status(500).json({ error: "Failed to fetch daily usage" });
  }
});

// ── List clusters — GET /api/seo/pipeline/clusters ───────────────────────────
router.get("/seo/pipeline/clusters", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const limit = parseInt(String(req.query.limit ?? "30"));
    res.json({ clusters: await listClusters(limit) });
  } catch (err) {
    logger.error({ err }, "[seo-api] GET /seo/pipeline/clusters failed");
    res.status(500).json({ error: "Failed to fetch clusters" });
  }
});

// ── Get single cluster — GET /api/seo/pipeline/cluster/:id ───────────────────
router.get("/seo/pipeline/cluster/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const cluster = await getCluster(req.params.id);
    if (!cluster) { res.status(404).json({ error: "Cluster not found" }); return; }
    res.json(cluster);
  } catch (err) {
    logger.error({ err }, "[seo-api] GET /seo/pipeline/cluster/:id failed");
    res.status(500).json({ error: "Failed to fetch cluster" });
  }
});

// ── Start pipeline — POST /api/seo/pipeline/start ────────────────────────────
// If topic is omitted or blank, AI selects the best topic automatically.
// Competitor is always AI-selected during the research phase.
router.post("/seo/pipeline/start", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }

  const { topic, toolFocus, audienceSegment, autoPublish } = req.body as {
    topic?:           string;
    toolFocus?:       string;
    audienceSegment?: string;
    autoPublish?:     boolean;
  };

  try {
    let resolvedTopic           = topic?.trim() ?? "";
    let resolvedToolFocus       = toolFocus ?? "";
    let resolvedAudienceSegment = audienceSegment?.trim() ?? "students";

    // If no topic provided, let AI pick the best one using GSC/GA4/catalog data
    if (!resolvedTopic) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(400).json({ error: "Either provide a topic or configure GEMINI_API_KEY for AI topic selection" });
        return;
      }
      const gemini = new GoogleGenerativeAI(apiKey);
      const selection = await selectTopic(gemini);
      resolvedTopic           = selection.topic;
      resolvedToolFocus       = resolvedToolFocus || selection.toolFocus;
      resolvedAudienceSegment = resolvedAudienceSegment || selection.audienceSegment;
      logger.info({ topic: resolvedTopic, toolFocus: resolvedToolFocus, source: selection.dataSource }, "[seo-api] AI-selected topic");
    }

    if (!resolvedToolFocus) {
      res.status(400).json({ error: "toolFocus is required when topic is manually specified" });
      return;
    }

    const result = await startPipeline({
      topic:           resolvedTopic,
      toolFocus:       resolvedToolFocus,
      audienceSegment: resolvedAudienceSegment,
      autoPublish:     Boolean(autoPublish),
    });

    if (result.error) {
      res.status(429).json({ error: result.error });
      return;
    }

    res.status(202).json({
      clusterId: result.clusterId,
      topic:     resolvedTopic,
      message:   "Pipeline started — pages will appear in review queue when complete",
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "[seo-api] POST /seo/pipeline/start failed");
    res.status(500).json({ error });
  }
});

// ── Resume failed pipeline — POST /api/seo/pipeline/cluster/:id/resume ───────
router.post("/seo/pipeline/cluster/:id/resume", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    await resumePipeline(req.params.id, { autoPublish: Boolean(req.body?.autoPublish) });
    res.json({ ok: true, message: "Pipeline resumed" });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error });
  }
});

// ── Review queue — GET /api/seo/pipeline/review-queue ────────────────────────
router.get("/seo/pipeline/review-queue", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const clusters = await getReviewQueue();
    res.json({ clusters, count: clusters.length });
  } catch (err) {
    logger.error({ err }, "[seo-api] GET /seo/pipeline/review-queue failed");
    res.status(500).json({ error: "Failed to fetch review queue" });
  }
});

// ── Publish cluster — POST /api/seo/pipeline/cluster/:id/publish-all ─────────
router.post("/seo/pipeline/cluster/:id/publish-all", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const published = await publishCluster(req.params.id);
    res.json({ ok: true, published, message: `${published} pages published` });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error });
  }
});

// ── Discard cluster — POST /api/seo/pipeline/cluster/:id/discard ─────────────
router.post("/seo/pipeline/cluster/:id/discard", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const discarded = await discardCluster(req.params.id);
    res.json({ ok: true, discarded, message: `${discarded} pages moved to draft` });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error });
  }
});

// ── Scheduler status — GET /api/seo/scheduler/status ─────────────────────────
router.get("/seo/scheduler/status", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    res.json(await getSchedulerStatus());
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scheduler status" });
  }
});

// ── Update scheduler settings — PATCH /api/seo/scheduler/settings ─────────────
router.patch("/seo/scheduler/settings", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { enabled, time } = req.body as { enabled?: boolean; time?: string };
  try {
    const updates: Array<[string, string]> = [];
    if (enabled !== undefined) updates.push(["scheduler_enabled", String(enabled)]);
    if (time !== undefined && /^\d{2}:\d{2}$/.test(time)) updates.push(["scheduler_time", time]);

    for (const [key, value] of updates) {
      await pool.query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value],
      );
    }

    restartScheduler();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save scheduler settings" });
  }
});

// ── Manual trigger — POST /api/seo/scheduler/trigger ─────────────────────────
router.post("/seo/scheduler/trigger", async (req: Request, res: Response) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  res.status(202).json({ message: "Scheduled pipeline triggered — check review queue in ~3 minutes" });
  // Run async after response
  setImmediate(() => {
    triggerNow().catch((err) => logger.error({ err }, "[seo-api] Manual trigger failed"));
  });
});

// NOTE: the external cron trigger (/api/seo/cron/run) lives in seo-public.ts so it
// is mounted BEFORE the CORS allowlist — UptimeRobot and other server-to-server
// pingers send no Origin header and would otherwise be rejected by CORS here.

export default router;
