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

// ── GET /site-content — admin-editable hero & footer copy for the landing ─────
// Public (the landing fetches it on load). Returns only the overrides an admin
// has set in system_settings; empty strings mean "use the built-in default".
router.get("/site-content", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<{ key: string; value: string }>(
      "SELECT key, value FROM system_settings WHERE key IN ('hero_headline','hero_subtext','footer_tagline','social_x','social_instagram','social_youtube')",
    );
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({
      heroHeadline:     m.hero_headline ?? "",
      heroSubtext:      m.hero_subtext ?? "",
      footerTagline:    m.footer_tagline ?? "",
      socialX:          m.social_x ?? "",
      socialInstagram:  m.social_instagram ?? "",
      socialYoutube:    m.social_youtube ?? "",
    });
  } catch {
    res.json({ heroHeadline: "", heroSubtext: "", footerTagline: "", socialX: "", socialInstagram: "", socialYoutube: "" });
  }
});

// ── GET /public-stats — live counters for the landing page ───────────────────
// Cached for 5 minutes; no auth. Until the cutover date the displayed numbers
// are marketing baselines + real DB activity + a deterministic intra-week
// drift (so they tick upward every cache refresh and every visitor sees the
// same value). After the cutover the baselines retire and the endpoint
// returns pure DB counts.

const STATS_CUTOVER_MS = Date.parse("2027-06-10T00:00:00Z"); // 12 months from launch of this counter
const PAPERS_WEEK_BASELINE = 109_000;
const SIGNUPS_WEEK_BASELINE = 19_008;

// Deterministic pseudo-random for a given integer seed (mulberry32-style)
function seededFraction(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Grows steadily through the current week (resets Monday 00:00 UTC), with a
// small per-5-minute jitter so consecutive refreshes aren't perfectly linear.
function weeklyDrift(now: number, perMinute: number, salt: number): number {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const weekStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
  const minutesIntoWeek = Math.max(0, (now - weekStart) / 60_000);
  const bucket = Math.floor(now / 300_000); // changes every 5 min
  const jitter = Math.floor(seededFraction(bucket * 31 + salt) * perMinute * 8);
  return Math.floor(minutesIntoWeek * perMinute) + jitter;
}

let statsCache: { papersGenerated: number; documentsThisWeek: number; signupsThisWeek: number; fetchedAt: number } | null = null;

router.get("/public-stats", async (_req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300");

  if (statsCache && Date.now() - statsCache.fetchedAt < 5 * 60 * 1000) {
    res.json(statsCache);
    return;
  }

  let realPapersTotal = 0;
  let realDocsWeek = 0;
  let realSignupsWeek = 0;
  try {
    const [papers, docsWeek, signupsWeek] = await Promise.all([
      pool.query<{ cnt: string }>("SELECT COUNT(*) as cnt FROM documents").catch(() => ({ rows: [{ cnt: "0" }] })),
      pool.query<{ cnt: string }>("SELECT COUNT(*) as cnt FROM documents WHERE created_at > NOW() - INTERVAL '7 days'").catch(() => ({ rows: [{ cnt: "0" }] })),
      pool.query<{ cnt: string }>("SELECT COUNT(*) as cnt FROM auth.users WHERE created_at > NOW() - INTERVAL '7 days'").catch(() => ({ rows: [{ cnt: "0" }] })),
    ]);
    realPapersTotal = parseInt(papers.rows[0]?.cnt ?? "0", 10);
    realDocsWeek = parseInt(docsWeek.rows[0]?.cnt ?? "0", 10);
    realSignupsWeek = parseInt(signupsWeek.rows[0]?.cnt ?? "0", 10);
  } catch { /* DB unavailable — baselines still render below */ }

  const now = Date.now();
  const useBaselines = now < STATS_CUTOVER_MS;

  statsCache = {
    papersGenerated: realPapersTotal,
    documentsThisWeek: useBaselines
      ? PAPERS_WEEK_BASELINE + weeklyDrift(now, 1.9, 1) + realDocsWeek   // ~19k organic-looking growth/week + real activity
      : realDocsWeek,
    signupsThisWeek: useBaselines
      ? SIGNUPS_WEEK_BASELINE + weeklyDrift(now, 0.27, 2) + realSignupsWeek // ~2.7k/week + real signups
      : realSignupsWeek,
    fetchedAt: now,
  };
  res.json(statsCache);
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
