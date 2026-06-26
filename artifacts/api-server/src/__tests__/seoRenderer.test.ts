/**
 * SEO renderer tests — robots.txt + sitemap.xml
 *
 * These guard the crawl-facing output that the SEO programme depends on:
 *  - robots.txt must advertise BOTH sitemaps (marketing + SEO) and allow the
 *    search/AI crawlers we want indexing/citing our pages, while disallowing
 *    /api/ and the auth-gated tool routes.
 *  - sitemap.xml must emit well-formed entries for every published SEO page.
 *
 * They import the real functions (no DB/network needed — both are pure).
 */
import { describe, it, expect } from "vitest";
import { renderRobotsTxt, renderSitemapXml, STATIC_PAGES } from "../seo-engine/html-renderer";

describe("renderRobotsTxt", () => {
  const robots = renderRobotsTxt();

  it("advertises both the marketing and SEO sitemaps", () => {
    expect(robots).toContain("Sitemap: https://lightspeedghost.com/sitemap.xml");
    expect(robots).toContain("Sitemap: https://lightspeedghost.com/seo-sitemap.xml");
  });

  it("allows the core search engines", () => {
    expect(robots).toMatch(/User-agent: Googlebot/);
    expect(robots).toMatch(/User-agent: bingbot/);
  });

  it("allows AI answer engines (they drive citations/referrals)", () => {
    for (const bot of ["GPTBot", "OAI-SearchBot", "PerplexityBot", "ClaudeBot", "anthropic-ai"]) {
      expect(robots).toContain(`User-agent: ${bot}`);
    }
    // None of the allowed AI bots should be given a blanket site-wide block.
    expect(robots).not.toMatch(/User-agent: GPTBot\nDisallow: \/\n/);
  });

  it("disallows /api/ and the auth-gated tool routes", () => {
    expect(robots).toContain("Disallow: /api/");
    for (const route of ["/admin", "/write", "/stem", "/billing"]) {
      expect(robots).toContain(`Disallow: ${route}`);
    }
  });

  it("opens with a wildcard user-agent group", () => {
    expect(robots.startsWith("User-agent: *")).toBe(true);
  });
});

describe("renderSitemapXml", () => {
  it("emits a valid urlset containing static + SEO pages", () => {
    const xml = renderSitemapXml({
      staticPages: STATIC_PAGES,
      seoPages: [
        { slug: "ai-paper-writer", priority: 1.0, updatedAt: new Date("2026-01-15T00:00:00Z") },
        { slug: "chatgpt-vs-lightspeed", priority: 0.8, updatedAt: new Date("2026-02-20T00:00:00Z") },
      ],
    });

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<urlset");
    expect(xml).toContain("</urlset>");
    // Static homepage present
    expect(xml).toContain("<loc>https://lightspeedghost.com/</loc>");
    // Both SEO pages rendered at their canonical /seo/<slug> URL
    expect(xml).toContain("<loc>https://lightspeedghost.com/seo/ai-paper-writer</loc>");
    expect(xml).toContain("<loc>https://lightspeedghost.com/seo/chatgpt-vs-lightspeed</loc>");
    // Priority is formatted to one decimal and lastmod uses the page's date
    expect(xml).toContain("<priority>1.0</priority>");
    expect(xml).toContain("<lastmod>2026-02-20</lastmod>");
  });

  it("renders a urlset even when there are no SEO pages yet", () => {
    const xml = renderSitemapXml({ staticPages: STATIC_PAGES, seoPages: [] });
    expect(xml).toContain("<urlset");
    expect(xml).toContain("</urlset>");
    expect(xml).toContain("(0 published)");
  });
});
