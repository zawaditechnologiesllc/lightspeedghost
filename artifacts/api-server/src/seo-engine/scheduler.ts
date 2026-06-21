/**
 * SEO Article Scheduler — daily automated pipeline trigger.
 *
 * Runs at a configurable UTC time each day. Selects the best topic via
 * AI (+ GSC/GA4 if configured), starts the pipeline, and puts all 5
 * generated pages into the review queue. Admin reads and approves them.
 *
 * Settings in system_settings:
 *   scheduler_enabled  — 'true' | 'false'
 *   scheduler_time     — 'HH:MM' UTC (default '02:00')
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { selectTopic } from "./topic-selector";
import { startPipeline } from "./pipeline";

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

interface SchedulerSettings {
  enabled: boolean;
  time:    string;
}

async function getSchedulerSettings(): Promise<SchedulerSettings> {
  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM system_settings WHERE key IN ('scheduler_enabled', 'scheduler_time')`,
    );
    const s = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
    return {
      enabled: (s.scheduler_enabled ?? "false") !== "false",
      time:    s.scheduler_time ?? "02:00",
    };
  } catch {
    return { enabled: false, time: "02:00" };
  }
}

function msUntilNextRun(timeStr: string): number {
  const [h = 2, m = 0] = timeStr.split(":").map(Number);
  const now  = new Date();
  const next = new Date();
  next.setUTCHours(h, m, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

async function alreadyRanToday(): Promise<boolean> {
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*) AS cnt FROM seo_article_clusters
      WHERE created_at > NOW() - INTERVAL '20 hours'
        AND status NOT IN ('failed')
    `);
    return parseInt(rows[0]?.cnt ?? "0") > 0;
  } catch {
    return false;
  }
}

async function logSchedulerRun(
  status: "started" | "skipped" | "error",
  detail: string,
  clusterId?: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO seo_scheduler_log (status, detail, cluster_id) VALUES ($1, $2, $3)`,
      [status, detail, clusterId ?? null],
    );
  } catch { /* non-critical */ }
}

async function runScheduledPipeline(): Promise<void> {
  logger.info("[seo-scheduler] Scheduled trigger fired");

  if (await alreadyRanToday()) {
    logger.info("[seo-scheduler] Pipeline already ran in last 20 hours — skipping");
    await logSchedulerRun("skipped", "Pipeline already ran in last 20 hours");
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.error("[seo-scheduler] GEMINI_API_KEY not set");
    await logSchedulerRun("error", "GEMINI_API_KEY not configured");
    return;
  }

  const geminiClient = new GoogleGenerativeAI(apiKey);

  try {
    const selection = await selectTopic(geminiClient);
    logger.info({ topic: selection.topic, toolFocus: selection.toolFocus, source: selection.dataSource }, "[seo-scheduler] AI selected topic");

    const { clusterId, error } = await startPipeline({
      topic:           selection.topic,
      toolFocus:       selection.toolFocus,
      audienceSegment: selection.audienceSegment,
      autoPublish:     false,
    });

    if (error) {
      logger.error({ error }, "[seo-scheduler] startPipeline returned error");
      await logSchedulerRun("error", error);
    } else {
      logger.info({ clusterId, topic: selection.topic }, "[seo-scheduler] Pipeline started — pages will appear in review queue");
      await logSchedulerRun("started", `Topic: ${selection.topic} | Source: ${selection.dataSource} | Rationale: ${selection.rationale}`, clusterId);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "[seo-scheduler] Error running scheduled pipeline");
    await logSchedulerRun("error", msg);
  }
}

function scheduleNext(): void {
  getSchedulerSettings().then(({ enabled, time }) => {
    if (!enabled) {
      logger.info("[seo-scheduler] Scheduler is disabled — no run scheduled");
      return;
    }

    const ms = msUntilNextRun(time);
    const nextRun = new Date(Date.now() + ms).toISOString();
    logger.info({ nextRun, time }, "[seo-scheduler] Next scheduled run");

    schedulerTimer = setTimeout(async () => {
      await runScheduledPipeline();
      scheduleNext();
    }, ms);
  }).catch((err) => {
    logger.error({ err }, "[seo-scheduler] Failed to read settings — will retry in 1 hour");
    schedulerTimer = setTimeout(scheduleNext, 60 * 60 * 1000);
  });
}

export function startScheduler(): void {
  logger.info("[seo-scheduler] Starting");
  scheduleNext();
}

export function restartScheduler(): void {
  if (schedulerTimer) clearTimeout(schedulerTimer);
  schedulerTimer = null;
  scheduleNext();
}

export async function triggerNow(): Promise<{ ok: boolean; error?: string }> {
  try {
    await runScheduledPipeline();
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  }
}

export async function getSchedulerStatus(): Promise<{
  enabled:      boolean;
  time:         string;
  nextRunAt:    string | null;
  geminiKeySet: boolean;
  cronTokenSet: boolean;
  lastRuns:     Array<{ status: string; detail: string; createdAt: string; clusterId: string | null }>;
}> {
  const { enabled, time } = await getSchedulerSettings();
  const nextRunAt = enabled ? new Date(Date.now() + msUntilNextRun(time)).toISOString() : null;
  const geminiKeySet = Boolean(process.env.GEMINI_API_KEY);
  const cronTokenSet = Boolean(process.env.SEO_CRON_TOKEN);

  let lastRuns: Array<{ status: string; detail: string; createdAt: string; clusterId: string | null }> = [];
  try {
    const { rows } = await pool.query(
      `SELECT status, detail, created_at, cluster_id FROM seo_scheduler_log ORDER BY created_at DESC LIMIT 10`,
    );
    lastRuns = rows.map((r: Record<string, unknown>) => ({
      status:    String(r.status),
      detail:    String(r.detail ?? ""),
      createdAt: String(r.created_at),
      clusterId: r.cluster_id ? String(r.cluster_id) : null,
    }));
  } catch { /* table may not exist yet */ }

  return { enabled, time, nextRunAt, geminiKeySet, cronTokenSet, lastRuns };
}
