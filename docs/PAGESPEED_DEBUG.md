-- ============================================================================
-- PAGESPEED DEBUGGING CHECKLIST
-- ============================================================================
-- Diagnose why your site scores 58% (desktop) and 72% (mobile)
-- ============================================================================

METRIC | ISSUE | SCORE IMPACT | FIX
-------|-------|--------------|-----

RENDER-BLOCKING RESOURCES
  Problem: CSS/JS loaded before content
  Impact: -15% (performance score)
  
  Check 1: Google Fonts async
    Current: <link href="https://fonts.googleapis.com/css2?..." rel="stylesheet" />
    Should be: <link href="..." rel="stylesheet" async />
    File: artifacts/lightspeed-ghost/index.html
    
  Check 2: React main.tsx defer
    Current: <script type="module" src="/src/main.tsx"></script>
    Should be: <script type="module" src="/src/main.tsx" defer></script>
    File: artifacts/lightspeed-ghost/index.html
    
  Check 3: Third-party scripts
    Find: Tidio chat, Intercom, analytics
    Fix: Load after DOM ready using requestIdleCallback
    
UNOPTIMIZED IMAGES
  Problem: Large JPEGs/PNGs instead of WebP
  Impact: -10% (performance score)
  
  Check: /public folder
    opengraph.jpg    → Convert to WebP
    hero-image.jpg   → Convert to WebP
    *.png            → Consider SVG or WebP
    
  Tools: ImageMagick, TinyPNG, Squoosh
  
SLOW SERVER RESPONSE (TTFB)
  Problem: Server takes 500-800ms to respond
  Impact: -12% (performance score)
  Current: 500-800ms
  Target: <200ms
  
  Check 1: Database query speed
    Run: SELECT COUNT(*) FROM seo_pages; (should be instant)
    If slow: Check indexes in Supabase
    
  Check 2: Vercel cold starts
    Current: First request after deploy = 3-5 seconds
    Fix: Enable Vercel Edge caching
    
  Check 3: API endpoints
    Current: /api/seo endpoints may be slow
    Fix: Cache responses with Cache-Control headers
    
UNUSED JAVASCRIPT & CSS
  Problem: Loading entire libraries for unused features
  Impact: -8% (performance score)
  
  Check 1: Bundle size
    Run: npm run build
    Check: dist/public/main.*.js size (target: <200KB gzipped)
    
  Check 2: Unused packages
    Run: npm ls (check for unused deps)
    Remove: Any packages not imported
    
  Check 3: Dead code
    Run: Tree-shake in Vite
    File: vite.config.ts
    Add: build: { minify: 'terser', sourcemap: false }
    
UNMINIFIED CODE
  Problem: JavaScript/CSS not compressed
  Impact: -5% (performance score)
  
  Check: Build output
    Run: npm run build
    File: dist/public/main.*.js
    Should be minified (unreadable, ~70% smaller)
    
LARGE LAYOUT SHIFTS
  Problem: Elements move after page loads
  Impact: -5% (performance score, CLS metric)
  
  Check 1: Missing image dimensions
    Current: <img src="/image.jpg" />
    Should be: <img src="/image.jpg" width="1200" height="630" />
    
  Check 2: No space reserved for ads
    Problem: Tidio chat loads and shifts layout
    Fix: <div style="aspect-ratio: 16/9;">...</div>
    
  Check 3: Font fallback
    Problem: Font loads and text size changes
    Fix: Use font-display: swap in @font-face
    
-- ============================================================================
-- STEP-BY-STEP DEBUGGING
-- ============================================================================

STEP 1: Run PageSpeed Insights
  URL: https://pagespeed.web.dev
  Enter: https://lightspeedghost.com
  Select: Desktop first, then Mobile
  
  Screenshot the results showing:
    ✓ Performance score
    ✓ Opportunities section
    ✓ Diagnostics section

STEP 2: Check Opportunities (what Google says to fix)
  
  Example output:
    • Eliminate render-blocking resources          -10 points
    • Unoptimized images                          -8 points
    • Reduce unused JavaScript                    -6 points
    • Minify JavaScript                           -4 points
    • Enable text compression                     -5 points
    • Reduce server response time (TTFB)          -12 points
    ───────────────────────────────────
    Total impact: -45 points (58% → 90%)

STEP 3: Check Core Web Vitals
  
  LCP (Largest Contentful Paint)
    Current: 2800ms (slow)
    Target: <2500ms
    What's slow: Hero image loading?
    Fix: Preload image in <head>
    
  INP (Interaction to Next Paint)
    Current: 300ms (acceptable)
    Target: <200ms
    What's slow: Click handlers running long tasks?
    Fix: Break tasks with requestIdleCallback
    
  CLS (Cumulative Layout Shift)
    Current: 0.15 (medium)
    Target: <0.1
    What shifts: Ads/chat loading?
    Fix: Reserve space with aspect-ratio

STEP 4: Check Network tab (Chrome DevTools)
  
  Open: Chrome DevTools → Network tab
  Reload page
  
  Look for:
    • Large files (>500KB) → Compress images
    • Slow requests (>2s) → Cache or optimize
    • Render-blocking JS/CSS → Add async/defer
    
STEP 5: Check Coverage tab (Chrome DevTools)
  
  Open: Chrome DevTools → More tools → Coverage
  Reload page
  
  Look for:
    • CSS coverage <50% → Unused CSS
    • JS coverage <70% → Unused JavaScript
    • Each file should be >70% used

-- ============================================================================
-- CODE FIXES (In Order of Impact)
-- ============================================================================

FIX #1: Google Fonts Async (5 min)
  File: artifacts/lightspeed-ghost/index.html
  Line: ~30
  
  Current:
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  
  Change to:
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'" />
  
  Why: Fonts load in parallel, not blocking render

FIX #2: React Bundle Defer (2 min)
  File: artifacts/lightspeed-ghost/index.html
  Line: ~40
  
  Current:
    <script type="module" src="/src/main.tsx"></script>
  
  Change to:
    <script type="module" src="/src/main.tsx" defer></script>
  
  Why: React loads after HTML, not blocking
  
FIX #3: Image Dimensions (10 min)
  Files: All <img> tags in HTML/React
  
  Current:
    <img src="/hero.jpg" alt="Hero" />
  
  Change to:
    <img src="/hero.jpg" alt="Hero" width="1920" height="1080" />
  
  Why: Browser knows space needed, no layout shift
  
FIX #4: Lazy Load Images (5 min)
  Files: All below-fold images
  
  Current:
    <img src="/feature-1.jpg" alt="Feature 1" />
  
  Change to:
    <img src="/feature-1.jpg" alt="Feature 1" loading="lazy" />
  
  Why: Don't load images until user scrolls to them
  
FIX #5: Preload LCP Image (3 min)
  File: artifacts/lightspeed-ghost/index.html
  Add to <head>:
    <link rel="preload" as="image" href="/hero.webp" />
  
  Why: Browser starts loading hero image immediately

FIX #6: Defer Tidio Chat (5 min)
  File: src/App.tsx or main.tsx
  
  Current:
    import TidioChat from '@tidio/tidio-react';
    export default function App() {
      return <>
        <TidioChat key="tidio-chat" />
        ...
      </>;
    }
  
  Change to:
    export default function App() {
      useEffect(() => {
        // Load Tidio after page interactive
        requestIdleCallback(() => {
          const script = document.createElement('script');
          script.src = '//code.tidio.co/...';
          document.body.appendChild(script);
        });
      }, []);
      return <>...;</>;
    }
  
  Why: Chat doesn't block main content load

FIX #7: Enable Gzip (1 min - Already done by Vercel)
  File: vercel.json
  Note: Vercel auto-enables Gzip
  Verify: Chrome DevTools → Network → Response Headers
  Should show: Content-Encoding: gzip
  
FIX #8: Cache Static Assets (5 min)
  File: vercel.json
  Add:
    {
      "headers": [
        {
          "source": "/(.*\\.(js|css|webp|jpg|png))",
          "headers": [
            { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
          ]
        }
      ]
    }
  
  Why: Browser caches images/JS/CSS for 1 year

-- ============================================================================
-- TESTING IMPROVEMENTS
-- ============================================================================

BEFORE CHANGES:
  npm run build
  npx serve dist
  https://pagespeed.web.dev → Enter localhost
  Record: Performance score

AFTER EACH FIX:
  npm run build
  npx serve dist
  https://pagespeed.web.dev → Re-test
  Compare: Score improvement

EXPECTED IMPROVEMENTS:
  Fix #1 (Fonts):    +3 points
  Fix #2 (Defer):    +2 points
  Fix #3 (Images):   +5 points (especially CLS)
  Fix #4 (Lazy):     +4 points
  Fix #5 (Preload):  +3 points (LCP)
  Fix #6 (Tidio):    +5 points
  Fix #7 (Gzip):     +2 points
  Fix #8 (Cache):    +1 point
  ────────────────────────
  Total:             +25 points (58% → 83%)

-- ============================================================================
-- VALIDATION
-- ============================================================================

After all fixes, run:

1. PageSpeed Insights (Desktop)
   Target: 80%+ performance
   
2. PageSpeed Insights (Mobile)
   Target: 85%+ performance
   
3. Chrome Lighthouse (Local)
   npm run build
   npx lighthouse https://lightspeedghost.com
   Target: 80+ score
   
4. WebPageTest
   https://www.webpagetest.org
   Test: US East Coast
   Target: First Byte < 200ms
