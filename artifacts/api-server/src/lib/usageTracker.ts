import { pool } from "@workspace/db";

export type ToolName = "paper" | "revision" | "humanizer" | "stem" | "study" | "plagiarism" | "outline" | "assistant";

const DAILY_TOOLS = new Set<ToolName>(["stem", "study"]);

export const PLAN_LIMITS: Record<string, Record<ToolName, number | null>> = {
  starter: {
    paper:     3,
    revision:  1,
    humanizer: 1,
    stem:      10,   // per day
    study:     10,   // per day (messages)
    plagiarism: 5,
    outline:   5,
    assistant: 30,   // per month — text modes only; image mode blocked at route level
  },
  pro: {
    paper:     50,
    revision:  50,
    humanizer: 50,
    stem:      30,   // per day
    study:     null, // unlimited
    plagiarism: null,
    outline:   null,
    assistant: null, // unlimited, all modes including image/diagram
  },
  campus: {
    paper:     15,
    revision:  15,
    humanizer: 15,
    stem:      30,   // per day
    study:     null,
    plagiarism: null,
    outline:   null,
    assistant: null, // unlimited, all modes
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
