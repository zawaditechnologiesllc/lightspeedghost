import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { cacheHealthy } from "../lib/cache.js";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  const data = HealthCheckResponse.parse({ status: "ok" });
  const cacheOk = await cacheHealthy();
  res.json({
    ...data,
    uptimeSeconds: Math.floor(process.uptime()),
    cache: cacheOk ? "redis:upstash" : "disabled",
  });
});

// ── GET /public-stats — live counters for the landing page ───────────────────
// Cached for 5 minutes; no auth. Returns real platform activity so the landing
// page can show live numbers instead of static copy.

let statsCache: { papersGenerated: number; documentsThisWeek: number; signupsThisWeek: number; fetchedAt: number } | null = null;

router.get("/public-stats", async (_req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300");

  if (statsCache && Date.now() - statsCache.fetchedAt < 5 * 60 * 1000) {
    res.json(statsCache);
    return;
  }

  try {
    const [papers, docsWeek, signupsWeek] = await Promise.all([
      pool.query<{ cnt: string }>("SELECT COUNT(*) as cnt FROM documents"),
      pool.query<{ cnt: string }>("SELECT COUNT(*) as cnt FROM documents WHERE created_at > NOW() - INTERVAL '7 days'"),
      pool.query<{ cnt: string }>("SELECT COUNT(*) as cnt FROM auth.users WHERE created_at > NOW() - INTERVAL '7 days'").catch(() => ({ rows: [{ cnt: "0" }] })),
    ]);
    statsCache = {
      papersGenerated: parseInt(papers.rows[0]?.cnt ?? "0", 10),
      documentsThisWeek: parseInt(docsWeek.rows[0]?.cnt ?? "0", 10),
      signupsThisWeek: parseInt(signupsWeek.rows[0]?.cnt ?? "0", 10),
      fetchedAt: Date.now(),
    };
    res.json(statsCache);
  } catch {
    res.json({ papersGenerated: 0, documentsThisWeek: 0, signupsThisWeek: 0 });
  }
});

/**
 * Diagnostic endpoint — shows which env vars are present (not their values)
 * and whether the database connection is working.
 * Only available in non-production environments.
 */
router.get("/status", async (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const envVars = [
    "DATABASE_URL",
    "SUPABASE_JWT_SECRET",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "SESSION_SECRET",
    "ALLOWED_ORIGINS",
    "NODE_ENV",
    "PORT",
  ];

  const envStatus: Record<string, boolean> = {};
  for (const v of envVars) {
    envStatus[v] = Boolean(process.env[v]);
  }

  let dbOk = false;
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch {
    dbOk = false;
  }

  res.json({
    env: envStatus,
    db: dbOk ? "connected" : "failed",
    uptime: Math.floor(process.uptime()),
    nodeVersion: process.version,
    mode: process.env.NODE_ENV ?? "undefined",
  });
});

export default router;
