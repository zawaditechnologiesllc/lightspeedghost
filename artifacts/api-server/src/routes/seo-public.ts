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

const publicRouter = Router();

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
  const { slug } = req.params;

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
