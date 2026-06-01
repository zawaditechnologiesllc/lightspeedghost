-- ============================================================================
-- AUTO-PUBLISH DRAFT PAGES SCRIPT
-- ============================================================================
-- Purpose: Publish all draft SEO pages to make them indexable
-- Run as: psql -U postgres -d lightspeedghost -f auto-publish-draft-pages.sql
-- ============================================================================

-- Step 1: Count draft pages before
SELECT COUNT(*) as draft_pages_before 
FROM seo_pages 
WHERE status = 'draft' AND published = false;

-- Step 2: Publish all draft pages
UPDATE seo_pages 
SET 
  published = true,
  status = 'published',
  updated_at = NOW()
WHERE status = 'draft' AND published = false;

-- Step 3: Verify update
SELECT COUNT(*) as pages_now_published 
FROM seo_pages 
WHERE published = true AND status = 'published';

-- Step 4: Show which pages were just published
SELECT slug, title, page_type, published, status, updated_at
FROM seo_pages
WHERE published = true AND status = 'published'
ORDER BY updated_at DESC
LIMIT 20;

-- Step 5: Final summary
SELECT 
  COUNT(*) as total_published,
  COUNT(CASE WHEN page_type = 'tool' THEN 1 END) as tool_pages,
  COUNT(CASE WHEN page_type = 'paper-type' THEN 1 END) as paper_type_pages,
  COUNT(CASE WHEN page_type = 'subject' THEN 1 END) as subject_pages,
  COUNT(CASE WHEN page_type = 'software-specific' THEN 1 END) as software_pages,
  COUNT(CASE WHEN page_type = 'data-analysis' THEN 1 END) as analysis_pages
FROM seo_pages
WHERE published = true;

-- ============================================================================
-- MANUAL VERIFICATION
-- ============================================================================
-- Run this query in admin to verify sitemap will now include all pages:

-- SELECT slug, title, page_type, published, status
-- FROM seo_pages
-- WHERE published = true
-- ORDER BY page_type, slug;
