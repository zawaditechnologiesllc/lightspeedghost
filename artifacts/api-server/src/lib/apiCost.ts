/**
 * API Cost Guardrails — OpenClaw Model Cost Command Center pattern.
 * Tracks usage per session and warns at 80% of daily budget threshold.
 */

export interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  operation: string;
  timestamp: Date;
}

// Pricing per 1M tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 0.25, output: 1.25 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

// ── Multi-instance note ───────────────────────────────────────────────────────
// These are in-process counters. In a single-instance deployment (Render Starter,
// Docker single container) they are accurate. When running 2+ horizontal instances
// (Render Standard+, Kubernetes, etc.) each instance has its own counter — the
// admin /api-costs endpoint shows that instance's spend only.
//
// For accurate cross-instance tracking at 10M+ users/month, replace these with
// Redis INCRBYFLOAT calls (e.g. Upstash Redis free tier handles ~10K writes/day):
//   const redis = new Redis(process.env.REDIS_URL);
//   await redis.incrbyfloat("lsg:cost:session", cost);
//   await redis.lpush("lsg:cost:log", JSON.stringify(record));
//
// Set REDIS_URL env var to enable; fall back to in-memory otherwise.

let sessionCostUsd = 0;
const usageLog: UsageRecord[] = [];
// Cap in-memory log at 10,000 records to prevent unbounded RAM growth on long uptime
const MAX_LOG_SIZE = 10_000;

const DAILY_BUDGET_USD = parseFloat(process.env.DAILY_BUDGET_USD ?? "5");
const WARN_THRESHOLD = 0.8;
const HARD_LIMIT_THRESHOLD = 1.0;

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const prices = PRICING[model] ?? { input: 3.0, output: 15.0 };
  return (
    (inputTokens / 1_000_000) * prices.input +
    (outputTokens / 1_000_000) * prices.output
  );
}

export function recordUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  operation: string
): number {
  const cost = calculateCost(model, inputTokens, outputTokens);
  sessionCostUsd += cost;

  // Evict oldest record when cap is reached (LRU-style, prevents unbounded RAM growth)
  if (usageLog.length >= MAX_LOG_SIZE) usageLog.shift();
  usageLog.push({ model, inputTokens, outputTokens, costUsd: cost, operation, timestamp: new Date() });

  const percentUsed = sessionCostUsd / DAILY_BUDGET_USD;
  if (percentUsed >= WARN_THRESHOLD) {
    console.warn(
      `[COST GUARD] Session cost $${sessionCostUsd.toFixed(4)} — ${(percentUsed * 100).toFixed(1)}% of $${DAILY_BUDGET_USD} daily budget`
    );
  }

  return cost;
}

export function checkBudget(): {
  ok: boolean;
  sessionCost: number;
  dailyBudget: number;
  percentUsed: number;
  warning: boolean;
} {
  const percentUsed = sessionCostUsd / DAILY_BUDGET_USD;
  return {
    ok: percentUsed < HARD_LIMIT_THRESHOLD,
    sessionCost: sessionCostUsd,
    dailyBudget: DAILY_BUDGET_USD,
    percentUsed: percentUsed * 100,
    warning: percentUsed >= WARN_THRESHOLD,
  };
}

export function getUsageLog(): UsageRecord[] {
  return [...usageLog];
}

export function getSessionCost(): number {
  return sessionCostUsd;
}
