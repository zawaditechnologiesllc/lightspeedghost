// Cloudflare Pages Function: proxies /seo/<slug> to the Express backend.
//
// Why this exists: the SEO article pages (and their sitemap) are rendered by the
// Express backend, but they must be reachable + crawlable on the main domain at
// lightspeedghost.com/seo/<slug>. This function does the proxy server-side —
// the backend origin lives ONLY here (never shipped to the browser).
//
// The sitemap twin of this function lives at functions/seo-sitemap.xml.js.

const DEFAULT_BACKEND = "https://lightspeedghost-5szz.onrender.com";

export async function onRequestGet({ params, env, request }) {
  const slug = String(params.slug || "");

  // Allow-list: only clean slugs may be proxied (no arbitrary backend paths —
  // prevents this from becoming an open proxy).
  if (!/^[A-Za-z0-9._-]+$/.test(slug)) {
    return new Response("Not found", { status: 404 });
  }

  const backend = env.SEO_BACKEND_ORIGIN || DEFAULT_BACKEND;

  try {
    const upstream = await fetch(`${backend}/seo/${slug}`, {
      headers: {
        "user-agent": request.headers.get("user-agent") || "lsg-seo-proxy",
        accept: request.headers.get("accept") || "*/*",
      },
    });
    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "text/html; charset=utf-8",
        "Cache-Control": upstream.ok
          ? "public, max-age=3600, stale-while-revalidate=86400"
          : "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    // Backend waking from idle (free tier) or briefly unreachable.
    return new Response("This page is waking up — please refresh in a moment.", { status: 502 });
  }
}
