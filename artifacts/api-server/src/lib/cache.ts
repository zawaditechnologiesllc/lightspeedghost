/**
 * LightSpeed Ghost — Upstash Redis cache layer
 *
 * Caches expensive external API calls (academic databases, citation lookups).
 * Gracefully degrades to a no-op when UPSTASH_REDIS_REST_URL is not set.
 *
 * Set these env vars in Render (and optionally Replit dev):
 *   UPSTASH_REDIS_REST_URL   — e.g. https://xxxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — your Upstash token
 */

import { Redis } from "@upstash/redis";

const TTL = {
  citations:    60 * 60 * 6,    // 6 hours  — citations are stable
  academicRag:  60 * 60 * 2,    // 2 hours  — RAG source lists
  stemPapers:   60 * 60 * 6,    // 6 hours  — Semantic Scholar
  outline:      60 * 60 * 24,   // 24 hours — outline structures
  plagiarism:   60 * 60 * 1,    // 1 hour   — plagiarism analysis
} as const;

type TtlKey = keyof typeof TTL;

let _redis: Redis | null = null;
let _attempted = false;

function getRedis(): Redis | null {
  if (_attempted) return _redis;
  _attempted = true;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  try {
    _redis = new Redis({ url, token });
    return _redis;
  } catch {
    return null;
  }
}

/** Stable, safe cache key from arbitrary string params */
function makeKey(op: string, ...parts: string[]): string {
  const normalized = parts
    .map((p) => p.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_.-]/g, ""))
    .join(":");
  return `lsg:${op}:${normalized}`;
}

/**
 * Try to get a cached value. Returns undefined on miss or when cache is disabled.
 */
export async function cacheGet<T>(op: string, ...keyParts: string[]): Promise<T | undefined> {
  const redis = getRedis();
  if (!redis) return undefined;
  try {
    const key = makeKey(op, ...keyParts);
    const raw = await redis.get<string>(key);
    if (raw === null || raw === undefined) return undefined;
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
  } catch {
    return undefined;
  }
}

/**
 * Store a value in cache. Silent no-op on error or when cache is disabled.
 */
export async function cacheSet<T>(
  op: TtlKey,
  value: T,
  ...keyParts: string[]
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const key = makeKey(op, ...keyParts);
    await redis.set(key, JSON.stringify(value), { ex: TTL[op] });
  } catch {
    /* ignore — cache is best-effort */
  }
}

/**
 * Convenience: get-or-compute with automatic caching.
 *
 * @example
 *   const result = await withCache("citations", () => expensiveFetch(), topic, subject);
 */
export async function withCache<T>(
  op: TtlKey,
  compute: () => Promise<T>,
  ...keyParts: string[]
): Promise<T> {
  const cached = await cacheGet<T>(op, ...keyParts);
  if (cached !== undefined) return cached;
  const result = await compute();
  cacheSet(op, result, ...keyParts).catch(() => {}); // fire-and-forget
  return result;
}

/** Delete a specific cache entry (e.g. on admin invalidation). */
export async function cacheDel(op: string, ...keyParts: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(makeKey(op, ...keyParts));
  } catch {
    /* ignore */
  }
}

/** Returns true when Redis is configured and reachable. */
export async function cacheHealthy(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}
