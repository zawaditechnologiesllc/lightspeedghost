import type { PageSpec } from "./page-catalog";

const BASE_URL = "https://lightspeedghost.com";

export function renderFullPage(opts: {
  spec: PageSpec;
  contentHtml: string;
  schemaJson: string;
  canonicalSlug: string;
}): string {
  const { spec, contentHtml, schemaJson, canonicalSlug } = opts;
  const canonicalUrl = `${BASE_URL}/seo/${canonicalSlug}`;
  const today = new Date().toISOString().split("T")[0];

  let schemas: unknown[] = [];
  try {
    schemas = JSON.parse(schemaJson);
  } catch {
    schemas = [];
  }

  const schemaBlocks = schemas
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s, null, 2)}</script>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(spec.title)}</title>
  <meta name="description" content="${escapeHtml(spec.metaDescription)}" />
  <meta name="keywords" content="${escapeHtml(spec.keywords.join(", "))}" />
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(spec.title)}" />
  <meta property="og:description" content="${escapeHtml(spec.metaDescription)}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${BASE_URL}/opengraph.jpg" />
  <meta property="og:site_name" content="LightspeedGhost" />

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(spec.title)}" />
  <meta name="twitter:description" content="${escapeHtml(spec.metaDescription)}" />
  <meta name="twitter:image" content="${BASE_URL}/opengraph.jpg" />

  <!-- EU AI Act & AI disclosure meta -->
  <meta name="ai-generated" content="assisted" />
  <meta name="ai-content-disclosure" content="This content was created with AI writing assistance and reviewed for accuracy." />

  <!-- Article metadata -->
  <meta name="article:published_time" content="${today}T00:00:00Z" />
  <meta name="article:modified_time" content="${today}T00:00:00Z" />
  <meta name="article:author" content="LightspeedGhost" />

  <!-- Structured Data -->
  ${schemaBlocks}

  <!-- Styles -->
  <link rel="stylesheet" href="${BASE_URL}/seo-page.css" />
  <link rel="icon" href="${BASE_URL}/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />

  <style>
    *,*::before,*::after{box-sizing:border-box}
    :root{
      --brand-primary:#1d6ff4;
      --brand-dark:#0d1b35;
      --brand-accent:#38bdf8;
      --text:#1a202c;
      --text-muted:#4a5568;
      --bg:#fff;
      --bg-alt:#f7f9fc;
      --border:#e2e8f0;
      --radius:10px;
      --max-w:780px;
    }
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text);background:var(--bg);margin:0;line-height:1.7;font-size:16px}
    a{color:var(--brand-primary);text-decoration:none}
    a:hover{text-decoration:underline}
    a:focus-visible{outline:3px solid var(--brand-primary);outline-offset:2px;border-radius:2px}

    .seo-header{background:var(--brand-dark);color:#fff;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
    .seo-header__logo{font-size:1.2rem;font-weight:700;color:#fff;text-decoration:none;display:flex;align-items:center;gap:8px}
    .seo-header__logo:hover{text-decoration:none;color:var(--brand-accent)}
    .seo-header__logo span{color:var(--brand-accent)}
    .seo-header__nav{display:flex;gap:20px;align-items:center}
    .seo-header__nav a{color:#cbd5e0;font-size:0.9rem;text-decoration:none}
    .seo-header__nav a:hover{color:#fff}
    .seo-header__cta{background:var(--brand-primary);color:#fff;padding:8px 18px;border-radius:6px;font-size:0.9rem;font-weight:600;white-space:nowrap}
    .seo-header__cta:hover{background:#1559cc;text-decoration:none}

    .seo-breadcrumb{background:var(--bg-alt);border-bottom:1px solid var(--border);padding:10px 24px;font-size:0.82rem;color:var(--text-muted)}
    .seo-breadcrumb a{color:var(--brand-primary)}
    .seo-breadcrumb span{margin:0 6px;color:var(--border)}

    .seo-content{max-width:var(--max-w);margin:0 auto;padding:40px 24px 64px}
    h1{font-size:clamp(1.6rem,4vw,2.2rem);font-weight:800;line-height:1.25;color:var(--brand-dark);margin:0 0 20px}
    h2{font-size:1.4rem;font-weight:700;color:var(--brand-dark);margin:40px 0 14px;padding-top:8px;border-top:2px solid var(--bg-alt)}
    h3{font-size:1.1rem;font-weight:600;color:var(--text);margin:24px 0 10px}
    p{margin:0 0 18px}
    ul,ol{margin:0 0 18px;padding-left:24px}
    li{margin-bottom:8px}
    table{width:100%;border-collapse:collapse;margin:24px 0;font-size:0.9rem;border-radius:var(--radius);overflow:hidden}
    caption{font-size:0.85rem;color:var(--text-muted);margin-bottom:8px;text-align:left;font-style:italic}
    th,td{border:1px solid var(--border);padding:10px 14px;text-align:left}
    th{background:var(--bg-alt);font-weight:600;color:var(--brand-dark)}
    tr:nth-child(even) td{background:#fbfcfd}
    blockquote{border-left:4px solid var(--brand-primary);margin:24px 0;padding:16px 20px;background:var(--bg-alt);border-radius:0 var(--radius) var(--radius) 0;font-style:italic;color:var(--text-muted)}

    .seo-cta-block{background:linear-gradient(135deg,var(--brand-primary),#0d4fc7);color:#fff;border-radius:var(--radius);padding:28px 32px;margin:32px 0;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px}
    .seo-cta-block__text{flex:1;min-width:220px}
    .seo-cta-block__text h3{color:#fff;margin:0 0 8px;font-size:1.15rem}
    .seo-cta-block__text p{color:rgba(255,255,255,0.85);margin:0;font-size:0.95rem}
    .seo-cta-block__btn{background:#fff;color:var(--brand-primary);padding:12px 24px;border-radius:6px;font-weight:700;font-size:0.95rem;white-space:nowrap;display:inline-block;flex-shrink:0}
    .seo-cta-block__btn:hover{background:#f0f4ff;text-decoration:none}
    .seo-cta-block__btn:focus-visible{outline:3px solid #fff;outline-offset:2px}

    .seo-faq-section{margin:40px 0}
    .seo-faq-section h2{border-top:none}
    .seo-faq-item{border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;overflow:hidden}
    .seo-faq-item details{padding:0}
    .seo-faq-item summary{padding:16px 20px;cursor:pointer;font-weight:600;color:var(--brand-dark);list-style:none;display:flex;justify-content:space-between;align-items:center;user-select:none}
    .seo-faq-item summary::-webkit-details-marker{display:none}
    .seo-faq-item summary::after{content:'＋';font-size:1.2rem;color:var(--brand-primary);flex-shrink:0}
    .seo-faq-item details[open] summary::after{content:'－'}
    .seo-faq-item details[open] summary{background:var(--bg-alt)}
    .seo-faq-item__answer{padding:4px 20px 18px;border-top:1px solid var(--border);background:#fff}
    .seo-faq-item__answer p{margin:14px 0 0;color:var(--text-muted)}

    .ai-disclosure{background:#f0f4ff;border:1px solid #c7d7fb;border-radius:8px;padding:12px 16px;font-size:0.82rem;color:var(--text-muted);display:flex;align-items:center;gap:10px;margin:32px 0 0}

    .seo-footer{background:var(--brand-dark);color:#8896a5;padding:40px 24px;text-align:center;font-size:0.85rem}
    .seo-footer a{color:#8896a5}
    .seo-footer a:hover{color:#fff}
    .seo-footer__links{display:flex;flex-wrap:wrap;justify-content:center;gap:16px;margin-bottom:20px}

    @media(max-width:640px){
      .seo-content{padding:24px 16px 48px}
      .seo-header{padding:12px 16px}
      .seo-header__nav{display:none}
      .seo-cta-block{padding:20px}
      h1{font-size:1.5rem}
    }

    /* Skip link for WCAG 2.2 */
    .skip-link{position:absolute;top:-40px;left:6px;background:var(--brand-primary);color:#fff;padding:8px 14px;border-radius:4px;font-weight:700;z-index:9999;transition:top 0.2s}
    .skip-link:focus{top:6px}

    /* Focus appearance WCAG 2.2 SC 2.4.11 */
    :focus-visible{outline:3px solid var(--brand-primary);outline-offset:3px}

    /* Touch target WCAG 2.2 SC 2.5.8 (24px minimum) */
    button,a,summary{min-height:24px}
  </style>
</head>
<body>
  <!-- Skip navigation (WCAG 2.2 SC 2.4.1) -->
  <a class="skip-link" href="#main-content">Skip to main content</a>

  <!-- Header -->
  <header class="seo-header" role="banner">
    <a href="${BASE_URL}" class="seo-header__logo" aria-label="LightspeedGhost home">
      Light<span>Speed</span> Ghost
    </a>
    <nav class="seo-header__nav" aria-label="Main navigation">
      <a href="${BASE_URL}/write">Write Paper</a>
      <a href="${BASE_URL}/stem">STEM Solver</a>
      <a href="${BASE_URL}/humanizer">AI Refinement</a>
      <a href="${BASE_URL}/pricing">Pricing</a>
    </nav>
    <a href="${BASE_URL}/auth" class="seo-header__cta" aria-label="Get started with LightspeedGhost">Get Started</a>
  </header>

  <!-- Breadcrumb -->
  <nav class="seo-breadcrumb" aria-label="Breadcrumb">
    <a href="${BASE_URL}">Home</a>
    <span aria-hidden="true">›</span>
    <span aria-current="page">${escapeHtml(spec.title.split(" — ")[0] ?? spec.title)}</span>
  </nav>

  <!-- Main content -->
  <main id="main-content" class="seo-content" tabindex="-1">
    ${contentHtml}
  </main>

  <!-- Footer -->
  <footer class="seo-footer" role="contentinfo">
    <div class="seo-footer__links">
      <a href="${BASE_URL}/privacy">Privacy Policy</a>
      <a href="${BASE_URL}/terms">Terms of Service</a>
      <a href="${BASE_URL}/refunds">Refund Policy</a>
      <a href="${BASE_URL}/academic-use">Academic Use Policy</a>
      <a href="${BASE_URL}/contact">Contact</a>
      <a href="${BASE_URL}/about">About</a>
    </div>
    <p>&copy; ${new Date().getFullYear()} LightspeedGhost. All rights reserved.</p>
    <p style="margin-top:8px;font-size:0.78rem;color:#5a6478">
      LightspeedGhost is an AI writing assistance platform. All content is for educational support purposes only.
      Users are responsible for ensuring compliance with their institution's academic integrity policies.
    </p>
  </footer>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Dynamic robots.txt ────────────────────────────────────────────────────────
export function renderRobotsTxt(publishedSlugs: string[]): string {
  const sitemapUrl = "https://lightspeedghost.com/sitemap.xml";
  return `User-agent: *
Allow: /
Disallow: /api/

# Google — allow all crawlers including AI features
User-agent: Googlebot
Allow: /

# Block Google AI training (but allow AI Overviews/SGE crawling via Googlebot)
User-agent: Google-Extended
Disallow: /

# OpenAI: block training, allow search/retrieval
User-agent: GPTBot
Disallow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

# Perplexity — allow (drives referral traffic)
User-agent: PerplexityBot
Allow: /

# Anthropic: block training, allow Claude search
User-agent: anthropic-ai
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-User
Allow: /

# ByteDance / TikTok — block training crawler
User-agent: Bytespider
Disallow: /

# Common Crawl — block (feeds AI training)
User-agent: CCBot
Disallow: /

# Meta — allow search features
User-agent: FacebookBot
Allow: /

# Apple — allow
User-agent: Applebot
Allow: /

User-agent: Applebot-Extended
Allow: /

# Bing
User-agent: bingbot
Allow: /

User-agent: BingPreview
Allow: /

# SEO crawlers — allow
User-agent: AhrefsBot
Allow: /

User-agent: SemrushBot
Allow: /

User-agent: DuckDuckBot
Allow: /

Sitemap: ${sitemapUrl}`;
}

// ── Dynamic sitemap.xml ───────────────────────────────────────────────────────
export function renderSitemapXml(opts: {
  staticPages: Array<{ loc: string; priority: string; changefreq: string }>;
  seoPages: Array<{ slug: string; priority: number; updatedAt: Date }>;
}): string {
  const today = new Date().toISOString().split("T")[0];

  const staticEntries = opts.staticPages
    .map(
      (p) => `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    )
    .join("\n");

  const seoEntries = opts.seoPages
    .map(
      (p) => `  <url>
    <loc>https://lightspeedghost.com/seo/${p.slug}</loc>
    <lastmod>${p.updatedAt.toISOString().split("T")[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${p.priority.toFixed(1)}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

  <!-- Core pages -->
${staticEntries}

  <!-- SEO programme pages (${opts.seoPages.length} published) -->
${seoEntries}

</urlset>`;
}

// Only PUBLIC, crawlable URLs belong here. Tool pages (/write, /stem, …) are
// auth-gated and redirect anonymous crawlers to /auth — listing them creates
// soft-404 "page with redirect" errors in Search Console and wastes crawl budget.
export const STATIC_PAGES = [
  { loc: "https://lightspeedghost.com/", priority: "1.0", changefreq: "weekly" },
  { loc: "https://lightspeedghost.com/africa", priority: "0.90", changefreq: "weekly" },
  { loc: "https://lightspeedghost.com/enterprise", priority: "0.90", changefreq: "weekly" },
  { loc: "https://lightspeedghost.com/blog", priority: "0.70", changefreq: "daily" },
  { loc: "https://lightspeedghost.com/about", priority: "0.60", changefreq: "monthly" },
  { loc: "https://lightspeedghost.com/contact", priority: "0.55", changefreq: "monthly" },
  { loc: "https://lightspeedghost.com/careers", priority: "0.40", changefreq: "monthly" },
  { loc: "https://lightspeedghost.com/academic-use", priority: "0.40", changefreq: "yearly" },
  { loc: "https://lightspeedghost.com/privacy", priority: "0.30", changefreq: "yearly" },
  { loc: "https://lightspeedghost.com/terms", priority: "0.30", changefreq: "yearly" },
  { loc: "https://lightspeedghost.com/refunds", priority: "0.30", changefreq: "yearly" },
];
