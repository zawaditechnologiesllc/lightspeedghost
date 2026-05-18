import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

// ── DB bootstrap for ebook subscriptions ───────────────────────────────────

async function ensureEbookTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_ebook_subscriptions (
      user_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active',
      billing TEXT NOT NULL DEFAULT 'monthly',
      gateway TEXT,
      gateway_subscription_id TEXT UNIQUE,
      current_period_end TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ebook_sub_period_end ON user_ebook_subscriptions(current_period_end);
    CREATE INDEX IF NOT EXISTS idx_ebook_sub_gateway_id ON user_ebook_subscriptions(gateway_subscription_id);
  `);
}

// ── Route: Get ebook subscription status ───────────────────────────────────

router.get("/ebooks/subscription", async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const row = await pool.query<{
      user_id: string;
      status: string;
      billing: string;
      gateway: string | null;
      current_period_end: string | null;
    }>(
      `SELECT user_id, status, billing, gateway, current_period_end
       FROM user_ebook_subscriptions
       WHERE user_id = $1`,
      [userId]
    );

    if (!row.rows[0]) {
      res.json({ active: false, status: "inactive" });
      return;
    }

    const sub = row.rows[0];
    const now = new Date();
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
    const isExpired = periodEnd && now > periodEnd;

    // If subscription expired, mark it
    if (isExpired && sub.status !== "expired") {
      await pool.query(
        `UPDATE user_ebook_subscriptions SET status = 'expired', updated_at = NOW() WHERE user_id = $1`,
        [userId]
      );
      res.json({
        active: false,
        status: "expired",
        periodEnd: periodEnd?.toISOString(),
      });
      return;
    }

    res.json({
      active: sub.status === "active" && !isExpired,
      status: sub.status,
      billing: sub.billing,
      gateway: sub.gateway,
      periodEnd: periodEnd?.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Ebook subscription query error");
    res.status(500).json({ error: "Failed to get subscription status" });
  }
});

// ── Route: Check ebook access (used by frontend) ────────────────────────────

router.get("/ebooks/access", async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.json({ hasAccess: false });
    return;
  }

  try {
    const row = await pool.query<{ status: string; current_period_end: string | null }>(
      `SELECT status, current_period_end FROM user_ebook_subscriptions WHERE user_id = $1`,
      [userId]
    );

    if (!row.rows[0]) {
      res.json({ hasAccess: false });
      return;
    }

    const sub = row.rows[0];
    const now = new Date();
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
    const isActive = sub.status === "active" && periodEnd && now <= periodEnd;

    if (!isActive && sub.status !== "expired") {
      await pool.query(
        `UPDATE user_ebook_subscriptions SET status = 'expired', updated_at = NOW() WHERE user_id = $1`,
        [userId]
      );
    }

    res.json({ hasAccess: isActive });
  } catch (err) {
    logger.error({ err }, "Ebook access check error");
    res.json({ hasAccess: false });
  }
});

// ── Route: Get ebook usage this month ──────────────────────────────────────

router.get("/ebooks/usage", async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    // Check subscription first
    const sub = await pool.query<{ status: string; current_period_end: string | null }>(
      `SELECT status, current_period_end FROM user_ebook_subscriptions WHERE user_id = $1`,
      [userId]
    );

    if (!sub.rows[0] || sub.rows[0].status !== "active") {
      res.json({ usedThisMonth: 0, limit: 15 });
      return;
    }

    // Get usage count for current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const usage = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ebook_generations
       WHERE user_id = $1 AND created_at >= $2 AND created_at < $3`,
      [userId, monthStart, monthEnd]
    );

    const usedThisMonth = parseInt(usage.rows[0]?.count ?? "0", 10);
    res.json({ usedThisMonth, limit: 15 });
  } catch (err) {
    logger.error({ err }, "Ebook usage query error");
    res.json({ usedThisMonth: 0, limit: 15 });
  }
});

// ── Admin: Ebook subscriptions list ────────────────────────────────────────

router.get("/mwaramuriuki-login/ebook-subscriptions", async (req: Request, res: Response) => {
  const adminPassword = req.headers["x-admin-password"] as string | undefined;
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const rows = await pool.query<{
      user_id: string;
      status: string;
      billing: string;
      gateway: string | null;
      created_at: string;
      updated_at: string;
      current_period_end: string | null;
    }>(
      `SELECT user_id, status, billing, gateway, created_at, updated_at, current_period_end
       FROM user_ebook_subscriptions
       ORDER BY updated_at DESC
       LIMIT 100`
    );

    res.json({
      subscriptions: rows.rows.map((r) => ({
        ...r,
        active: r.status === "active" && r.current_period_end && new Date(r.current_period_end) > new Date(),
      })),
    });
  } catch (err) {
    logger.error({ err }, "Admin ebook subscriptions error");
    res.status(500).json({ error: "Failed to load ebook subscriptions" });
  }
});

// ── Admin: Cancel ebook subscription ──────────────────────────────────────

router.post("/mwaramuriuki-login/ebook-subscriptions/:userId/cancel", async (req: Request, res: Response) => {
  const adminPassword = req.headers["x-admin-password"] as string | undefined;
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { userId } = req.params;

  try {
    await pool.query(
      `UPDATE user_ebook_subscriptions SET status = 'cancelled', updated_at = NOW() WHERE user_id = $1`,
      [userId]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Admin ebook cancellation error");
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

export async function initEbookSubscriptions() {
  try {
    await ensureEbookTables();
  } catch (err) {
    logger.error({ err }, "Failed to init ebook subscription tables");
  }
}

export default router;
