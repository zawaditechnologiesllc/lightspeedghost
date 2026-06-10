// lsg-v3 — cache strategy rewritten to eliminate stale-HTML blank pages:
//  • index.html is NEVER pre-cached or served from cache. Serving a stale
//    shell points the browser at old hashed chunks that no longer exist on
//    the CDN after a deploy → white screen. Navigations are network-first
//    with an inline offline screen as the only fallback.
//  • /assets/* (content-hashed, immutable) are cache-first.
//  • Everything else same-origin is network-first with cache fallback.
const CACHE_NAME = "lsg-v3";
const STATIC_URLS = [
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LIGHTSPEED — Offline</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #04080f; color: #fff; font-family: system-ui, sans-serif; text-align: center; padding: 24px; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 8px; }
    p { color: rgba(255,255,255,.5); font-size: 0.95rem; max-width: 320px; line-height: 1.6; margin-bottom: 24px; }
    button { padding: 12px 28px; background: #2563eb; color: #fff; border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <h1>You're offline</h1>
  <p>Light Speed Ghost needs an internet connection. Check your connection and try again.</p>
  <button onclick="location.reload()">Try again</button>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Never intercept API calls or cross-origin requests
  if (url.pathname.includes("/api/") || url.hostname !== self.location.hostname) {
    return;
  }

  // Navigations: always go to the network so a fresh deploy is picked up
  // immediately. Cache is never consulted for HTML — only the inline offline
  // screen if the network is truly unreachable.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(OFFLINE_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      )
    );
    return;
  }

  // Hashed build assets are immutable — cache-first is safe and fast.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Other same-origin GETs (manifest, icons, fonts): network-first so updates
  // propagate, falling back to cache when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type !== "opaque") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? new Response("", { status: 503 })))
  );
});
