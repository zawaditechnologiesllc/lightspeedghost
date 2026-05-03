import { pool } from "@workspace/db";

export type ToolName = "paper" | "revision" | "humanizer" | "stem" | "study" | "plagiarism" | "outline" | "assistant" | "ebook";

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
    ebook:      0,   // not included in starter
  },
  pro: {
    paper:      15,  // per month
    revision:   20,  // per month — paired with papers
    humanizer:  20,  // per month — paired with papers
    stem:       40,  // per month
    study:      80,  // per month
    plagiarism: 20,  // per month — ~1 check per paper + buffer
    outline:    20,  // per month — paired with papers
    assistant:  300, // per month — Haiku text; Sonnet image/doc (Pro only)
    ebook:      0,   // separate ebook add-on required
  },
  institution: {
    paper:      5,   // per month per seat
    revision:   8,   // per month per seat
    humanizer:  8,   // per month per seat
    stem:       30,  // per month per seat
    study:      75,  // per month per seat
    plagiarism: 10,  // per month per seat
    outline:    10,  // per month per seat
    assistant:  150, // per month per seat
    ebook:      0,   // separate ebook add-on required
  },
};

// ── Dynamic plan limits (reads from system_settings, cached 60s) ─────────────

let _settingsCache: Record<string, string> | null = null;
let _settingsCacheTime = 0;
const SETTINGS_CACHE_TTL_MS = 60_000;

async function getCachedSettings(): Promise<Record<string, string>> {
  if (_settingsCache && Date.now() - _settingsCacheTime < SETTINGS_CACHE_TTL_MS) {
    return _settingsCache;
  }
  try {
    const { rows } = await pool.query<{ key: string; value: string }>("SELECT key, value FROM system_settings");
    _settingsCache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    _settingsCacheTime = Date.now();
    return _settingsCache;
  } catch {
    return _settingsCache ?? {};
  }
}

function buildDynamicLimits(s: Record<string, string>): Record<string, Record<ToolName, number | null>> {
  const n = (key: string, fallback: number | null) => {
    const v = s[key];
    return v !== undefined ? Number(v) : fallback;
  };
  return {
    starter: {
      paper:      n("starter_paper",      PLAN_LIMITS.starter.paper),
      revision:   n("starter_revision",   PLAN_LIMITS.starter.revision),
      humanizer:  n("starter_humanizer",  PLAN_LIMITS.starter.humanizer),
      stem:       n("starter_stem",       PLAN_LIMITS.starter.stem),
      study:      n("starter_study",      PLAN_LIMITS.starter.study),
      plagiarism: n("starter_plagiarism", PLAN_LIMITS.starter.plagiarism),
      outline:    n("starter_outline",    PLAN_LIMITS.starter.outline),
      assistant:  PLAN_LIMITS.starter.assistant,
      ebook:      PLAN_LIMITS.starter.ebook,
    },
    pro: {
      paper:      n("pro_paper",      PLAN_LIMITS.pro.paper),
      revision:   n("pro_revision",   PLAN_LIMITS.pro.revision),
      humanizer:  n("pro_humanizer",  PLAN_LIMITS.pro.humanizer),
      stem:       n("pro_stem",       PLAN_LIMITS.pro.stem),
      study:      n("pro_study",      PLAN_LIMITS.pro.study),
      plagiarism: n("pro_plagiarism", PLAN_LIMITS.pro.plagiarism),
      outline:    n("pro_outline",    PLAN_LIMITS.pro.outline),
      assistant:  PLAN_LIMITS.pro.assistant,
      ebook:      PLAN_LIMITS.pro.ebook,
    },
    institution: {
      paper:      n("institution_paper",      PLAN_LIMITS.institution.paper),
      revision:   n("institution_revision",   PLAN_LIMITS.institution.revision),
      humanizer:  n("institution_humanizer",  PLAN_LIMITS.institution.humanizer),
      stem:       n("institution_stem",       PLAN_LIMITS.institution.stem),
      study:      n("institution_study",      PLAN_LIMITS.institution.study),
      plagiarism: n("institution_plagiarism", PLAN_LIMITS.institution.plagiarism),
      outline:    n("institution_outline",    PLAN_LIMITS.institution.outline),
      assistant:  PLAN_LIMITS.institution.assistant,
      ebook:      PLAN_LIMITS.institution.ebook,
    },
  };
}

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
    const { rows } = await pool.query<{ plan: string; status: string; current_period_end: Date | null }>(
      "SELECT plan, status, current_period_end FROM user_subscriptions WHERE user_id = $1",
      [userId],
    );
    const sub = rows[0];
    if (!sub || sub.status !== "active") return "starter";
    // Auto-expire: if the subscription period has passed, treat as starter
    if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) {
      // Mark as expired in the background (fire-and-forget)
      pool.query(
        "UPDATE user_subscriptions SET status='expired', updated_at=NOW() WHERE user_id=$1 AND status='active'",
        [userId],
      ).catch(() => {});
      return "starter";
    }
    return sub.plan ?? "starter";
  } catch {
    return "starter";
  }
}

export async function isAtLimit(userId: string, tool: ToolName): Promise<boolean> {
  const plan = await getUserPlan(userId);
  const dynLimits = buildDynamicLimits(await getCachedSettings());
  const limits = dynLimits[plan] ?? PLAN_LIMITS[plan];
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
  const dynLimits = buildDynamicLimits(await getCachedSettings());
  const limits = dynLimits[plan] ?? PLAN_LIMITS[plan];
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
