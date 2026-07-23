// Cloudflare Pages Function: proxies /seo-sitemap.xml to the Express backend's
// server-rendered SEO sitemap. The article twin lives at functions/seo/[slug].js.

const DEFAULT_BACKEND = "https://lightspeedghost-5szz.onrender.com";

export async function onRequestGet({ env, request }) {
  const backend = env.SEO_BACKEND_ORIGIN || DEFAULT_BACKEND;

  try {
    const upstream = await fetch(`${backend}/sitemap.xml`, {
      headers: {
        "user-agent": request.headers.get("user-agent") || "lsg-seo-proxy",
        accept: request.headers.get("accept") || "*/*",
      },
    });
    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/xml; charset=utf-8",
        "Cache-Control": upstream.ok
          ? "public, max-age=3600, stale-while-revalidate=86400"
          : "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("This page is waking up — please refresh in a moment.", { status: 502 });
  }
}
