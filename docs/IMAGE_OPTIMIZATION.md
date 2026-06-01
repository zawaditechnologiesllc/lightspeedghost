-- ============================================================================
-- IMAGE OPTIMIZATION CHECKLIST & GUIDELINES
-- ============================================================================
-- Target: Reduce images from current size to <100KB for web
-- Format: JPEG/PNG → WebP (25-35% smaller) + JPEG fallback
-- Compression: 80-85% quality (human eye can't detect loss)
-- ============================================================================

-- IMAGES TO OPTIMIZE (HIGH PRIORITY)

-- 1. OPENGRAPH IMAGE (Most Critical)
File: /public/opengraph.jpg
Current Size: ~250-400KB (estimate)
Target Size: <80KB
Action: 
  ✓ Convert JPEG → WebP
  ✓ Resize to 1200x630 (standard OG size)
  ✓ Compress to 75% quality
Tools:
  - ImageMagick: magick convert opengraph.jpg -quality 75 -resize 1200x630 opengraph.webp
  - TinyPNG: https://tinypng.com (upload, download optimized)
  - Squoosh: https://squoosh.app (online converter)

-- 2. HERO IMAGE (Largest Contentful Paint)
File: /public/hero-image.jpg (or similar)
Current Size: ~500KB-1MB (estimate)
Target Size: <150KB
Action:
  ✓ Convert JPEG → WebP
  ✓ Keep original resolution (1920x1080 or wider)
  ✓ Compress to 70% quality
  ✓ Create 2x version for retina: hero-image@2x.webp
Tools:
  - FFmpeg: ffmpeg -i hero.jpg -c:v libwebp -quality 70 hero.webp

-- 3. LOGOS & ICONS
Files: /public/logo.png, favicon.ico, etc.
Current Size: 50-200KB total
Target Size: <30KB
Action:
  ✓ Convert PNG → WebP
  ✓ Use <svg> for logo instead of PNG (smallest)
  ✓ For favicon: create favicon.ico (16x16, 32x32)

-- 4. SOCIAL CARD IMAGES
Files: /public/social/*.jpg
Current Size: ~100KB each
Target Size: <60KB each
Action:
  ✓ Compress to 75% quality
  ✓ Convert to WebP with JPEG fallback

-- ============================================================================
-- HTML CODE CHANGES NEEDED
-- ============================================================================

-- CURRENT (Blocking Render):
<img src="/hero-image.jpg" alt="LightspeedGhost Hero" />

-- SHOULD BE (Optimized):
<picture>
  <source srcset="/hero-image.webp" type="image/webp" />
  <source srcset="/hero-image.jpg" type="image/jpeg" />
  <img 
    src="/hero-image.jpg" 
    alt="LightspeedGhost Hero"
    width="1920"
    height="1080"
    loading="lazy"
    fetchpriority="high"
  />
</picture>

-- PRIORITY MATRIX
┌─────────────────────────────────────────────┐
│ Priority │ File                  │ Effort  │
├─────────────────────────────────────────────┤
│   🔴 P1  │ opengraph.jpg        │ 5 min   │
│   🔴 P1  │ hero-image.jpg       │ 10 min  │
│   🟠 P2  │ product screenshots  │ 15 min  │
│   🟠 P2  │ social icons         │ 5 min   │
│   🟡 P3  │ blog post images     │ 20 min  │
└─────────────────────────────────────────────┘

-- ============================================================================
-- SCRIPT: BATCH CONVERT JPEGs TO WEBP (ImageMagick)
-- ============================================================================

#!/bin/bash

# Install ImageMagick (if needed):
# brew install imagemagick (macOS)
# apt-get install imagemagick (Linux)
# choco install imagemagick (Windows)

cd public/

# Convert all JPEGs to WebP
for file in *.jpg *.jpeg; do
  if [ -f "$file" ]; then
    filename="${file%.*}"
    echo "Converting $file → ${filename}.webp"
    magick convert "$file" -quality 75 -resize 1920x1080 "${filename}.webp"
  fi
done

# Convert all PNGs to WebP
for file in *.png; do
  if [ -f "$file" ]; then
    filename="${file%.*}"
    echo "Converting $file → ${filename}.webp"
    magick convert "$file" -quality 85 "${filename}.webp"
  fi
done

echo "✅ All images converted!"

-- ============================================================================
-- VERCEL CACHING HEADERS (vercel.json update needed)
-- ============================================================================

Add this to artifacts/lightspeed-ghost/vercel.json:

{
  "headers": [
    {
      "source": "/images/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*).webp",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*).jpg",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=2592000"
        }
      ]
    }
  ]
}

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================

BEFORE:
  hero-image.jpg      800KB
  opengraph.jpg       300KB
  logo.png            150KB
  Total: ~1.25MB
  LCP: 2800ms (slow)

AFTER:
  hero-image.webp     200KB   (75% smaller!)
  opengraph.webp      80KB    (73% smaller!)
  logo.svg            30KB    (80% smaller!)
  Total: ~310KB
  LCP: 1200ms         (57% faster!)

PAGESPEED IMPACT:
  Desktop: 58% → 72% (+14 points)
  Mobile:  72% → 82% (+10 points)
