import { pool } from "@workspace/db";

export type ToolName = "paper" | "revision" | "humanizer" | "stem" | "study" | "plagiarism" | "outline" | "assistant";

const DAILY_TOOLS = new Set<ToolName>([]);

export const PLAN_LIMITS: Record<string, Record<ToolName, number | null>> = {
  starter: {
    paper:      3,
    revision:   1,
    humanizer:  1,
    stem:       15,  // per month
    study:      20,  // per month
    plagiarism: 5,   // per month
    outline:    5,   // per month
    assistant:  30,  // per month — text modes only; image mode blocked at route level
  },
  pro: {
    paper:      15,  // per month
    revision:   20,  // per month — paired with papers
    humanizer:  20,  // per month — paired with papers
    stem:       60,  // per month
    study:      150, // per month
    plagiarism: 20,  // per month — ~1 check per paper + buffer
    outline:    20,  // per month — paired with papers
    assistant:  300, // per month — Haiku text; Sonnet image/doc (Pro only)
  },
  campus: {
    paper:      5,   // per month per seat
    revision:   8,   // per month per seat
    humanizer:  8,   // per month per seat
    stem:       30,  // per month per seat
    study:      75,  // per month per seat
    plagiarism: 10,  // per month per seat
    outline:    10,  // per month per seat
    assistant:  150, // per month per seat
  },
};

export async function ensureUsageTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_usage (
      user_id    TEXT    NOT NULL,
      tool       TEXT    NOT NULL,
      period     TEXT    NOT NULL,
      count      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, tool, period)
    )
  `);
}

function getPeriod(tool: ToolName): string {
  const now = new Date();
  if (DAILY_TOOLS.has(tool)) {
    return now.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  return now.toISOString().slice(0, 7); // YYYY-MM
}

export async function trackUsage(userId: string, tool: ToolName): Promise<void> {
  const period = getPeriod(tool);
  await pool.query(
    `INSERT INTO user_usage (user_id, tool, period, count)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (user_id, tool, period)
     DO UPDATE SET count = user_usage.count + 1`,
    [userId, tool, period],
  );
}

export async function getUsage(userId: string): Promise<Record<string, number>> {
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);

  const { rows } = await pool.query<{ tool: string; count: number }>(
    `SELECT tool, count FROM user_usage
     WHERE user_id = $1 AND (period = $2 OR period = $3)`,
    [userId, today, month],
  );

  const usage: Record<string, number> = {};
  for (const row of rows) {
    usage[row.tool] = (usage[row.tool] ?? 0) + row.count;
  }
  return usage;
}

export async function getUserPlan(userId: string): Promise<string> {
  try {
    const { rows } = await pool.query<{ plan: string; status: string }>(
      "SELECT plan, status FROM user_subscriptions WHERE user_id = $1",
      [userId],
    );
    const sub = rows[0];
    if (!sub || sub.status !== "active") return "starter";
    return sub.plan ?? "starter";
  } catch {
    return "starter";
  }
}

export async function isAtLimit(userId: string, tool: ToolName): Promise<boolean> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  if (!limits) return false;
  const limit = limits[tool];
  if (limit === null || limit === undefined) return false;
  const usage = await getUsage(userId);
  return (usage[tool] ?? 0) >= limit;
}

export async function enforceLimit(
  userId: string,
  tool: ToolName,
  incrementBy = 1,
): Promise<{ allowed: boolean; plan: string; used: number; limit: number | null }> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const limit = limits?.[tool] ?? null;

  if (limit === null || limit === undefined) {
    for (let i = 0; i < incrementBy; i++) await trackUsage(userId, tool);
    return { allowed: true, plan, used: 0, limit };
  }

  const period = getPeriod(tool);

  const { rows } = await pool.query<{ count: number }>(
    `INSERT INTO user_usage (user_id, tool, period, count)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, tool, period)
     DO UPDATE SET count = user_usage.count + $4
     WHERE user_usage.count + $4 <= $5
     RETURNING count`,
    [userId, tool, period, incrementBy, limit],
  );

  if (rows.length === 0) {
    const cur = await pool.query<{ count: number }>(
      `SELECT count FROM user_usage WHERE user_id = $1 AND tool = $2 AND period = $3`,
      [userId, tool, period],
    );
    const used = cur.rows[0]?.count ?? 0;
    return { allowed: false, plan, used, limit };
  }

  return { allowed: true, plan, used: rows[0].count, limit };
}
