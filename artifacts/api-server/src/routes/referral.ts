import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import type { Request, Response } from "express";
import crypto from "node:crypto";

const router = Router();

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function verifyAdminToken(req: Request): boolean {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) return false;
  const token = req.headers["x-admin-password"] as string | undefined;
  return token === ADMIN_PASSWORD;
}

// ── Table init ────────────────────────────────────────────────────────────────

export async function initReferralTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referral_codes (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL UNIQUE,
      code        TEXT NOT NULL UNIQUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS referral_signups (
      id               SERIAL PRIMARY KEY,
      referral_code    TEXT NOT NULL,
      referred_user_id TEXT NOT NULL UNIQUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS referral_conversions (
      id               SERIAL PRIMARY KEY,
      referral_code    TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      amount_cents     INTEGER NOT NULL,
      commission_cents INTEGER NOT NULL,
      status           TEXT NOT NULL DEFAULT 'applied',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at          TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS referral_discounts (
      id                SERIAL PRIMARY KEY,
      referrer_user_id  TEXT NOT NULL,
      referral_code     TEXT NOT NULL,
      referred_user_id  TEXT NOT NULL UNIQUE,
      discount_pct      INTEGER NOT NULL DEFAULT 10,
      status            TEXT NOT NULL DEFAULT 'pending',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      applied_at        TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_ref_signups_code  ON referral_signups (referral_code);
    CREATE INDEX IF NOT EXISTS idx_ref_conv_code     ON referral_conversions (referral_code);
    CREATE INDEX IF NOT EXISTS idx_ref_conv_user     ON referral_conversions (referred_user_id);
    CREATE INDEX IF NOT EXISTS idx_ref_disc_referrer ON referral_discounts (referrer_user_id);
  `);
}

// ── Called by payments webhook: record conversion + grant referrer a discount ──

export async function maybeRecordReferralCommission(
  userId: string,
  amountCents: number,
): Promise<void> {
  try {
    const res = await pool.query<{ referral_code: string }>(
      `SELECT referral_code FROM referral_signups WHERE referred_user_id = $1 LIMIT 1`,
      [userId],
    );
    if (res.rows.length === 0) return;

    const code = res.rows[0].referral_code;
    const commissionCents = Math.round(amountCents * 0.10);

    await pool.query(
      `INSERT INTO referral_conversions (referral_code, referred_user_id, amount_cents, commission_cents, status)
       VALUES ($1, $2, $3, $4, 'applied')
       ON CONFLICT DO NOTHING`,
      [code, userId, amountCents, commissionCents],
    );

    const referrerRes = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM referral_codes WHERE code = $1 LIMIT 1`,
      [code],
    );
    if (referrerRes.rows.length === 0) return;

    const referrerUserId = referrerRes.rows[0].user_id;
    await pool.query(
      `INSERT INTO referral_discounts (referrer_user_id, referral_code, referred_user_id, discount_pct, status)
       VALUES ($1, $2, $3, 10, 'pending')
       ON CONFLICT (referred_user_id) DO NOTHING`,
      [referrerUserId, code, userId],
    );

    logger.info({ code, referrerUserId, userId }, "[referral] 10% discount granted to referrer");
  } catch (err) {
    logger.warn({ err }, "[referral] Failed to record — non-fatal");
  }
}

// ── Called before checkout: apply pending discount to amount if available ──────

export async function maybeApplyReferralDiscount(
  userId: string,
  amountCents: number,
): Promise<{ discountedAmount: number; discountApplied: boolean }> {
  try {
    const res = await pool.query<{ discount_pct: number }>(
      `SELECT discount_pct FROM referral_discounts
       WHERE referrer_user_id = $1 AND status = 'pending'
       ORDER BY created_at ASC LIMIT 1`,
      [userId],
    );
    if (res.rows.length === 0) return { discountedAmount: amountCents, discountApplied: false };
    const pct = res.rows[0].discount_pct;
    const discounted = Math.round(amountCents * (1 - pct / 100));
    return { discountedAmount: discounted, discountApplied: true };
  } catch {
    return { discountedAmount: amountCents, discountApplied: false };
  }
}

// ── Called after successful subscription payment: mark oldest pending discount applied

export async function markFirstPendingDiscountApplied(userId: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE referral_discounts SET status='applied', applied_at=NOW()
       WHERE id = (
         SELECT id FROM referral_discounts
         WHERE referrer_user_id = $1 AND status = 'pending'
         ORDER BY created_at ASC LIMIT 1
       )`,
      [userId],
    );
  } catch (err) {
    logger.warn({ err, userId }, "[referral] Failed to mark discount applied — non-fatal");
  }
}

// ── GET /referral/my-code ─────────────────────────────────────────────────────

router.get("/referral/my-code", async (req: Request, res: Response) => {
  if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    let codeRes = await pool.query<{ code: string }>(
      `SELECT code FROM referral_codes WHERE user_id = $1 LIMIT 1`,
      [req.userId],
    );
    if (codeRes.rows.length === 0) {
      const code = generateCode();
      await pool.query(
        `INSERT INTO referral_codes (user_id, code) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
        [req.userId, code],
      );
      codeRes = await pool.query<{ code: string }>(
        `SELECT code FROM referral_codes WHERE user_id = $1 LIMIT 1`,
        [req.userId],
      );
    }
    const code = codeRes.rows[0]?.code ?? "";

    const [signupsRes, convRes, discountRes] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM referral_signups WHERE referral_code = $1`,
        [code],
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM referral_conversions WHERE referral_code = $1`,
        [code],
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM referral_discounts
         WHERE referrer_user_id = $1 AND status = 'pending'`,
        [req.userId],
      ),
    ]);

    res.json({
      code,
      referrals:        parseInt(signupsRes.rows[0]?.count ?? "0"),
      conversions:      parseInt(convRes.rows[0]?.count    ?? "0"),
      pendingDiscounts: parseInt(discountRes.rows[0]?.count ?? "0"),
    });
  } catch (err) {
    logger.error({ err }, "[referral] my-code error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /referral/my-discount — has a pending 10% discount? ──────────────────

router.get("/referral/my-discount", async (req: Request, res: Response) => {
  if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const res2 = await pool.query<{ discount_pct: number; created_at: string }>(
      `SELECT discount_pct, created_at FROM referral_discounts
       WHERE referrer_user_id = $1 AND status = 'pending'
       ORDER BY created_at ASC LIMIT 1`,
      [req.userId],
    );
    if (res2.rows.length === 0) {
      res.json({ hasDiscount: false });
      return;
    }
    const d = res2.rows[0];
    res.json({ hasDiscount: true, discountPct: d.discount_pct, createdAt: d.created_at });
  } catch (err) {
    logger.error({ err }, "[referral] my-discount error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /referral/record-signup ──────────────────────────────────────────────

router.post("/referral/record-signup", async (req: Request, res: Response) => {
  if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { code } = req.body as { code?: string };
  if (!code || typeof code !== "string") { res.status(400).json({ error: "code required" }); return; }

  try {
    const normalised = code.toUpperCase().trim();
    const codeRes = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM referral_codes WHERE code = $1 LIMIT 1`,
      [normalised],
    );
    if (codeRes.rows.length === 0) { res.status(404).json({ error: "Invalid referral code" }); return; }
    if (codeRes.rows[0].user_id === req.userId) { res.status(400).json({ error: "Cannot refer yourself" }); return; }

    await pool.query(
      `INSERT INTO referral_signups (referral_code, referred_user_id)
       VALUES ($1, $2) ON CONFLICT (referred_user_id) DO NOTHING`,
      [normalised, req.userId],
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[referral] record-signup error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/referrals ──────────────────────────────────────────────────────

router.get("/admin/referrals", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const summaryRes = await pool.query<{
      total_referrers: string; total_referrals: string;
      total_conversions: string; pending_discounts: string; applied_discounts: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM referral_codes)                                  AS total_referrers,
        (SELECT COUNT(*) FROM referral_signups)                                AS total_referrals,
        (SELECT COUNT(*) FROM referral_conversions)                            AS total_conversions,
        (SELECT COUNT(*) FROM referral_discounts WHERE status='pending')       AS pending_discounts,
        (SELECT COUNT(*) FROM referral_discounts WHERE status='applied')       AS applied_discounts
    `);
    const s = summaryRes.rows[0];
    const summary = {
      totalReferrers:   parseInt(s.total_referrers),
      totalReferrals:   parseInt(s.total_referrals),
      totalConversions: parseInt(s.total_conversions),
      pendingDiscounts: parseInt(s.pending_discounts),
      appliedDiscounts: parseInt(s.applied_discounts),
    };

    const referrersRes = await pool.query<{
      code: string; user_id: string; created_at: string;
      referrals: string; conversions: string;
      pending_discounts: string; applied_discounts: string;
    }>(`
      SELECT
        rc.code, rc.user_id, rc.created_at,
        (SELECT COUNT(*) FROM referral_signups    rs WHERE rs.referral_code   = rc.code) AS referrals,
        (SELECT COUNT(*) FROM referral_conversions cv WHERE cv.referral_code  = rc.code) AS conversions,
        (SELECT COUNT(*) FROM referral_discounts   rd WHERE rd.referral_code  = rc.code AND rd.status='pending') AS pending_discounts,
        (SELECT COUNT(*) FROM referral_discounts   rd WHERE rd.referral_code  = rc.code AND rd.status='applied') AS applied_discounts
      FROM referral_codes rc
      ORDER BY conversions DESC, rc.created_at DESC
    `);
    const referrers = referrersRes.rows.map(r => ({
      code:             r.code,
      userId:           r.user_id,
      createdAt:        r.created_at,
      referrals:        parseInt(r.referrals),
      conversions:      parseInt(r.conversions),
      pendingDiscounts: parseInt(r.pending_discounts),
      appliedDiscounts: parseInt(r.applied_discounts),
    }));

    const discountsRes = await pool.query<{
      id: number; referrer_user_id: string; referral_code: string;
      referred_user_id: string; discount_pct: number; status: string;
      created_at: string; applied_at: string | null;
    }>(`
      SELECT id, referrer_user_id, referral_code, referred_user_id,
             discount_pct, status, created_at, applied_at
      FROM referral_discounts
      ORDER BY created_at DESC LIMIT 200
    `);

    res.json({ summary, referrers, discounts: discountsRes.rows });
  } catch (err) {
    logger.error({ err }, "[referral] admin list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/referrals/discount/:id/apply — manually mark a discount applied

router.post("/admin/referrals/discount/:id/apply", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    await pool.query(
      `UPDATE referral_discounts SET status='applied', applied_at=NOW() WHERE id=$1`,
      [id],
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[referral] apply discount error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
