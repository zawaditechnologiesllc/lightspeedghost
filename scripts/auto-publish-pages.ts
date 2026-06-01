#!/bin/bash
# ============================================================================
# AUTO-PUBLISH DRAFT PAGES — TYPESCRIPT/NODE.JS VERSION
# ============================================================================
# Purpose: Publish all draft SEO pages via API
# Usage: node scripts/auto-publish-pages.js
# ============================================================================

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function autoPublishPages() {
  try {
    console.log('🚀 Starting auto-publish of draft pages...\n');

    // Step 1: Count draft pages before
    const countBefore = await pool.query(
      `SELECT COUNT(*) as count FROM seo_pages WHERE status = 'draft' AND published = false`
    );
    const draftCount = parseInt(countBefore.rows[0].count);
    console.log(`📊 Found ${draftCount} draft pages\n`);

    if (draftCount === 0) {
      console.log('✅ No draft pages to publish. All pages are already published!');
      await pool.end();
      return;
    }

    // Step 2: Show which pages will be published
    const draftPages = await pool.query(
      `SELECT slug, title, page_type 
       FROM seo_pages 
       WHERE status = 'draft' AND published = false
       ORDER BY page_type, slug
       LIMIT 20`
    );

    console.log('📋 Pages to be published:\n');
    draftPages.rows.forEach((page, idx) => {
      console.log(`   ${idx + 1}. [${page.page_type}] ${page.title}`);
      console.log(`      → ${page.slug}\n`);
    });

    if (draftCount > 20) {
      console.log(`   ... and ${draftCount - 20} more pages\n`);
    }

    // Step 3: Publish all draft pages
    console.log(`🔄 Publishing ${draftCount} pages...\n`);
    const publishResult = await pool.query(
      `UPDATE seo_pages 
       SET 
         published = true,
         status = 'published',
         updated_at = NOW()
       WHERE status = 'draft' AND published = false
       RETURNING slug`
    );

    console.log(`✅ Successfully published ${publishResult.rowCount} pages\n`);

    // Step 4: Verify by type
    const byType = await pool.query(
      `SELECT page_type, COUNT(*) as count
       FROM seo_pages
       WHERE published = true
       GROUP BY page_type
       ORDER BY count DESC`
    );

    console.log('📈 Published pages by type:\n');
    byType.rows.forEach((row) => {
      console.log(`   ${row.page_type}: ${row.count} pages`);
    });

    // Step 5: Total count
    const totalPublished = await pool.query(
      `SELECT COUNT(*) as count FROM seo_pages WHERE published = true`
    );
    console.log(`\n🎯 Total published pages: ${totalPublished.rows[0].count}\n`);

    // Step 6: Sitemap impact
    console.log('🗺️  Sitemap impact:');
    console.log(`   Previous: ~50 pages in sitemap.xml`);
    console.log(`   Now: ${totalPublished.rows[0].count} pages in sitemap.xml\n`);

    console.log('🔔 Next steps:');
    console.log('   1. Check /sitemap.xml to verify all pages are listed');
    console.log('   2. Go to Google Search Console');
    console.log('   3. Refresh sitemap: https://search.google.com/search-console');
    console.log('   4. Check Coverage report in 24-48 hours\n');

    console.log('✨ Auto-publish complete!\n');

  } catch (error) {
    console.error('❌ Error during auto-publish:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

autoPublishPages();
