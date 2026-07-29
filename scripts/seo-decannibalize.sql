-- ============================================================================
-- seo-decannibalize.sql
-- ----------------------------------------------------------------------------
-- Fixes keyword cannibalisation in the SEO programme. ~110 auto-generated pages
-- all target the same head term ("ai paper writer / academic writing
-- assistance") as thin -guide-N / -review-N / -explained-N / -tools-N /
-- -chatgpt-alternative-N variants, so none of them rank and the cluster looks
-- spammy to Google.
--
-- Strategy (Google-recommended consolidation):
--   • Keep ONE canonical page per intent.
--   • 301-redirect every duplicate to its canonical (seo_redirects — the app
--     serves these as 301s, so no 404s and link equity flows to the survivor).
--   • Archive the duplicates (published=false, status='archived') so they drop
--     out of the sitemap immediately.
--
-- SAFE: wrapped in a transaction, only touches the cannibalising families,
-- never deletes rows, and is fully reversible (see ROLLBACK section at the end).
--
-- HOW TO RUN (Supabase → SQL Editor):
--   1. Run STEP 0 alone first to PREVIEW exactly which slugs will be archived.
--   2. If it looks right, run STEP 1–4 (the BEGIN…COMMIT block).
--   3. Re-fetch /seo-sitemap.xml — the duplicates are gone, the canonicals stay.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 0 — PREVIEW (read-only; run this by itself first)
-- ----------------------------------------------------------------------------
SELECT count(*) AS pages_to_archive
FROM seo_pages
WHERE published = true
  AND slug <> 'ai-paper-writer-academic-writing-assistance-lightspeedghost'
  AND slug <> 'lightspeedghost-vs-chatgpt-academic-writing'
  AND slug <> 'spss-vs-r-for-dissertation-analysis-full-comparison-lightspeedghost'
  AND (
       slug LIKE 'ai-paper-writer-academic-writing-assistance-lightspe%'
    OR slug LIKE 'best-ai-paper-writer-academic-writing-assistance-lightspeedghost-tools%'
    OR slug LIKE 'chatgpt-vs-lightspeedghost-ai-paper-writer%'
    OR slug LIKE 'lightspeedghost-ai-paper-writer-academic-writing-assistance-vs-chatgpt%'
    OR slug =    'lightspeedghost-ai-paper-writer-vs-chatgpt'
    OR slug =    'how-ai-paper-writer-academic-writing-assistance-lightspeedghost-works'
    OR slug =    'spss-vs-r-for-dissertation-analysis-lightspeedghost'
  );
-- (Optional) list them:
-- SELECT slug FROM seo_pages WHERE published = true AND ( … same WHERE … ) ORDER BY slug;

-- ----------------------------------------------------------------------------
-- STEP 1–4 — CONSOLIDATE (the actual fix)
-- ----------------------------------------------------------------------------
BEGIN;

-- 1. Redirect map (idempotent — the app 301s from_slug → to_slug).
CREATE TABLE IF NOT EXISTS seo_redirects (
  from_slug  text PRIMARY KEY,
  to_slug    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2a. Comparison-intent duplicates (mention ChatGPT) → the canonical comparison.
INSERT INTO seo_redirects (from_slug, to_slug)
SELECT slug, 'lightspeedghost-vs-chatgpt-academic-writing'
FROM seo_pages
WHERE published = true
  AND slug <> 'lightspeedghost-vs-chatgpt-academic-writing'
  AND (slug LIKE '%vs-chatgpt%' OR slug LIKE '%chatgpt-alternative%' OR slug LIKE 'chatgpt-vs-lightspeedghost%')
  AND (
       slug LIKE 'ai-paper-writer-academic-writing-assistance-lightspe%'
    OR slug LIKE 'chatgpt-vs-lightspeedghost-ai-paper-writer%'
    OR slug LIKE 'lightspeedghost-ai-paper-writer-academic-writing-assistance-vs-chatgpt%'
    OR slug =    'lightspeedghost-ai-paper-writer-vs-chatgpt'
  )
ON CONFLICT (from_slug) DO NOTHING;

-- 2b. Everything else in the "ai paper writer" family → the head canonical.
INSERT INTO seo_redirects (from_slug, to_slug)
SELECT slug, 'ai-paper-writer-academic-writing-assistance-lightspeedghost'
FROM seo_pages
WHERE published = true
  AND slug <> 'ai-paper-writer-academic-writing-assistance-lightspeedghost'
  AND slug NOT IN (SELECT from_slug FROM seo_redirects)
  AND (
       slug LIKE 'ai-paper-writer-academic-writing-assistance-lightspe%'
    OR slug LIKE 'best-ai-paper-writer-academic-writing-assistance-lightspeedghost-tools%'
    OR slug =    'how-ai-paper-writer-academic-writing-assistance-lightspeedghost-works'
  )
ON CONFLICT (from_slug) DO NOTHING;

-- 2c. Duplicate SPSS-vs-R page → the fuller comparison.
INSERT INTO seo_redirects (from_slug, to_slug)
VALUES ('spss-vs-r-for-dissertation-analysis-lightspeedghost',
        'spss-vs-r-for-dissertation-analysis-full-comparison-lightspeedghost')
ON CONFLICT (from_slug) DO NOTHING;

-- 3. Archive every redirected page so it leaves the sitemap.
UPDATE seo_pages
SET published = false, status = 'archived', updated_at = now()
WHERE slug IN (SELECT from_slug FROM seo_redirects);

-- 4. Reinforce the survivors as the single owners of their terms.
UPDATE seo_pages
SET updated_at = now()
WHERE slug IN (
  'ai-paper-writer-academic-writing-assistance-lightspeedghost',
  'lightspeedghost-vs-chatgpt-academic-writing',
  'spss-vs-r-for-dissertation-analysis-full-comparison-lightspeedghost'
);

-- Report what happened.
SELECT (SELECT count(*) FROM seo_redirects)                                   AS redirects_now,
       (SELECT count(*) FROM seo_pages WHERE status = 'archived')             AS archived_pages,
       (SELECT count(*) FROM seo_pages WHERE published = true)                AS still_published;

COMMIT;

-- ============================================================================
-- ROLLBACK (only if you need to undo — run this block on its own)
-- ----------------------------------------------------------------------------
-- BEGIN;
--   UPDATE seo_pages SET published = true, status = 'published', updated_at = now()
--   WHERE slug IN (SELECT from_slug FROM seo_redirects);
--   DELETE FROM seo_redirects;
-- COMMIT;
-- ============================================================================
