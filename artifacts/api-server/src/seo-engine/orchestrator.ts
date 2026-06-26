import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { generatePageContent } from "./content-generator";
import { validatePage } from "./compliance-checker";
import { incrementPageCount } from "./budget-tracker";
import { PAGE_CATALOG, getPageSpec, type PageSpec } from "./page-catalog";

// Catalog batch limit is separate from the pipeline's 5-page/24hr limit.
// Default 30/run matches the operator guide, the Settings tab, and the Catalog
// generator's max — override with SEO_DAILY_PAGE_LIMIT.
const MAX_DAILY_PAGES = parseInt(process.env.SEO_DAILY_PAGE_LIMIT ?? "30");

// ── Seed catalog to DB ────────────────────────────────────────────────────────
export async function seedCatalog(): Promise<{ seeded: number; existing: number }> {
  let seeded = 0;
  let existing = 0;

  for (const spec of PAGE_CATALOG) {
    const { rows } = await pool.query(
      `SELECT id FROM seo_pages WHERE slug = $1`,
      [spec.slug]
    );

    if (rows.length > 0) {
      existing++;
      continue;
    }

    await pool.query(
      `INSERT INTO seo_pages (
        slug, title, meta_description, keywords, page_type, audience_segment,
        tool_focus, software_focus, paper_type_focus, financial_focus,
        published, status, has_ai_disclosure, integrity_check
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,'draft',false,false)`,
      [
        spec.slug,
        spec.title,
        spec.metaDescription,
        spec.keywords,
        spec.type,
        spec.audienceSegment ?? null,
        spec.toolFocus ?? null,
        spec.softwareFocus ?? null,
        spec.paperTypeFocus ?? null,
        spec.financialFocus ?? null,
      ]
    );
    seeded++;
  }

  logger.info({ seeded, existing }, "[seo-orchestrator] Catalog seed complete");
  return { seeded, existing };
}

// ── Generate a single page ─────────────────────────────────────────────────────
export async function generatePage(slug: string, opts: { autoPublish?: boolean } = {}): Promise<{
  success: boolean;
  slug: string;
  wordCount?: number;
  model?: string;
  costUsd?: number;
  error?: string;
}> {
  const spec = getPageSpec(slug);
  if (!spec) return { success: false, slug, error: "Slug not in catalog" };

  try {
    let attempts = 0;
    let result = await generatePageContent(spec);

    while (!result.validationPassed && attempts < 2) {
      logger.warn({ slug, attempts, wordCount: result.wordCount }, "[seo-orchestrator] Validation failed, retrying");
      attempts++;
      result = await generatePageContent(spec, attempts);
    }

    const validation = validatePage(result.html);

    await pool.query(
      `UPDATE seo_pages SET
        title = $1,
        meta_description = $2,
        content_html = $3,
        schema_json = $4::jsonb,
        word_count = $5,
        unique_data_points = $6,
        has_faq_schema = $7,
        has_ai_disclosure = $8,
        integrity_check = $9,
        llm_used = $10,
        llm_cost_usd = $11,
        status = $12,
        published = $13,
        updated_at = now()
       WHERE slug = $14`,
      [
        spec.title,
        spec.metaDescription,
        result.html,
        result.schemaJson,
        result.wordCount,
        validation.uniqueDataPoints,
        validation.hasFAQ,
        validation.hasAIDisclosure,
        validation.integrityCheck,
        result.model,
        result.costUsd,
        opts.autoPublish ? "published" : "review",
        opts.autoPublish ? true : false,
        slug,
      ]
    );

    // Also upsert if row doesn't exist yet
    const { rows } = await pool.query(`SELECT id FROM seo_pages WHERE slug = $1`, [slug]);
    if (rows.length === 0) {
      await pool.query(
        `INSERT INTO seo_pages (
          slug, title, meta_description, content_html, schema_json, keywords, page_type,
          tool_focus, software_focus, paper_type_focus, financial_focus, audience_segment,
          word_count, unique_data_points, has_faq_schema, has_ai_disclosure, integrity_check,
          llm_used, llm_cost_usd, status, published
        ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [
          slug, spec.title, spec.metaDescription, result.html, result.schemaJson,
          spec.keywords, spec.type, spec.toolFocus ?? null, spec.softwareFocus ?? null,
          spec.paperTypeFocus ?? null, spec.financialFocus ?? null, spec.audienceSegment ?? null,
          result.wordCount, validation.uniqueDataPoints, validation.hasFAQ,
          validation.hasAIDisclosure, validation.integrityCheck,
          result.model, result.costUsd,
          opts.autoPublish ? "published" : "review",
          opts.autoPublish ?? false,
        ]
      );
    }

    await incrementPageCount();

    logger.info({ slug, wordCount: result.wordCount, model: result.model, costUsd: result.costUsd }, "[seo-orchestrator] Page generated");
    return { success: true, slug, wordCount: result.wordCount, model: result.model, costUsd: result.costUsd };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ err, slug }, "[seo-orchestrator] Page generation failed");

    await pool.query(
      `UPDATE seo_pages SET status = 'draft', updated_at = now() WHERE slug = $1`,
      [slug]
    );

    return { success: false, slug, error };
  }
}

// ── Batch generate pages ───────────────────────────────────────────────────────
export async function generateBatch(opts: {
  slugs?: string[];
  type?: string;
  limit?: number;
  autoPublish?: boolean;
}): Promise<{
  results: Array<{ slug: string; success: boolean; error?: string }>;
  totalCost: number;
}> {
  const limit = Math.min(opts.limit ?? MAX_DAILY_PAGES, MAX_DAILY_PAGES);
  let slugs: string[];

  if (opts.slugs && opts.slugs.length > 0) {
    slugs = opts.slugs.slice(0, limit);
  } else if (opts.type) {
    const matches = PAGE_CATALOG.filter((p) => p.type === opts.type);
    slugs = matches.slice(0, limit).map((p) => p.slug);
  } else {
    // Default: generate draft pages in priority order
    const { rows } = await pool.query(
      `SELECT slug FROM seo_pages WHERE status = 'draft' AND content_html IS NULL
       ORDER BY created_at ASC LIMIT $1`,
      [limit]
    );
    slugs = rows.map((r: { slug: string }) => r.slug);

    // If no DB slugs, take from catalog
    if (slugs.length === 0) {
      slugs = PAGE_CATALOG.filter((p) => {
        return p.type === "tool" || p.type === "service";
      }).slice(0, limit).map((p) => p.slug);
    }
  }

  const results: Array<{ slug: string; success: boolean; error?: string }> = [];
  let totalCost = 0;

  for (const slug of slugs) {
    const result = await generatePage(slug, { autoPublish: opts.autoPublish });
    results.push({ slug, success: result.success, error: result.error });
    if (result.costUsd) totalCost += result.costUsd;

    // Small delay to avoid rate limiting
    await new Promise((res) => setTimeout(res, 500));
  }

  return { results, totalCost };
}

// ── Publish / unpublish ─────────────────────────────────────────────────────
export async function publishPage(slug: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE seo_pages SET published = true, status = 'published', updated_at = now() WHERE slug = $1`,
    [slug]
  );
  return (rowCount ?? 0) > 0;
}

export async function unpublishPage(slug: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE seo_pages SET published = false, status = 'draft', updated_at = now() WHERE slug = $1`,
    [slug]
  );
  return (rowCount ?? 0) > 0;
}

// ── Get page for serving ───────────────────────────────────────────────────────
export async function getPublishedPage(slug: string): Promise<{
  slug: string;
  title: string;
  metaDescription: string;
  contentHtml: string;
  schemaJson: string;
  keywords: string[];
  updatedAt: Date;
} | null> {
  const { rows } = await pool.query(
    `SELECT slug, title, meta_description, content_html, schema_json::text as schema_json,
            keywords, updated_at FROM seo_pages WHERE slug = $1 AND published = true`,
    [slug]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    slug: r.slug,
    title: r.title,
    metaDescription: r.meta_description,
    contentHtml: r.content_html ?? "",
    schemaJson: r.schema_json ?? "[]",
    keywords: r.keywords ?? [],
    updatedAt: new Date(r.updated_at),
  };
}

// ── Dashboard summary ──────────────────────────────────────────────────────────
export async function getDashboardSummary() {
  const { rows: counts } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'published') as published,
      COUNT(*) FILTER (WHERE status = 'review') as review,
      COUNT(*) FILTER (WHERE status = 'draft') as draft,
      COUNT(*) FILTER (WHERE integrity_check = false AND content_html IS NOT NULL) as integrity_issues,
      COUNT(*) FILTER (WHERE has_ai_disclosure = false AND content_html IS NOT NULL) as missing_disclosure,
      COUNT(*) as total
    FROM seo_pages
  `);

  // Budget is queried separately so a budget-table problem can't zero out the
  // page counts above (which previously made the whole dashboard read 0/0/0/0).
  let budgetRow: Record<string, unknown> | null = null;
  try {
    const { rows: budget } = await pool.query(`
      SELECT total_spend_usd, budget_limit_usd, pages_generated, upgraded
      FROM seo_budget_status
      WHERE month = to_char(now(), 'YYYY-MM')
    `);
    budgetRow = budget[0] ?? null;
  } catch { /* budget unavailable — page counts still return */ }

  return {
    pages: counts[0],
    budget: budgetRow ?? { total_spend_usd: 0, budget_limit_usd: 8, pages_generated: 0, upgraded: false },
  };
}
