import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";

const router = Router();

let tableReady = false;

async function ensurePwaTable() {
  if (tableReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pwa_installs (
        id          BIGSERIAL PRIMARY KEY,
        platform    TEXT NOT NULL DEFAULT 'unknown',
        event_type  TEXT NOT NULL DEFAULT 'installed',
        user_id     TEXT,
        ip          TEXT,
        country     TEXT NOT NULL DEFAULT '??',
        user_agent  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS pi_created_idx  ON pwa_installs (created_at DESC);
      CREATE INDEX IF NOT EXISTS pi_platform_idx ON pwa_installs (platform);
      CREATE INDEX IF NOT EXISTS pi_event_idx    ON pwa_installs (event_type);
    `);
    tableReady = true;
  } catch { /* non-fatal */ }
}

ensurePwaTable();

function getIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"] as string | undefined;
  return fwd ? fwd.split(",")[0].trim() : (req.ip ?? "unknown");
}

function getCountry(req: Request): string {
  return (
    (req.headers["cf-ipcountry"] as string | undefined) ??
    (req.headers["x-vercel-ip-country"] as string | undefined) ??
    "??"
  );
}

// ── POST /pwa/install ─────────────────────────────────────────────────────────
// Public — no auth required. Called by the frontend when the PWA is installed
// (Android `appinstalled` event) or launched in standalone mode (iOS + Android).
// Router is mounted at /api, so effective path is: POST /api/pwa/install

router.post("/pwa/install", async (req: Request, res: Response) => {
  await ensurePwaTable();

  const { platform, eventType } = req.body as {
    platform?: string;
    eventType?: string;
  };

  const safeplatform  = ["android", "ios", "unknown"].includes(platform ?? "")
    ? (platform as string)
    : "unknown";
  const safeEventType = ["installed", "standalone_launch"].includes(eventType ?? "")
    ? (eventType as string)
    : "installed";

  const ip      = getIp(req);
  const country = getCountry(req);
  const ua      = ((req.headers["user-agent"] as string | undefined) ?? "").slice(0, 250) || null;
  const userId  = req.userId ?? null;

  try {
    await pool.query(
      `INSERT INTO pwa_installs (platform, event_type, user_id, ip, country, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [safeplatform, safeEventType, userId, ip, country, ua],
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

export default router;
