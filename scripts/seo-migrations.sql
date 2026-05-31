-- LightspeedGhost SEO Engine — Database Migration
-- All tables prefixed with seo_ as per spec
-- Run once against your PostgreSQL database (Supabase or Replit-hosted)

BEGIN;

-- ── seo_pages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_pages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text UNIQUE NOT NULL,
  title               text,
  meta_description    text,
  content_html        text,
  keywords            text[],
  page_type           text CHECK (page_type IN (
    'tool','service','paper-type','subject','software-specific',
    'method-specific','financial-analysis','use-case',
    'problem-solution','comparison','academic-level',
    'citation-guide','ebook-type','ebook-platform','how-to')),
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
  status              text DEFAULT 'draft' CHECK (
    status IN ('draft','review','published','archived')),
  llm_used            text,
  llm_cost_usd        decimal(10,6),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ── seo_llm_cost_log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_llm_cost_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type     text,
  model_used    text,
  input_tokens  int,
  output_tokens int,
  cost_usd      decimal(10,6),
  page_slug     text,
  logged_at     timestamptz DEFAULT now()
);

-- ── seo_budget_status ─────────────────────────────────────────────────────────
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
);

-- ── seo_crawl_results ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_crawl_results (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url                  text NOT NULL,
  final_url            text,
  status_code          int,
  title                text,
  meta_description     text,
  h1                   text,
  headings             jsonb,
  canonical            text,
  images               jsonb,
  internal_links       jsonb,
  external_links       jsonb,
  schema_found         jsonb,
  js_rendering         text,
  word_count           int,
  has_ai_disclosure    boolean,
  has_prohibited_lang  boolean,
  accessibility_issues jsonb,
  wcag_violations      jsonb,
  crawled_at           timestamptz DEFAULT now(),
  browser_engine       text
);

-- ── seo_audit_issues ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_audit_issues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url             text,
  issue_type      text,
  severity        text CHECK (severity IN ('critical','warning','opportunity','compliance')),
  description     text,
  suggested_fix   text,
  compliance_law  text,
  wcag_criterion  text,
  status          text DEFAULT 'open' CHECK (status IN ('open','fixed','ignored')),
  detected_at     timestamptz DEFAULT now(),
  fixed_at        timestamptz
);

-- ── seo_performance_scores ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_performance_scores (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url                 text,
  lcp                 float,
  inp                 float,
  cls                 float,
  ttfb                float,
  performance_score   int,
  mobile_score        int,
  accessibility_score int,
  seo_score           int,
  wcag_score          int,
  measured_at         timestamptz DEFAULT now()
);

-- ── seo_generation_log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_generation_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword           text,
  page_type         text,
  audience_segment  text,
  tool_focus        text,
  software_focus    text,
  paper_type_focus  text,
  gemini_output     jsonb,
  claude_output     jsonb,
  validation_status text,
  validation_errors jsonb,
  retry_count       int DEFAULT 0,
  page_id           uuid REFERENCES seo_pages(id) ON DELETE SET NULL,
  model_used        text,
  cost_usd          decimal(10,6),
  generated_at      timestamptz DEFAULT now()
);

-- ── seo_internal_links ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_internal_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_slug    text,
  target_slug    text,
  anchor_text    text,
  cluster        text,
  is_pillar_link boolean DEFAULT false,
  auto_generated boolean DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

-- ── seo_search_console_data ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_search_console_data (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url              text,
  query            text,
  impressions      int,
  clicks           int,
  ctr              float,
  average_position float,
  date             date,
  imported_at      timestamptz DEFAULT now()
);

-- ── seo_fix_log ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_fix_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url             text,
  fix_type        text,
  original_value  text,
  new_value       text,
  compliance_fix  boolean DEFAULT false,
  applied_at      timestamptz DEFAULT now(),
  reverted_at     timestamptz
);

-- ── seo_cta_blocks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_cta_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cta_type    text,
  tool_focus  text,
  audience    text,
  variant     text DEFAULT 'A',
  html        text,
  active      boolean DEFAULT true,
  clicks      int DEFAULT 0,
  impressions int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- ── seo_compliance_log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_compliance_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url             text,
  compliance_type text CHECK (compliance_type IN (
    'eu-ai-act','eaa-wcag','ada-title-ii','gdpr',
    'academic-integrity','crawler-policy')),
  status          text CHECK (status IN ('compliant','violation','pending')),
  details         text,
  checked_at      timestamptz DEFAULT now(),
  resolved_at     timestamptz
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_seo_pages_slug        ON seo_pages(slug);
CREATE INDEX IF NOT EXISTS idx_seo_pages_status      ON seo_pages(status);
CREATE INDEX IF NOT EXISTS idx_seo_pages_type        ON seo_pages(page_type);
CREATE INDEX IF NOT EXISTS idx_seo_pages_tool        ON seo_pages(tool_focus);
CREATE INDEX IF NOT EXISTS idx_seo_pages_software    ON seo_pages(software_focus);
CREATE INDEX IF NOT EXISTS idx_seo_pages_paper_type  ON seo_pages(paper_type_focus);
CREATE INDEX IF NOT EXISTS idx_seo_pages_financial   ON seo_pages(financial_focus);
CREATE INDEX IF NOT EXISTS idx_seo_pages_disclosure  ON seo_pages(has_ai_disclosure);
CREATE INDEX IF NOT EXISTS idx_seo_pages_integrity   ON seo_pages(integrity_check);
CREATE INDEX IF NOT EXISTS idx_seo_pages_published   ON seo_pages(published);
CREATE INDEX IF NOT EXISTS idx_seo_cost_log          ON seo_llm_cost_log(logged_at);
CREATE INDEX IF NOT EXISTS idx_seo_budget_month      ON seo_budget_status(month);
CREATE INDEX IF NOT EXISTS idx_seo_crawl_url         ON seo_crawl_results(url);
CREATE INDEX IF NOT EXISTS idx_seo_audit_severity    ON seo_audit_issues(severity);
CREATE INDEX IF NOT EXISTS idx_seo_audit_compliance  ON seo_audit_issues(compliance_law);
CREATE INDEX IF NOT EXISTS idx_seo_console_date      ON seo_search_console_data(date);
CREATE INDEX IF NOT EXISTS idx_seo_compliance_type   ON seo_compliance_log(compliance_type);
CREATE INDEX IF NOT EXISTS idx_seo_gen_log_page      ON seo_generation_log(page_id);

COMMIT;

-- ── Notes ─────────────────────────────────────────────────────────────────────
-- RLS is intentionally NOT enabled here because this is a server-side
-- backend (Express) that connects via the service role/DATABASE_URL.
-- If you migrate to Supabase RLS, add policies after this migration.
-- Run: psql $DATABASE_URL -f scripts/seo-migrations.sql
