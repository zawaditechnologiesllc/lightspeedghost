/**
 * SEO Public Router — mounted directly on the Express app (not under /api).
 * Handles: GET /robots.txt, GET /sitemap.xml, GET /seo/:slug
 * These MUST be served at root paths, not under /api, for crawlers to find them.
 */
import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { renderFullPage, renderRobotsTxt, renderSitemapXml, STATIC_PAGES } from "../seo-engine/html-renderer";
import { getPageSpec } from "../seo-engine/page-catalog";
import { getPublishedPage } from "../seo-engine/orchestrator";
import { triggerNow } from "../seo-engine/scheduler";

const publicRouter = Router();

// ── External cron trigger — GET|POST /api/seo/cron/run ───────────────────────
// Lives here (in the pre-CORS public router) so UptimeRobot / cron-job.org —
// which send no Origin header — aren't blocked by the browser CORS allowlist.
// Token-authenticated; runs the daily AI pipeline without admin credentials.
// Idempotent per day (skips if a cluster already ran in the last ~20h), responds
// immediately and generates in the background, and each ping keeps the free-tier
// server awake. Set SEO_CRON_TOKEN in the backend env to enable it.
let cronInFlight = false;

async function handleSeoCron(req: Request, res: Response): Promise<void> {
  const secret = process.env.SEO_CRON_TOKEN;
  if (!secret) {
    res.status(503).json({ ok: false, error: "SEO_CRON_TOKEN is not configured on the server" });
    return;
  }
  const provided =
    (req.query.token as string | undefined) ??
    (req.headers["x-cron-token"] as string | undefined) ?? "";
  if (provided !== secret) {
    res.status(403).json({ ok: false, error: "Invalid or missing cron token" });
    return;
  }
  if (!process.env.GEMINI_API_KEY) {
    res.status(200).json({ ok: false, skipped: "GEMINI_API_KEY not set — nothing to generate" });
    return;
  }
  if (cronInFlight) {
    res.status(200).json({ ok: true, skipped: "A generation run is already in progress" });
    return;
  }

  res.status(202).json({ ok: true, message: "SEO cron accepted — generating if due (skips if it already ran today)" });
  cronInFlight = true;
  setImmediate(async () => {
    try {
      const result = await triggerNow();
      logger.info({ result }, "[seo-cron] Cron trigger complete");
    } catch (err) {
      logger.error({ err }, "[seo-cron] Cron trigger failed");
    } finally {
      cronInFlight = false;
    }
  });
}

publicRouter.get("/api/seo/cron/run", handleSeoCron);
publicRouter.post("/api/seo/cron/run", handleSeoCron);

// ── robots.txt — served dynamically ──────────────────────────────────────────
publicRouter.get("/robots.txt", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT slug FROM seo_pages WHERE published = true ORDER BY updated_at DESC`
    );
    const slugs = rows.map((r: { slug: string }) => r.slug);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(renderRobotsTxt(slugs));
  } catch {
    res.setHeader("Content-Type", "text/plain");
    res.send("User-agent: *\nAllow: /\nSitemap: https://lightspeedghost.com/sitemap.xml");
  }
});

// ── sitemap.xml — dynamic with all SEO pages ─────────────────────────────────
publicRouter.get("/sitemap.xml", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT slug, page_type, updated_at FROM seo_pages WHERE published = true ORDER BY updated_at DESC`
    );

    const priorityMap: Record<string, number> = {
      tool: 1.0, service: 1.0,
      "paper-type": 0.9, "software-specific": 0.9, "financial-analysis": 0.9,
      comparison: 0.8, "academic-level": 0.8, "method-specific": 0.8, "use-case": 0.8,
      subject: 0.7, "ebook-type": 0.7, "ebook-platform": 0.7, "problem-solution": 0.7,
      "citation-guide": 0.6, "how-to": 0.7,
    };

    const seoPages = rows.map((r: { slug: string; page_type: string; updated_at: string }) => ({
      slug: r.slug,
      priority: priorityMap[r.page_type] ?? 0.7,
      updatedAt: new Date(r.updated_at),
    }));

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(renderSitemapXml({ staticPages: STATIC_PAGES, seoPages }));
  } catch (err) {
    logger.error({ err }, "[seo] sitemap.xml error");
    res.status(500).send("<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'/>");
  }
});

// ── Public: serve rendered SEO page ──────────────────────────────────────────
publicRouter.get("/seo/:slug", async (req: Request, res: Response) => {
  const slug = String(req.params.slug);

  try {
    const page = await getPublishedPage(slug);
    if (!page) {
      res.status(404).send("Page not found");
      return;
    }

    const spec = getPageSpec(slug) ?? {
      slug,
      type: "tool" as const,
      title: page.title,
      metaDescription: page.metaDescription,
      keywords: page.keywords,
      priority: 0.7,
    };

    const html = renderFullPage({
      spec,
      contentHtml: page.contentHtml,
      schemaJson: page.schemaJson,
      canonicalSlug: slug,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(html);
  } catch (err) {
    logger.error({ err, slug }, "[seo] Page serve error");
    res.status(500).send("Internal error");
  }
});

export default publicRouter;
