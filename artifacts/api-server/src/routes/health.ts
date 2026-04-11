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
