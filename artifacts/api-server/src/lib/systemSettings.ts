import { pool } from "@workspace/db";

interface CachedSettings {
  maintenance_mode: boolean;
  allow_signups: boolean;
  fetchedAt: number;
}

const CACHE_TTL_MS = 30_000;

let cache: CachedSettings | null = null;

export async function getSystemSettings(): Promise<Omit<CachedSettings, "fetchedAt">> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { maintenance_mode: cache.maintenance_mode, allow_signups: cache.allow_signups };
  }

  try {
    const rows = await pool.query<{ key: string; value: string }>(
      "SELECT key, value FROM system_settings WHERE key IN ('maintenance_mode', 'allow_signups')"
    );
    const map = Object.fromEntries(rows.rows.map((r) => [r.key, r.value]));
    cache = {
      maintenance_mode: map.maintenance_mode === "true",
      allow_signups: map.allow_signups !== "false",
      fetchedAt: now,
    };
  } catch {
    cache = { maintenance_mode: false, allow_signups: true, fetchedAt: now };
  }

  return { maintenance_mode: cache.maintenance_mode, allow_signups: cache.allow_signups };
}

export function invalidateSettingsCache() {
  cache = null;
}
