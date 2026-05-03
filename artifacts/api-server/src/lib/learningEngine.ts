/**
 * Learning Engine — Adaptive source weighting + quality feedback loop.
 *
 * The system learns from every search:
 *  1. Which databases consistently return results for which subjects
 *  2. Which topics a student visits most (for personalised paper surfacing)
 *  3. Writes quality stats to PostgreSQL so learning persists across restarts
 *
 * Pattern: Fire-and-forget writes, non-blocking reads with safe fallbacks.
 * Inspired by OpenClaw's self-improving retrieval pipeline.
 */

import { pool } from "@workspace/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SourceStats {
  source: string;
  subject: string;
  totalQueries: number;
  totalResults: number;
  avgResults: number;
  successRate: number;   // 0–1, proportion of queries returning ≥1 result
}

export interface SearchRecord {
  source: string;
  resultCount: number;
}

// ── Table bootstrap ───────────────────────────────────────────────────────────

const tableReady = pool
  .query(`
    CREATE TABLE IF NOT EXISTS source_learning_stats (
      id           SERIAL PRIMARY KEY,
      source       TEXT NOT NULL,
      subject      TEXT NOT NULL DEFAULT 'general',
      total_queries  INTEGER NOT NULL DEFAULT 0,
      total_results  INTEGER NOT NULL DEFAULT 0,
      success_count  INTEGER NOT NULL DEFAULT 0,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (source, subject)
    );
    CREATE INDEX IF NOT EXISTS idx_sls_source_subject ON source_learning_stats (source, subject);
  `)
  .catch(() => {});

// ── Core functions ─────────────────────────────────────────────────────────────

/**
 * Record the results from a multi-source search.
 * Call fire-and-forget after every `searchAllAcademicSources` invocation.
 *
 * @param records  Array of { source, resultCount } from each database
 * @param subject  Discipline detected for the query (e.g. "biomedical")
 */
export async function recordSearchResults(
  records: SearchRecord[],
  subject: string
): Promise<void> {
  await tableReady;
  const normalized = subject.toLowerCase().replace(/[^a-z]/g, "_").slice(0, 40) || "general";

  const values = records
    .map((r) => {
      const src = r.source.replace(/'/g, "''").slice(0, 100);
      const success = r.resultCount > 0 ? 1 : 0;
      return `('${src}', '${normalized}', 1, ${r.resultCount}, ${success}, NOW())`;
    })
    .join(", ");

  if (!values) return;

  await pool
    .query(`
      INSERT INTO source_learning_stats (source, subject, total_queries, total_results, success_count, updated_at)
      VALUES ${values}
      ON CONFLICT (source, subject) DO UPDATE SET
        total_queries  = source_learning_stats.total_queries  + EXCLUDED.total_queries,
        total_results  = source_learning_stats.total_results  + EXCLUDED.total_results,
        success_count  = source_learning_stats.success_count  + EXCLUDED.success_count,
        updated_at     = NOW()
    `)
    .catch(() => {});
}

/**
 * Return learned performance stats for all sources for a given subject.
 * Used to log insights to the admin dashboard or debug output.
 */
export async function getSourceStats(subject = "general"): Promise<SourceStats[]> {
  await tableReady;
  try {
    const { rows } = await pool.query<{
      source: string;
      subject: string;
      total_queries: number;
      total_results: number;
      success_count: number;
    }>(
      `SELECT source, subject, total_queries, total_results, success_count
       FROM source_learning_stats
       WHERE subject = $1
       ORDER BY total_results DESC`,
      [subject]
    );

    return rows.map((r) => ({
      source: r.source,
      subject: r.subject,
      totalQueries: r.total_queries,
      totalResults: r.total_results,
      avgResults: r.total_queries > 0 ? r.total_results / r.total_queries : 0,
      successRate: r.total_queries > 0 ? r.success_count / r.total_queries : 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Record a topic that was searched for, keyed to a user.
 * Enables personalised paper surfacing in future sessions.
 */
export async function recordTopicSearch(userId: string, topic: string): Promise<void> {
  await tableReady;
  if (!userId || !topic) return;

  const safe = topic.replace(/'/g, "''").slice(0, 200);
  const safeUser = userId.replace(/'/g, "''").slice(0, 100);

  await pool
    .query(`
      CREATE TABLE IF NOT EXISTS user_topic_history (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL,
        topic      TEXT NOT NULL,
        searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO user_topic_history (user_id, topic, searched_at)
      VALUES ('${safeUser}', '${safe}', NOW());
    `)
    .catch(() => {});
}

/**
 * Get the top topics a user has searched for.
 * Can be used to proactively surface relevant papers.
 */
export async function getUserTopTopics(
  userId: string,
  limit = 5
): Promise<string[]> {
  if (!userId) return [];
  try {
    const { rows } = await pool.query<{ topic: string; cnt: number }>(
      `SELECT topic, COUNT(*) as cnt
       FROM user_topic_history
       WHERE user_id = $1
       GROUP BY topic
       ORDER BY cnt DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows.map((r) => r.topic);
  } catch {
    return [];
  }
}

/**
 * Record a quality signal: when AI verification or plagiarism check
 * returns a specific score, store it so we can track quality over time.
 */
export async function recordQualitySignal(data: {
  userId?: string;
  type: "plagiarism" | "ai_detection" | "grade_verify";
  score: number;          // 0–100
  subject?: string;
  paperWordCount?: number;
}): Promise<void> {
  await tableReady;

  await pool
    .query(`
      CREATE TABLE IF NOT EXISTS quality_signals (
        id           SERIAL PRIMARY KEY,
        user_id      TEXT,
        signal_type  TEXT NOT NULL,
        score        NUMERIC NOT NULL,
        subject      TEXT,
        word_count   INTEGER,
        recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO quality_signals (user_id, signal_type, score, subject, word_count, recorded_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `,
    [data.userId ?? null, data.type, data.score, data.subject ?? null, data.paperWordCount ?? null])
    .catch(() => {});
}

/**
 * Get average quality scores for a user or globally.
 * Used by the admin dashboard to show platform-wide quality metrics.
 */
export async function getAverageQualityScores(userId?: string): Promise<{
  avgPlagiarism: number;
  avgAiDetection: number;
  avgGrade: number;
  totalSignals: number;
}> {
  try {
    const condition = userId ? `WHERE user_id = '${userId.replace(/'/g, "''")}'` : "";
    const { rows } = await pool.query<{
      signal_type: string;
      avg_score: number;
      cnt: number;
    }>(
      `SELECT signal_type, AVG(score)::numeric(5,1) as avg_score, COUNT(*) as cnt
       FROM quality_signals
       ${condition}
       GROUP BY signal_type`
    );

    const byType: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byType[r.signal_type] = parseFloat(String(r.avg_score));
      total += r.cnt;
    }

    return {
      avgPlagiarism: byType["plagiarism"] ?? 0,
      avgAiDetection: byType["ai_detection"] ?? 0,
      avgGrade: byType["grade_verify"] ?? 0,
      totalSignals: total,
    };
  } catch {
    return { avgPlagiarism: 0, avgAiDetection: 0, avgGrade: 0, totalSignals: 0 };
  }
}
