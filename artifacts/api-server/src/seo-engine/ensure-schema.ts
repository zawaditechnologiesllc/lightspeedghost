/**
 * Idempotent SEO schema bootstrap.
 *
 * The SEO engine's tables normally come from scripts/seo-migrations.sql +
 * scripts/seo-pipeline-migration.sql, which are run by hand. On any deployment
 * where those weren't (fully) applied, the admin's SEO tabs fail in confusing
 * ways: the dashboard shows all-zeros (the budget query throws), the review
 * queue 500s (seo_article_clusters missing), and pipeline page writes silently
 * fail because the seo_pages.page_type CHECK constraint rejects the
 * 'cluster-*' page types the generator produces.
 *
 * This runs the same DDL on boot, statement-by-statement and fault-tolerant, so
 * a missing table or stale constraint self-heals instead of breaking the panel.
 * Every statement is CREATE/ALTER ... IF NOT EXISTS (or a constraint swap), so
 * it is safe to run on every start and never touches existing data.
 */
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

async function run(label: string, sql: string): Promise<void> {
  try {
    await pool.query(sql);
  } catch (err) {
    // Non-fatal: log and continue so one bad step doesn't block the rest.
    logger.warn({ err, label }, "[seo-schema] step skipped");
  }
}

export async function ensureSeoSchema(): Promise<void> {
  // 1. Clusters first — seo_pages.cluster_id references it.
  await run("clusters", `
    CREATE TABLE IF NOT EXISTS seo_article_clusters (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      topic             text NOT NULL,
      topic_slug        text UNIQUE NOT NULL,
      tool_focus        text NOT NULL,
      competitor        text NOT NULL DEFAULT 'ChatGPT',
      audience_segment  text NOT NULL DEFAULT 'students',
      status            text NOT NULL DEFAULT 'pending',
      current_stage     text NOT NULL DEFAULT 'research',
      research_data     jsonb,
      outline_data      jsonb,
      pages_completed   int  NOT NULL DEFAULT 0,
      error_message     text,
      started_at        timestamptz,
      completed_at      timestamptz,
      created_at        timestamptz NOT NULL DEFAULT now(),
      updated_at        timestamptz NOT NULL DEFAULT now()
    )
  `);

  // 2. Pages — created with the full page_type allow-list (base + cluster).
  await run("pages", `
    CREATE TABLE IF NOT EXISTS seo_pages (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug                text UNIQUE NOT NULL,
      title               text,
      meta_description    text,
      content_html        text,
      keywords            text[],
      page_type           text,
      audience_segment    text,
      tool_focus          text,
      software_focus      text,
      paper_type_focus    text,
      financial_focus     text,
      schema_json         jsonb,
      cta_type            text,
      word_count          int,
      unique_data_points  int,
      has_faq_schema      boolean DEFAULT false,
      has_comparison      boolean DEFAULT false,
      has_ai_disclosure   boolean DEFAULT false,
      accessibility_score int,
      integrity_check     boolean DEFAULT false,
      published           boolean DEFAULT false,
      status              text DEFAULT 'draft',
      llm_used            text,
      llm_cost_usd        decimal(10,6),
      cluster_id          uuid,
      cluster_page_type   text,
      cluster_page_number int,
      created_at          timestamptz DEFAULT now(),
      updated_at          timestamptz DEFAULT now()
    )
  `);

  // 3. Backfill columns older deployments may lack (safe no-ops if present).
  await run("pages.cluster_id",          `ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS cluster_id uuid`);
  await run("pages.cluster_page_type",   `ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS cluster_page_type text`);
  await run("pages.cluster_page_number", `ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS cluster_page_number int`);
  await run("pages.schema_json",         `ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS schema_json jsonb`);
  await run("pages.status",              `ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft'`);
  await run("pages.published",           `ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS published boolean DEFAULT false`);

  // 4. Swap the page_type CHECK for the superset that includes cluster types.
  //    Worst case (swap fails) leaves the column unconstrained — which still
  //    lets the generator's 'cluster-*' inserts through, so the pipeline works.
  await run("page_type.drop", `ALTER TABLE seo_pages DROP CONSTRAINT IF EXISTS seo_pages_page_type_check`);
  await run("page_type.add", `
    ALTER TABLE seo_pages ADD CONSTRAINT seo_pages_page_type_check CHECK (page_type IN (
      'tool','service','paper-type','subject','software-specific',
      'method-specific','financial-analysis','use-case',
      'problem-solution','comparison','academic-level',
      'citation-guide','ebook-type','ebook-platform','how-to',
      'cluster-hook','cluster-comparison','cluster-breakdown',
      'cluster-alternative','cluster-trust'
    ))
  `);

  // 5. Budget + cost log — the dashboard summary and budget tracker read these.
  await run("budget_status", `
    CREATE TABLE IF NOT EXISTS seo_budget_status (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      month            text UNIQUE,
      gemini_spend_usd decimal(10,4) DEFAULT 0,
      claude_spend_usd decimal(10,4) DEFAULT 0,
      total_spend_usd  decimal(10,4) DEFAULT 0,
      budget_limit_usd decimal(10,4) DEFAULT 8.00,
      pages_generated  int DEFAULT 0,
      upgraded         boolean DEFAULT false,
      updated_at       timestamptz DEFAULT now()
    )
  `);
  await run("cost_log", `
    CREATE TABLE IF NOT EXISTS seo_llm_cost_log (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_type     text,
      model_used    text,
      input_tokens  int,
      output_tokens int,
      cost_usd      decimal(10,6),
      page_slug     text,
      logged_at     timestamptz DEFAULT now()
    )
  `);

  // 6. Indexes the hot paths use.
  await run("idx.status",    `CREATE INDEX IF NOT EXISTS idx_seo_pages_status ON seo_pages(status)`);
  await run("idx.published", `CREATE INDEX IF NOT EXISTS idx_seo_pages_published ON seo_pages(published)`);
  await run("idx.cluster",   `CREATE INDEX IF NOT EXISTS idx_seo_pages_cluster ON seo_pages(cluster_id)`);
  await run("idx.clstatus",  `CREATE INDEX IF NOT EXISTS idx_seo_clusters_status ON seo_article_clusters(status)`);
}
