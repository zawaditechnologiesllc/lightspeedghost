-- SEO Pipeline Migration
-- Adds 5-page article cluster support to the SEO engine.
-- Run AFTER the base seo-migrations.sql
-- psql $DATABASE_URL -f scripts/seo-pipeline-migration.sql

BEGIN;

-- ── Extend seo_pages.page_type to include cluster page types ─────────────────

ALTER TABLE seo_pages DROP CONSTRAINT IF EXISTS seo_pages_page_type_check;

ALTER TABLE seo_pages
  ADD CONSTRAINT seo_pages_page_type_check CHECK (page_type IN (
    -- original types
    'tool','service','paper-type','subject','software-specific',
    'method-specific','financial-analysis','use-case',
    'problem-solution','comparison','academic-level',
    'citation-guide','ebook-type','ebook-platform','how-to',
    -- new cluster page types
    'cluster-hook','cluster-comparison','cluster-breakdown',
    'cluster-alternative','cluster-trust'
  ));

-- ── seo_article_clusters ──────────────────────────────────────────────────────
-- Represents one 5-page article cluster (one topic = one cluster = 5 pages)

CREATE TABLE IF NOT EXISTS seo_article_clusters (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic             text        NOT NULL,
  topic_slug        text        UNIQUE NOT NULL,
  tool_focus        text        NOT NULL,
  competitor        text        NOT NULL DEFAULT 'ChatGPT',
  audience_segment  text        NOT NULL DEFAULT 'students',

  status            text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                      'pending','researching','outlining',
                      'writing_1','writing_2','writing_3','writing_4','writing_5',
                      'complete','failed'
                    )),
  current_stage     text        NOT NULL DEFAULT 'research',

  research_data     jsonb,
  outline_data      jsonb,

  pages_completed   int         NOT NULL DEFAULT 0,
  error_message     text,

  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Add cluster columns to seo_pages ─────────────────────────────────────────

ALTER TABLE seo_pages
  ADD COLUMN IF NOT EXISTS cluster_id          uuid
    REFERENCES seo_article_clusters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cluster_page_type   text
    CHECK (cluster_page_type IN ('hook','comparison','breakdown','alternative','trust')),
  ADD COLUMN IF NOT EXISTS cluster_page_number int
    CHECK (cluster_page_number BETWEEN 1 AND 5);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_seo_clusters_status
  ON seo_article_clusters(status);

CREATE INDEX IF NOT EXISTS idx_seo_clusters_created
  ON seo_article_clusters(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_clusters_tool
  ON seo_article_clusters(tool_focus);

CREATE INDEX IF NOT EXISTS idx_seo_pages_cluster
  ON seo_pages(cluster_id);

CREATE INDEX IF NOT EXISTS idx_seo_pages_cluster_type
  ON seo_pages(cluster_page_type);

COMMIT;

-- ── Notes ─────────────────────────────────────────────────────────────────────
-- Daily pipeline limit:  5 pages per 24 hours (= 1 article cluster per day)
-- Model:                 Gemini 2.5 Pro exclusively
-- Steps:                 1. Research (Reddit + Gemini), 2. Outline, 3. Write ×5
-- Page types generated:  hook, comparison, breakdown, alternative, trust
-- Served at:             GET /seo/{slug} (same public route as catalog pages)
