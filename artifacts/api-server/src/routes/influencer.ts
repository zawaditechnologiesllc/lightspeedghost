import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import type { Request, Response } from "express";
import crypto from "node:crypto";

const router = Router();

// ── Program terms (admin-adjustable via system_settings) ─────────────────────
// Defaults: $1.00 per 1,000 views, $20.00 minimum payout, paid every 30 days
// through the influencer's preferred payment method. No discounts — just a
// tracked link.
interface InfluencerSettings {
  ratePer1kCents: number;   // cents earned per 1,000 views
  minPayoutCents: number;   // minimum balance before a payout is issued
  payoutDays: number;       // payout cadence in days
}

export async function getInfluencerSettings(): Promise<InfluencerSettings> {
  const defaults: InfluencerSettings = { ratePer1kCents: 100, minPayoutCents: 2000, payoutDays: 30 };
  try {
    const { rows } = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM system_settings WHERE key IN ('influencer_rate_per_1k_cents','influencer_min_payout_cents','influencer_payout_days')`,
    );
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      ratePer1kCents: parseInt(m.influencer_rate_per_1k_cents ?? "", 10) || defaults.ratePer1kCents,
      minPayoutCents: parseInt(m.influencer_min_payout_cents ?? "", 10) || defaults.minPayoutCents,
      payoutDays:     parseInt(m.influencer_payout_days ?? "", 10) || defaults.payoutDays,
    };
  } catch {
    return defaults;
  }
}

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function verifyAdminToken(req: Request): boolean {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) return false;
  const token = req.headers["x-admin-password"] as string | undefined;
  if (!token) return false;
  const aBuf = Buffer.from(token, "utf8");
  const bBuf = Buffer.from(ADMIN_PASSWORD, "utf8");
  const maxLen = Math.max(aBuf.length, bBuf.length);
  const aPadded = Buffer.alloc(maxLen);
  const bPadded = Buffer.alloc(maxLen);
  aBuf.copy(aPadded);
  bBuf.copy(bPadded);
  return crypto.timingSafeEqual(aPadded, bPadded) && aBuf.length === bBuf.length;
}

// ── Table init ────────────────────────────────────────────────────────────────

export async function initInfluencerTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS influencers (
      user_id        TEXT PRIMARY KEY,
      code           TEXT NOT NULL UNIQUE,
      payout_method  TEXT,
      payout_details TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_payout_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS influencer_views (
      code      TEXT NOT NULL,
      view_day  DATE NOT NULL,
      views     INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (code, view_day)
    );
    CREATE TABLE IF NOT EXISTS influencer_payouts (
      id           SERIAL PRIMARY KEY,
      user_id      TEXT NOT NULL,
      code         TEXT NOT NULL,
      views        BIGINT NOT NULL DEFAULT 0,
      amount_cents INTEGER NOT NULL,
      method       TEXT,
      details      TEXT,
      status       TEXT NOT NULL DEFAULT 'paid',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at      TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_inf_views_code   ON influencer_views (code);
    CREATE INDEX IF NOT EXISTS idx_inf_payouts_user ON influencer_payouts (user_id);
  `);
}

async function ensureInfluencer(userId: string): Promise<string> {
  let r = await pool.query<{ code: string }>(`SELECT code FROM influencers WHERE user_id = $1 LIMIT 1`, [userId]);
  if (r.rows.length === 0) {
    const code = generateCode();
    await pool.query(`INSERT INTO influencers (user_id, code) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`, [userId, code]);
    r = await pool.query<{ code: string }>(`SELECT code FROM influencers WHERE user_id = $1 LIMIT 1`, [userId]);
  }
  return r.rows[0]?.code ?? "";
}

function earningsFor(views: number, ratePer1kCents: number): number {
  return Math.floor((views * ratePer1kCents) / 1000);
}

// ── POST /influencer/track — public view beacon ───────────────────────────────
// The client sends this once per session/day per code (it self-throttles via
// localStorage). We aggregate views per code per day.
router.post("/influencer/track", async (req: Request, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code || typeof code !== "string") { res.status(400).json({ error: "code required" }); return; }
  try {
    const normalised = code.toUpperCase().trim().slice(0, 32);
    const exists = await pool.query(`SELECT 1 FROM influencers WHERE code = $1 LIMIT 1`, [normalised]);
    if (exists.rows.length === 0) { res.json({ ok: false }); return; }
    await pool.query(
      `INSERT INTO influencer_views (code, view_day, views) VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (code, view_day) DO UPDATE SET views = influencer_views.views + 1`,
      [normalised],
    );
    res.json({ ok: true });
  } catch (err) {
    logger.warn({ err }, "[influencer] track failed — non-fatal");
    res.json({ ok: false });
  }
});

// ── GET /influencer/terms — public program terms (marketing page) ─────────────
router.get("/influencer/terms", async (_req: Request, res: Response) => {
  const settings = await getInfluencerSettings();
  res.json(settings);
});

// ── GET /influencer/me — the signed-in user's program status ──────────────────
router.get("/influencer/me", async (req: Request, res: Response) => {
  if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const code = await ensureInfluencer(req.userId);
    const settings = await getInfluencerSettings();

    const [viewsRes, paidRes, methodRes, payoutsRes] = await Promise.all([
      pool.query<{ total: string }>(`SELECT COALESCE(SUM(views),0) as total FROM influencer_views WHERE code = $1`, [code]),
      pool.query<{ total: string }>(`SELECT COALESCE(SUM(amount_cents),0) as total FROM influencer_payouts WHERE user_id = $1 AND status = 'paid'`, [req.userId]),
      pool.query<{ payout_method: string | null; payout_details: string | null; last_payout_at: string | null; created_at: string }>(
        `SELECT payout_method, payout_details, last_payout_at, created_at FROM influencers WHERE user_id = $1 LIMIT 1`, [req.userId]),
      pool.query<{ id: number; views: string; amount_cents: number; method: string | null; status: string; created_at: string; paid_at: string | null }>(
        `SELECT id, views, amount_cents, method, status, created_at, paid_at FROM influencer_payouts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [req.userId]),
    ]);

    const totalViews = parseInt(viewsRes.rows[0]?.total ?? "0", 10);
    const paidCents = parseInt(paidRes.rows[0]?.total ?? "0", 10);
    const earnedCents = earningsFor(totalViews, settings.ratePer1kCents);
    const balanceCents = Math.max(0, earnedCents - paidCents);
    const meta = methodRes.rows[0];

    // Next payout window opens payoutDays after the last payout (or after joining).
    const anchor = meta?.last_payout_at ?? meta?.created_at;
    const nextEligibleAt = anchor ? new Date(new Date(anchor).getTime() + settings.payoutDays * 86400_000).toISOString() : null;

    res.json({
      code,
      totalViews,
      earnedCents,
      paidCents,
      balanceCents,
      ratePer1kCents: settings.ratePer1kCents,
      minPayoutCents: settings.minPayoutCents,
      payoutDays: settings.payoutDays,
      payoutMethod: meta?.payout_method ?? "",
      payoutDetails: meta?.payout_details ?? "",
      nextEligibleAt,
      eligibleForPayout: balanceCents >= settings.minPayoutCents,
      payouts: payoutsRes.rows.map((p) => ({
        id: p.id, views: parseInt(p.views, 10), amountCents: p.amount_cents,
        method: p.method, status: p.status, createdAt: p.created_at, paidAt: p.paid_at,
      })),
    });
  } catch (err) {
    logger.error({ err }, "[influencer] me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /influencer/payout-method — save preferred payout method ─────────────
router.post("/influencer/payout-method", async (req: Request, res: Response) => {
  if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { method, details } = req.body as { method?: string; details?: string };
  if (!method || typeof method !== "string") { res.status(400).json({ error: "method required" }); return; }
  try {
    await ensureInfluencer(req.userId);
    await pool.query(
      `UPDATE influencers SET payout_method = $2, payout_details = $3 WHERE user_id = $1`,
      [req.userId, method.slice(0, 60), (details ?? "").slice(0, 300)],
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[influencer] payout-method error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/influencers — program overview ─────────────────────────────────
router.get("/admin/influencers", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const settings = await getInfluencerSettings();
    const rowsRes = await pool.query<{
      user_id: string; code: string; payout_method: string | null; payout_details: string | null;
      created_at: string; last_payout_at: string | null; total_views: string; paid_cents: string;
    }>(`
      SELECT i.user_id, i.code, i.payout_method, i.payout_details, i.created_at, i.last_payout_at,
        (SELECT COALESCE(SUM(v.views),0) FROM influencer_views v WHERE v.code = i.code) AS total_views,
        (SELECT COALESCE(SUM(p.amount_cents),0) FROM influencer_payouts p WHERE p.user_id = i.user_id AND p.status='paid') AS paid_cents
      FROM influencers i
      ORDER BY total_views DESC, i.created_at DESC
      LIMIT 500
    `);

    const influencers = rowsRes.rows.map((r) => {
      const totalViews = parseInt(r.total_views, 10);
      const paidCents = parseInt(r.paid_cents, 10);
      const earnedCents = earningsFor(totalViews, settings.ratePer1kCents);
      const balanceCents = Math.max(0, earnedCents - paidCents);
      return {
        userId: r.user_id, code: r.code, totalViews, earnedCents, paidCents, balanceCents,
        payoutMethod: r.payout_method ?? "", payoutDetails: r.payout_details ?? "",
        createdAt: r.created_at, lastPayoutAt: r.last_payout_at,
        eligible: balanceCents >= settings.minPayoutCents,
      };
    });

    const summary = {
      totalInfluencers: influencers.length,
      totalViews: influencers.reduce((a, b) => a + b.totalViews, 0),
      totalOwedCents: influencers.reduce((a, b) => a + b.balanceCents, 0),
      eligibleCount: influencers.filter((i) => i.eligible).length,
      ratePer1kCents: settings.ratePer1kCents,
      minPayoutCents: settings.minPayoutCents,
      payoutDays: settings.payoutDays,
    };
    res.json({ summary, influencers });
  } catch (err) {
    logger.error({ err }, "[influencer] admin list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/influencers/:userId/mark-paid — record a payout ───────────────
router.post("/admin/influencers/:userId/mark-paid", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String(req.params.userId);
  try {
    const settings = await getInfluencerSettings();
    const infRes = await pool.query<{ code: string; payout_method: string | null; payout_details: string | null }>(
      `SELECT code, payout_method, payout_details FROM influencers WHERE user_id = $1 LIMIT 1`, [userId]);
    if (infRes.rows.length === 0) { res.status(404).json({ error: "Influencer not found" }); return; }
    const inf = infRes.rows[0];

    const viewsRes = await pool.query<{ total: string }>(`SELECT COALESCE(SUM(views),0) as total FROM influencer_views WHERE code = $1`, [inf.code]);
    const paidRes = await pool.query<{ total: string }>(`SELECT COALESCE(SUM(amount_cents),0) as total FROM influencer_payouts WHERE user_id = $1 AND status='paid'`, [userId]);
    const totalViews = parseInt(viewsRes.rows[0]?.total ?? "0", 10);
    const paidCents = parseInt(paidRes.rows[0]?.total ?? "0", 10);
    const balanceCents = Math.max(0, earningsFor(totalViews, settings.ratePer1kCents) - paidCents);

    if (balanceCents <= 0) { res.status(400).json({ error: "No outstanding balance" }); return; }

    await pool.query(
      `INSERT INTO influencer_payouts (user_id, code, views, amount_cents, method, details, status, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'paid', NOW())`,
      [userId, inf.code, totalViews, balanceCents, inf.payout_method, inf.payout_details],
    );
    await pool.query(`UPDATE influencers SET last_payout_at = NOW() WHERE user_id = $1`, [userId]);

    logger.info({ userId, balanceCents }, "[influencer] payout recorded");
    res.json({ ok: true, amountCents: balanceCents });
  } catch (err) {
    logger.error({ err }, "[influencer] mark-paid error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
