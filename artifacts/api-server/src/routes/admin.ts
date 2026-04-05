import { Router } from "express";
import { db, pool } from "@workspace/db";
import { documentsTable, studySessionsTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function verifyAdminToken(req: Request): boolean {
  if (!ADMIN_PASSWORD) return false;
  const token = req.headers["x-admin-password"] as string | undefined;
  return token === ADMIN_PASSWORD;
}

// ── Bootstrap admin tables ───────────────────────────────────────────────────

async function initAdminTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_bans (
      user_id TEXT PRIMARY KEY,
      reason TEXT,
      banned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      banned_by TEXT
    );
    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      title TEXT,
      message TEXT NOT NULL,
      link TEXT,
      link_text TEXT DEFAULT 'Learn more',
      color TEXT NOT NULL DEFAULT 'blue',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tool_feedback (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT,
      tool TEXT NOT NULL,
      rating SMALLINT NOT NULL,
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO system_settings (key, value) VALUES
      ('maintenance_mode',   'false'),
      ('allow_signups',      'true'),
      ('payg_enabled',       'true'),
      ('starter_paper',      '3'),
      ('starter_revision',   '1'),
      ('starter_humanizer',  '1'),
      ('starter_stem',       '10'),
      ('starter_study',      '10'),
      ('starter_plagiarism', '5'),
      ('starter_outline',    '5')
    ON CONFLICT (key) DO NOTHING;
  `);
}

initAdminTables().catch(() => {});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSettings(): Promise<Record<string, string>> {
  try {
    const rows = await pool.query<{ key: string; value: string }>("SELECT key, value FROM system_settings");
    return Object.fromEntries(rows.rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

// ── POST /admin/verify ────────────────────────────────────────────────────────

router.post("/admin/verify", (req, res) => {
  const { password } = req.body as { password?: string };
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: "Admin not configured. Set ADMIN_PASSWORD environment variable." });
    return;
  }
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: "Invalid admin password" });
  }
});

// ── GET /admin/stats ──────────────────────────────────────────────────────────

router.get("/admin/stats", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const [allDocs, allSessions, revenueRows, creditsRow, activeSubsRow] = await Promise.all([
      db.select().from(documentsTable),
      db.select().from(studySessionsTable),
      pool.query<{ gateway: string; total: string; cnt: string }>(`
        SELECT gateway, SUM(amount_cents) as total, COUNT(*) as cnt
        FROM payments WHERE status = 'completed'
        GROUP BY gateway
      `).catch(() => ({ rows: [] })),
      pool.query<{ total: string }>(`
        SELECT COALESCE(SUM(lifetime_earned_cents), 0) as total FROM user_credits
      `).catch(() => ({ rows: [{ total: "0" }] })),
      pool.query<{ cnt: string }>(`
        SELECT COUNT(*) as cnt FROM user_subscriptions WHERE plan != 'starter'
      `).catch(() => ({ rows: [{ cnt: "0" }] })),
    ]);

    const uniqueUsers = new Set([
      ...allDocs.map((d) => d.userId).filter(Boolean),
      ...allSessions.map((s) => s.userId).filter(Boolean),
    ]);

    const docsByType = allDocs.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentDocs = await db
      .select()
      .from(documentsTable)
      .orderBy(desc(documentsTable.updatedAt))
      .limit(10);

    const totalRevenue = revenueRows.rows.reduce((s, r) => s + Number(r.total), 0);
    const revenueByGateway = Object.fromEntries(
      revenueRows.rows.map((r) => [r.gateway, { revenue: Number(r.total), count: Number(r.cnt) }])
    );

    res.json({
      totalUsers: uniqueUsers.size,
      totalDocuments: allDocs.length,
      papersWritten: docsByType["paper"] ?? 0,
      revisionsCompleted: docsByType["revision"] ?? 0,
      stemSolved: docsByType["stem"] ?? 0,
      studySessions: allSessions.length,
      totalRevenueCents: totalRevenue,
      activeSubscriptions: Number(activeSubsRow.rows[0]?.cnt ?? 0),
      totalCreditsIssuedCents: Number(creditsRow.rows[0]?.total ?? 0),
      revenueByGateway,
      recentDocuments: recentDocs.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/users ──────────────────────────────────────────────────────────

router.get("/admin/users", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const [docUsers, sessionUsers, creditRows, subRows, banRows] = await Promise.all([
      db.select({ userId: documentsTable.userId }).from(documentsTable)
        .where(sql`${documentsTable.userId} is not null`),
      db.select({ userId: studySessionsTable.userId }).from(studySessionsTable)
        .where(sql`${studySessionsTable.userId} is not null`),
      pool.query<{ user_id: string; balance_cents: number; lifetime_earned_cents: number; lifetime_spent_cents: number }>(
        "SELECT user_id, balance_cents, lifetime_earned_cents, lifetime_spent_cents FROM user_credits"
      ).catch(() => ({ rows: [] })),
      pool.query<{ user_id: string; plan: string; billing: string | null }>(
        "SELECT user_id, plan, billing FROM user_subscriptions"
      ).catch(() => ({ rows: [] })),
      pool.query<{ user_id: string; reason: string | null; banned_at: string }>(
        "SELECT user_id, reason, banned_at FROM user_bans"
      ).catch(() => ({ rows: [] })),
    ]);

    const userDocCounts: Record<string, number> = {};
    for (const { userId } of docUsers) if (userId) userDocCounts[userId] = (userDocCounts[userId] ?? 0) + 1;

    const userSessionCounts: Record<string, number> = {};
    for (const { userId } of sessionUsers) if (userId) userSessionCounts[userId] = (userSessionCounts[userId] ?? 0) + 1;

    const creditMap = Object.fromEntries(creditRows.rows.map((r) => [r.user_id, r]));
    const planMap = Object.fromEntries(subRows.rows.map((r) => [r.user_id, r]));
    const banMap = Object.fromEntries(banRows.rows.map((r) => [r.user_id, r]));

    const allUserIds = new Set([
      ...Object.keys(userDocCounts),
      ...Object.keys(userSessionCounts),
      ...Object.keys(creditMap),
      ...Object.keys(planMap),
    ]);

    let supabaseUsers: Array<{ id: string; email: string; created_at: string; last_sign_in_at?: string }> = [];
    if (SUPABASE_SERVICE_ROLE_KEY && SUPABASE_URL) {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=500`, {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
      });
      if (r.ok) {
        const data = await r.json() as { users?: typeof supabaseUsers };
        supabaseUsers = data.users ?? [];
      }
    }

    const enrich = (id: string, email: string | null, createdAt: string | null, lastSignIn: string | null) => ({
      id,
      email,
      createdAt,
      lastSignIn,
      documentCount: userDocCounts[id] ?? 0,
      sessionCount: userSessionCounts[id] ?? 0,
      plan: planMap[id]?.plan ?? "starter",
      billing: planMap[id]?.billing ?? null,
      creditBalance: creditMap[id]?.balance_cents ?? 0,
      lifetimeEarned: creditMap[id]?.lifetime_earned_cents ?? 0,
      lifetimeSpent: creditMap[id]?.lifetime_spent_cents ?? 0,
      banned: !!banMap[id],
      banReason: banMap[id]?.reason ?? null,
    });

    const users = supabaseUsers.length > 0
      ? supabaseUsers.map((u) => enrich(u.id, u.email, u.created_at, u.last_sign_in_at ?? null))
      : Array.from(allUserIds).map((id) => enrich(id, null, null, null));

    res.json({ users, hasEmailData: supabaseUsers.length > 0 });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /admin/users/:id ───────────────────────────────────────────────────

router.delete("/admin/users/:id", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_URL) {
    res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }); return;
  }
  const { id } = req.params;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    if (response.ok) {
      res.json({ ok: true });
    } else {
      const err = await response.json().catch(() => ({}));
      res.status(response.status).json({ error: "Failed to delete user", details: err });
    }
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /admin/users/:id/ban ────────────────────────────────────────────────

router.patch("/admin/users/:id/ban", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params;
  const { banned, reason } = req.body as { banned: boolean; reason?: string };
  try {
    if (banned) {
      await pool.query(
        "INSERT INTO user_bans (user_id, reason) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET reason = $2, banned_at = NOW()",
        [id, reason ?? null]
      );
    } else {
      await pool.query("DELETE FROM user_bans WHERE user_id = $1", [id]);
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to update ban status" });
  }
});

// ── PATCH /admin/users/:id/plan ───────────────────────────────────────────────

router.patch("/admin/users/:id/plan", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params;
  const { plan, billing } = req.body as { plan: string; billing?: string };
  try {
    await pool.query(`
      INSERT INTO user_subscriptions (user_id, plan, billing, gateway)
      VALUES ($1, $2, $3, 'manual')
      ON CONFLICT (user_id) DO UPDATE SET plan = $2, billing = $3
    `, [id, plan, billing ?? null]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to update plan" });
  }
});

// ── POST /admin/users/:id/credits ─────────────────────────────────────────────

router.post("/admin/users/:id/credits", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params;
  const { amountCents, reason } = req.body as { amountCents: number; reason?: string };
  if (!amountCents || amountCents === 0) {
    res.status(400).json({ error: "amountCents must be non-zero" }); return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO user_credits (user_id, balance_cents, lifetime_earned_cents, lifetime_spent_cents) VALUES ($1, 0, 0, 0) ON CONFLICT (user_id) DO NOTHING",
      [id]
    );
    const earns = amountCents > 0 ? amountCents : 0;
    const spends = amountCents < 0 ? Math.abs(amountCents) : 0;
    const updated = await client.query<{ balance_cents: number }>(
      "UPDATE user_credits SET balance_cents = balance_cents + $2, lifetime_earned_cents = lifetime_earned_cents + $3, lifetime_spent_cents = lifetime_spent_cents + $4, updated_at = NOW() WHERE user_id = $1 RETURNING balance_cents",
      [id, amountCents, earns, spends]
    );
    const newBalance = updated.rows[0]?.balance_cents ?? 0;
    if (newBalance < 0) { await client.query("ROLLBACK"); res.status(400).json({ error: "Insufficient credits" }); return; }
    await client.query(
      "INSERT INTO credit_transactions (user_id, amount_cents, type, description) VALUES ($1, $2, $3, $4)",
      [id, amountCents, amountCents > 0 ? "bonus" : "spend", reason ?? "Admin adjustment"]
    );
    await client.query("COMMIT");
    res.json({ ok: true, newBalanceCents: newBalance });
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to adjust credits" });
  } finally {
    client.release();
  }
});

// ── GET /admin/credits ────────────────────────────────────────────────────────

router.get("/admin/credits", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const [creditsRows, recentTx] = await Promise.all([
      pool.query<{ user_id: string; balance_cents: number; lifetime_earned_cents: number; lifetime_spent_cents: number; updated_at: string }>(
        "SELECT user_id, balance_cents, lifetime_earned_cents, lifetime_spent_cents, updated_at FROM user_credits ORDER BY balance_cents DESC LIMIT 100"
      ),
      pool.query<{ user_id: string; amount_cents: number; type: string; description: string; created_at: string }>(
        "SELECT user_id, amount_cents, type, description, created_at FROM credit_transactions ORDER BY created_at DESC LIMIT 50"
      ),
    ]);
    const totals = await pool.query<{ total_balance: string; total_earned: string; total_spent: string }>(
      "SELECT COALESCE(SUM(balance_cents),0) as total_balance, COALESCE(SUM(lifetime_earned_cents),0) as total_earned, COALESCE(SUM(lifetime_spent_cents),0) as total_spent FROM user_credits"
    );
    res.json({
      users: creditsRows.rows,
      recentTransactions: recentTx.rows,
      totals: totals.rows[0] ?? { total_balance: "0", total_earned: "0", total_spent: "0" },
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/revenue ────────────────────────────────────────────────────────

router.get("/admin/revenue", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const [byGateway, byMonth, byType, topUsers, summary] = await Promise.all([
      pool.query<{ gateway: string; revenue: string; count: string }>(
        "SELECT gateway, SUM(amount_cents) as revenue, COUNT(*) as count FROM payments WHERE status = 'completed' GROUP BY gateway ORDER BY revenue DESC"
      ).catch(() => ({ rows: [] })),
      pool.query<{ month: string; revenue: string; count: string }>(
        "SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month, SUM(amount_cents) as revenue, COUNT(*) as count FROM payments WHERE status = 'completed' GROUP BY month ORDER BY month DESC LIMIT 12"
      ).catch(() => ({ rows: [] })),
      pool.query<{ type: string; revenue: string; count: string }>(
        "SELECT type, SUM(amount_cents) as revenue, COUNT(*) as count FROM payments WHERE status = 'completed' GROUP BY type ORDER BY revenue DESC"
      ).catch(() => ({ rows: [] })),
      pool.query<{ user_id: string; revenue: string; count: string }>(
        "SELECT user_id, SUM(amount_cents) as revenue, COUNT(*) as count FROM payments WHERE status = 'completed' GROUP BY user_id ORDER BY revenue DESC LIMIT 10"
      ).catch(() => ({ rows: [] })),
      pool.query<{ total: string; this_month: string; last_month: string; pending: string }>(
        `SELECT
          COALESCE(SUM(amount_cents) FILTER (WHERE status = 'completed'), 0) as total,
          COALESCE(SUM(amount_cents) FILTER (WHERE status = 'completed' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())), 0) as this_month,
          COALESCE(SUM(amount_cents) FILTER (WHERE status = 'completed' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW() - INTERVAL '1 month')), 0) as last_month,
          COALESCE(SUM(amount_cents) FILTER (WHERE status = 'pending'), 0) as pending
        FROM payments`
      ).catch(() => ({ rows: [{ total: "0", this_month: "0", last_month: "0", pending: "0" }] })),
    ]);
    res.json({
      byGateway: byGateway.rows,
      byMonth: byMonth.rows,
      byType: byType.rows,
      topUsers: topUsers.rows,
      summary: summary.rows[0] ?? { total: "0", this_month: "0", last_month: "0", pending: "0" },
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/subscriptions ──────────────────────────────────────────────────

router.get("/admin/subscriptions", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rows = await pool.query<{ user_id: string; plan: string; billing: string | null; gateway: string | null; created_at: string }>(
      "SELECT user_id, plan, billing, gateway, created_at FROM user_subscriptions WHERE plan != 'starter' ORDER BY created_at DESC"
    ).catch(() => ({ rows: [] }));
    const counts = await pool.query<{ plan: string; cnt: string }>(
      "SELECT plan, COUNT(*) as cnt FROM user_subscriptions GROUP BY plan"
    ).catch(() => ({ rows: [] }));
    res.json({
      subscriptions: rows.rows,
      counts: Object.fromEntries(counts.rows.map((r) => [r.plan, Number(r.cnt)])),
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/settings ───────────────────────────────────────────────────────

router.get("/admin/settings", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const settings = await getSettings();
    res.json({ settings });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/settings ──────────────────────────────────────────────────────

router.post("/admin/settings", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { settings } = req.body as { settings: Record<string, string> };
  if (!settings || typeof settings !== "object") {
    res.status(400).json({ error: "Invalid settings" }); return;
  }
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const [key, value] of Object.entries(settings)) {
        await client.query(
          "INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()",
          [key, String(value)]
        );
      }
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// ── GET /admin/ping ───────────────────────────────────────────────────────────

router.get("/admin/ping", (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json({ ok: true, timestamp: new Date().toISOString(), uptimeSeconds: Math.floor(process.uptime()) });
});

// ── GET /admin/traffic ────────────────────────────────────────────────────────

router.get("/admin/traffic", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const [activeAll, activeToday, activeLive, byCountry, byHour] = await Promise.all([
      pool.query<{ cnt: string }>(
        `SELECT COUNT(DISTINCT user_id) as cnt FROM request_logs WHERE user_id IS NOT NULL`
      ).catch(() => ({ rows: [{ cnt: "0" }] })),
      pool.query<{ cnt: string }>(
        `SELECT COUNT(DISTINCT user_id) as cnt FROM request_logs WHERE user_id IS NOT NULL AND created_at > NOW() - INTERVAL '24 hours'`
      ).catch(() => ({ rows: [{ cnt: "0" }] })),
      pool.query<{ cnt: string }>(
        `SELECT COUNT(DISTINCT user_id) as cnt FROM request_logs WHERE user_id IS NOT NULL AND created_at > NOW() - INTERVAL '5 minutes'`
      ).catch(() => ({ rows: [{ cnt: "0" }] })),
      pool.query<{ country: string; requests: string; users: string }>(
        `SELECT country, COUNT(*) as requests, COUNT(DISTINCT user_id) as users
         FROM request_logs WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY country ORDER BY requests DESC LIMIT 30`
      ).catch(() => ({ rows: [] })),
      pool.query<{ hour: string; requests: string; errors: string }>(
        `SELECT TO_CHAR(DATE_TRUNC('hour', created_at), 'HH24:MI') as hour,
                COUNT(*) as requests,
                COUNT(*) FILTER (WHERE status >= 400) as errors
         FROM request_logs WHERE created_at > NOW() - INTERVAL '24 hours'
         GROUP BY DATE_TRUNC('hour', created_at) ORDER BY DATE_TRUNC('hour', created_at) ASC`
      ).catch(() => ({ rows: [] })),
    ]);

    let totalRegisteredUsers = 0;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=500`, {
          headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY },
        });
        if (r.ok) {
          const data = await r.json() as { users?: unknown[] };
          totalRegisteredUsers = data.users?.length ?? 0;
        }
      } catch {}
    }

    // Clean up logs older than 60 days (fire-and-forget)
    pool.query(`DELETE FROM request_logs WHERE created_at < NOW() - INTERVAL '60 days'`).catch(() => {});

    res.json({
      totalRegisteredUsers,
      totalActiveUsers: Number(activeAll.rows[0]?.cnt ?? 0),
      dailyActiveUsers: Number(activeToday.rows[0]?.cnt ?? 0),
      liveUsers: Number(activeLive.rows[0]?.cnt ?? 0),
      byCountry: byCountry.rows,
      byHour: byHour.rows,
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/logs ───────────────────────────────────────────────────────────

router.get("/admin/logs", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const filter = (req.query.filter as string) ?? "all";
  try {
    let where = `WHERE path NOT IN ('/api/healthz') AND path NOT LIKE '%/admin/%'`;
    if (filter === "success") where += " AND status < 400";
    else if (filter === "errors") where += " AND status >= 400";

    const [requestLogs, errorLogs, summary] = await Promise.all([
      pool.query(
        `SELECT id, method, path, status, duration_ms, user_id, country, error_msg,
                created_at::text as created_at
         FROM request_logs ${where}
         ORDER BY created_at DESC LIMIT 200`
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT id, method, path, status, user_id, country, error_msg, created_at::text as created_at
         FROM api_errors ORDER BY created_at DESC LIMIT 100`
      ).catch(() => ({ rows: [] })),
      pool.query<{ total: string; success: string; client_errors: string; server_errors: string; avg_ms: string }>(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status < 400) as success,
           COUNT(*) FILTER (WHERE status >= 400 AND status < 500) as client_errors,
           COUNT(*) FILTER (WHERE status >= 500) as server_errors,
           ROUND(AVG(duration_ms))::text as avg_ms
         FROM request_logs WHERE created_at > NOW() - INTERVAL '24 hours'`
      ).catch(() => ({ rows: [] })),
    ]);

    res.json({
      logs: requestLogs.rows,
      errors: errorLogs.rows,
      summary: summary.rows[0] ?? { total: "0", success: "0", client_errors: "0", server_errors: "0", avg_ms: "0" },
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/announcements (PUBLIC — no auth) ─────────────────────────────────

router.get("/announcements", async (_req: Request, res: Response) => {
  try {
    const rows = await pool.query(
      `SELECT id, title, message, link, link_text, color
       FROM announcements WHERE is_active = true ORDER BY created_at DESC`
    );
    res.json({ announcements: rows.rows });
  } catch {
    res.json({ announcements: [] });
  }
});

// ── GET /admin/announcements ─────────────────────────────────────────────────

router.get("/admin/announcements", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rows = await pool.query(
      `SELECT id, title, message, link, link_text, color, is_active,
              created_at::text as created_at, updated_at::text as updated_at
       FROM announcements ORDER BY created_at DESC`
    );
    res.json({ announcements: rows.rows });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/announcements ─────────────────────────────────────────────────

router.post("/admin/announcements", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { title, message, link, link_text, color } = req.body as {
    title?: string; message: string; link?: string; link_text?: string; color?: string;
  };
  if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }
  try {
    const row = await pool.query(
      `INSERT INTO announcements (title, message, link, link_text, color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, message, link, link_text, color, is_active,
                 created_at::text as created_at`,
      [title ?? null, message.trim(), link ?? null, link_text ?? "Learn more", color ?? "blue"]
    );
    res.json({ announcement: row.rows[0] });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /admin/announcements/:id ───────────────────────────────────────────

router.patch("/admin/announcements/:id", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params;
  const { title, message, link, link_text, color, is_active } = req.body as {
    title?: string; message?: string; link?: string; link_text?: string; color?: string; is_active?: boolean;
  };
  try {
    await pool.query(
      `UPDATE announcements SET
         title = COALESCE($1, title),
         message = COALESCE($2, message),
         link = COALESCE($3, link),
         link_text = COALESCE($4, link_text),
         color = COALESCE($5, color),
         is_active = COALESCE($6, is_active),
         updated_at = NOW()
       WHERE id = $7`,
      [title ?? null, message ?? null, link ?? null, link_text ?? null, color ?? null, is_active ?? null, id]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /admin/announcements/:id ──────────────────────────────────────────

router.delete("/admin/announcements/:id", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM announcements WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/feedback (authenticated) ───────────────────────────────────────

router.post("/feedback", async (req: Request, res: Response) => {
  const userId = (req as Request & { userId?: string }).userId;
  const { tool, rating, comment } = req.body as { tool: string; rating: 1 | -1; comment?: string };
  if (!tool || (rating !== 1 && rating !== -1)) {
    res.status(400).json({ error: "tool and rating (1 or -1) required" }); return;
  }
  try {
    await pool.query(
      "INSERT INTO tool_feedback (user_id, tool, rating, comment) VALUES ($1, $2, $3, $4)",
      [userId ?? null, tool, rating, comment ?? null]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/feedback ───────────────────────────────────────────────────────

router.get("/admin/feedback", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rows = await pool.query<{ tool: string; positive: string; negative: string; total: string; score: string }>(
      `SELECT tool,
              COUNT(*) FILTER (WHERE rating = 1) as positive,
              COUNT(*) FILTER (WHERE rating = -1) as negative,
              COUNT(*) as total,
              ROUND(100.0 * COUNT(*) FILTER (WHERE rating = 1) / NULLIF(COUNT(*), 0)) as score
       FROM tool_feedback WHERE created_at > NOW() - INTERVAL '30 days'
       GROUP BY tool ORDER BY total DESC`
    );
    res.json({ feedback: rows.rows });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
