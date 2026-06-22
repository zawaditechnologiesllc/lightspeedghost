// Vercel serverless proxy for the server-rendered SEO pages.
//
// Why this exists: the SEO article pages (and their sitemap) are rendered by the
// Express backend, but they must be reachable + crawlable on the main domain at
// lightspeedghost.com/seo/<slug>. A plain Vercel external rewrite to the backend
// proved unreliable, so this function does the proxy server-side instead. The
// backend origin lives ONLY here (never shipped to the browser), and vercel.json
// rewrites /seo/<slug> and /seo-sitemap.xml onto this function.
//
// Reached via (see vercel.json):
//   /seo/:slug       -> /api/seo-proxy?path=/seo/:slug
//   /seo-sitemap.xml -> /api/seo-proxy?path=/sitemap.xml

const BACKEND = "https://lightspeedghost-5szz.onrender.com";

module.exports = async (req, res) => {
  const path = String((req.query && req.query.path) || "");

  // Allow-list: only the public SEO surface may be proxied (no arbitrary
  // backend paths — prevents this from becoming an open proxy).
  const allowed =
    path === "/sitemap.xml" ||
    path === "/robots.txt" ||
    /^\/seo\/[A-Za-z0-9._-]+$/.test(path);

  if (!allowed) {
    res.status(404).send("Not found");
    return;
  }

  try {
    const upstream = await fetch(BACKEND + path, {
      headers: {
        "user-agent": req.headers["user-agent"] || "lsg-seo-proxy",
        accept: req.headers["accept"] || "*/*",
      },
    });
    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "text/html; charset=utf-8",
    );
    res.setHeader(
      "Cache-Control",
      upstream.ok
        ? "public, max-age=3600, stale-while-revalidate=86400"
        : "no-store",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(body);
  } catch (err) {
    // Backend waking from idle (free tier) or briefly unreachable.
    res.status(502).send("This page is waking up — please refresh in a moment.");
  }
};
