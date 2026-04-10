import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import type { Request, Response } from "express";
import crypto from "node:crypto";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function verifyAdminToken(req: Request): boolean {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) return false;
  const token = req.headers["x-admin-password"] as string | undefined;
  return token === ADMIN_PASSWORD;
}

// ── Table init (called from index.ts startup) ─────────────────────────────────

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
      status           TEXT NOT NULL DEFAULT 'pending',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at          TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_ref_signups_code ON referral_signups (referral_code);
    CREATE INDEX IF NOT EXISTS idx_ref_conv_code    ON referral_conversions (referral_code);
    CREATE INDEX IF NOT EXISTS idx_ref_conv_user    ON referral_conversions (referred_user_id);
  `);
}

// ── Commission helper — imported by payments.ts webhook handlers ───────────────

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
       VALUES ($1, $2, $3, $4, 'pending')`,
      [code, userId, amountCents, commissionCents],
    );
    logger.info({ code, userId, commissionCents }, "[referral] Commission recorded");
  } catch (err) {
    logger.warn({ err }, "[referral] Failed to record commission — non-fatal");
  }
}

// ── GET /referral/my-code — get or create the caller's referral code + stats ──

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

    const [signupsRes, convRes] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM referral_signups WHERE referral_code = $1`,
        [code],
      ),
      pool.query<{ count: string; total_commission: string; paid_commission: string }>(
        `SELECT COUNT(*) as count,
                COALESCE(SUM(commission_cents), 0)                                            as total_commission,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_cents ELSE 0 END), 0)  as paid_commission
         FROM referral_conversions WHERE referral_code = $1`,
        [code],
      ),
    ]);

    const referrals       = parseInt(signupsRes.rows[0]?.count ?? "0");
    const conversions     = parseInt(convRes.rows[0]?.count    ?? "0");
    const totalEarnedCents = parseInt(convRes.rows[0]?.total_commission ?? "0");
    const paidCents        = parseInt(convRes.rows[0]?.paid_commission  ?? "0");
    const pendingCents     = totalEarnedCents - paidCents;

    res.json({ code, referrals, conversions, totalEarnedCents, paidCents, pendingCents });
  } catch (err) {
    logger.error({ err }, "[referral] my-code error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /referral/record-signup — record that this user was referred ──────────

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
       VALUES ($1, $2)
       ON CONFLICT (referred_user_id) DO NOTHING`,
      [normalised, req.userId],
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[referral] record-signup error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/referrals — full referral data for admin panel ─────────────────

router.get("/admin/referrals", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const summaryRes = await pool.query<{
      total_referrers: string;
      total_referrals: string;
      total_conversions: string;
      total_commissions: string;
      pending_commissions: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM referral_codes)                                                   AS total_referrers,
        (SELECT COUNT(*) FROM referral_signups)                                                 AS total_referrals,
        (SELECT COUNT(*) FROM referral_conversions)                                             AS total_conversions,
        (SELECT COALESCE(SUM(commission_cents),0) FROM referral_conversions)                   AS total_commissions,
        (SELECT COALESCE(SUM(commission_cents),0) FROM referral_conversions WHERE status='pending') AS pending_commissions
    `);
    const s = summaryRes.rows[0];
    const summary = {
      totalReferrers:        parseInt(s.total_referrers),
      totalReferrals:        parseInt(s.total_referrals),
      totalConversions:      parseInt(s.total_conversions),
      totalCommissionsCents: parseInt(s.total_commissions),
      pendingCommissionsCents: parseInt(s.pending_commissions),
    };

    const referrersRes = await pool.query<{
      code: string; user_id: string; created_at: string;
      referrals: string; conversions: string;
      total_earned: string; pending: string; paid: string;
    }>(`
      SELECT
        rc.code, rc.user_id, rc.created_at,
        (SELECT COUNT(*) FROM referral_signups    rs   WHERE rs.referral_code   = rc.code) AS referrals,
        (SELECT COUNT(*) FROM referral_conversions conv WHERE conv.referral_code = rc.code) AS conversions,
        (SELECT COALESCE(SUM(commission_cents),0) FROM referral_conversions WHERE referral_code = rc.code)                        AS total_earned,
        (SELECT COALESCE(SUM(commission_cents),0) FROM referral_conversions WHERE referral_code = rc.code AND status = 'pending') AS pending,
        (SELECT COALESCE(SUM(commission_cents),0) FROM referral_conversions WHERE referral_code = rc.code AND status = 'paid')    AS paid
      FROM referral_codes rc
      ORDER BY total_earned DESC, rc.created_at DESC
    `);
    const referrers = referrersRes.rows.map(r => ({
      code:            r.code,
      userId:          r.user_id,
      createdAt:       r.created_at,
      referrals:       parseInt(r.referrals),
      conversions:     parseInt(r.conversions),
      totalEarnedCents: parseInt(r.total_earned),
      pendingCents:    parseInt(r.pending),
      paidCents:       parseInt(r.paid),
    }));

    const conversionsRes = await pool.query<{
      id: number; referral_code: string; referred_user_id: string;
      amount_cents: number; commission_cents: number; status: string;
      created_at: string; paid_at: string | null;
    }>(`
      SELECT id, referral_code, referred_user_id, amount_cents, commission_cents, status, created_at, paid_at
      FROM referral_conversions
      ORDER BY created_at DESC
      LIMIT 200
    `);

    res.json({ summary, referrers, conversions: conversionsRes.rows });
  } catch (err) {
    logger.error({ err }, "[referral] admin list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/referrals/:id/payout — mark one conversion as paid ────────────

router.post("/admin/referrals/:id/payout", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    await pool.query(
      `UPDATE referral_conversions SET status='paid', paid_at=NOW() WHERE id=$1`,
      [id],
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[referral] payout error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/referrals/code/:code/payout-all — pay all pending for a referrer

router.post("/admin/referrals/code/:code/payout-all", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { code } = req.params;
  try {
    const result = await pool.query(
      `UPDATE referral_conversions SET status='paid', paid_at=NOW()
       WHERE referral_code=$1 AND status='pending'`,
      [code],
    );
    res.json({ ok: true, updated: result.rowCount });
  } catch (err) {
    logger.error({ err }, "[referral] payout-all error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
