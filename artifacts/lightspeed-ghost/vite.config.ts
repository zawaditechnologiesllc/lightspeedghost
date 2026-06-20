import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

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
