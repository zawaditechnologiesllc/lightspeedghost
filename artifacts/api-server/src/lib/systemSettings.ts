import { pool } from "@workspace/db";
import type { ToolName } from "./usageTracker";

export type PlanLimitMap = Record<ToolName, number>;

interface CachedSettings {
  maintenance_mode: boolean;
  allow_signups: boolean;
  planLimits: Record<string, PlanLimitMap>;
  fetchedAt: number;
}

const CACHE_TTL_MS = 30_000;

const TOOL_KEYS: ToolName[] = ["paper", "revision", "humanizer", "stem", "study", "plagiarism", "outline"];
const PLANS = ["starter", "student_pro_monthly", "pro", "campus", "institution"] as const;

const DEFAULT_LIMITS: Record<string, PlanLimitMap> = {
  starter:             { paper: 3,  revision: 1,  humanizer: 0,  stem: 15, study: 20,  plagiarism: 5,  outline: 5,  assistant: 30,  ebook: 0 },
  student_pro_monthly: { paper: 8,  revision: 4,  humanizer: 6,  stem: 40, study: 75,  plagiarism: 10, outline: 10, assistant: 150, ebook: 0 },
  pro:                 { paper: 15, revision: 20, humanizer: 20, stem: 60, study: 150, plagiarism: 20, outline: 20, assistant: 300, ebook: 0 },
  campus:              { paper: 5,  revision: 8,  humanizer: 8,  stem: 30, study: 75,  plagiarism: 10, outline: 10, assistant: 150, ebook: 0 },
  institution:         { paper: 5,  revision: 8,  humanizer: 8,  stem: 30, study: 75,  plagiarism: 10, outline: 10, assistant: 150, ebook: 0 },
};

let cache: CachedSettings | null = null;

export async function getSystemSettings(): Promise<Omit<CachedSettings, "fetchedAt">> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { maintenance_mode: cache.maintenance_mode, allow_signups: cache.allow_signups, planLimits: cache.planLimits };
  }

  try {
    const rows = await pool.query<{ key: string; value: string }>(
      "SELECT key, value FROM system_settings"
    );
    const map = Object.fromEntries(rows.rows.map((r) => [r.key, r.value]));

    const planLimits: Record<string, PlanLimitMap> = {};
    for (const plan of PLANS) {
      const base = { ...DEFAULT_LIMITS[plan] } as PlanLimitMap;
      for (const tool of TOOL_KEYS) {
        const key = `${plan}_${tool}`;
        if (map[key] !== undefined) {
          base[tool] = parseInt(map[key], 10) || 0;
        }
      }
      planLimits[plan] = base;
    }

    cache = {
      maintenance_mode: map.maintenance_mode === "true",
      allow_signups: map.allow_signups !== "false",
      planLimits,
      fetchedAt: now,
    };
  } catch {
    cache = {
      maintenance_mode: false,
      allow_signups: true,
      planLimits: DEFAULT_LIMITS as Record<string, PlanLimitMap>,
      fetchedAt: now,
    };
  }

  return { maintenance_mode: cache.maintenance_mode, allow_signups: cache.allow_signups, planLimits: cache.planLimits };
}

export async function getDynamicPlanLimits(): Promise<Record<string, PlanLimitMap>> {
  const { planLimits } = await getSystemSettings();
  return planLimits;
}

export function invalidateSettingsCache() {
  cache = null;
}
