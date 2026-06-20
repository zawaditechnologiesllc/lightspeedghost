import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Inline the built stylesheet into index.html so the CSS is not a separate
// render-blocking request on first load (mobile ~160ms). CSR SPA with an empty
// #root, so there's no "critical" subset to extract — inlining the whole sheet
// is correct and FOUC-free. Fails safe: if the asset can't be matched it leaves
// the normal <link>.
function inlineEntryCss(): Plugin {
  return {
    name: "inline-entry-css",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const htmlKey = Object.keys(bundle).find((k) => k.endsWith(".html"));
      if (!htmlKey) return;
      const html = bundle[htmlKey];
      if (html.type !== "asset") return;
      let source = html.source.toString();
      const links = source.match(/<link\b[^>]*rel="stylesheet"[^>]*>/g) ?? [];
      for (const link of links) {
        const href = link.match(/href="([^"]+)"/)?.[1];
        if (!href) continue;
        const key = href.replace(/^\.?\//, "");
        const asset = bundle[key];
        if (!asset || asset.type !== "asset") continue;
        source = source.replace(link, `<style>${asset.source.toString()}</style>`);
        delete bundle[key];
      }
      html.source = source;
    },
  };
}

const isProd = process.env.NODE_ENV === "production";

const rawPort = process.env.PORT;

if (!rawPort && !isProd) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = rawPort ? Number(rawPort) : 3000;

if (!isProd && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    inlineEntryCss(),
    ...(!isProd
      ? [
          (await import("@replit/vite-plugin-runtime-error-modal")).default(),
        ]
      : []),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split heavyweight vendors out of the entry chunk so first paint only
        // downloads what the landing page needs (Google PageSpeed: reduce
        // unused JavaScript / avoid enormous network payloads).
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          // Keep the tiny className helpers (clsx / cva / tailwind-merge) out of
          // the recharts "charts" chunk. Otherwise Rollup traps clsx inside it and
          // the entry imports the whole ~360 KB charts chunk just to get clsx.
          if (id.includes("clsx") || id.includes("class-variance-authority") || id.includes("tailwind-merge")) return "react";
          if (id.includes("katex")) return "katex";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@tanstack")) return "query";
          return undefined;
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT ?? 8080}`,
        changeOrigin: true,
        // Required for SSE (text/event-stream) — prevents the proxy from
        // buffering the response body before forwarding it to the browser.
        selfHandleResponse: false,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
              proxyRes.headers["cache-control"] = "no-cache";
              proxyRes.headers["x-accel-buffering"] = "no";
            }
          });
        },
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
