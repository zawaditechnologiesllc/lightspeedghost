/**
 * Turnitin-style local plagiarism corpus — a self-building index that lives in
 * the Supabase Postgres we already run. It uses Postgres's built-in `pg_trgm`
 * trigram index (no extensions to buy, no external service, no LLM) so we can
 * compare a submitted passage against a growing local corpus of real academic
 * sources *instantly*, in-database.
 *
 * How it grows (ingestion pipeline): every time the live scan fetches abstracts
 * from the 35 academic databases, we UPSERT them here (deduped by content hash).
 * So the corpus compounds with real usage — the more the tool is used, the more
 * it can catch locally without hitting the external APIs. That's the same
 * flywheel a pre-built index gives you, built from sources we already retrieve.
 *
 * Everything is fault-tolerant: if pg_trgm isn't available, the table can't be
 * created, or a query fails, every function degrades to a no-op / empty result
 * and the caller's existing behaviour is unchanged. Zero risk to the live scan.
 */
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { logger } from "./logger";

export interface CorpusSourceInput {
  title: string;
  authors?: string;
  year?: number;
  url: string;
  sourceType?: string;
  content: string; // abstract / passage text to index
}

export interface CorpusMatch {
  title: string;
  authors: string;
  year: number | null;
  url: string;
  sourceType: string;
  similarity: number; // 0–100 (trigram word-similarity)
  matchedText: string;
}

const MIN_CONTENT = 80;     // don't index trivially short abstracts
const SIM_THRESHOLD = 0.30; // word_similarity cutoff for a reported match

function hashContent(content: string): string {
  return crypto.createHash("sha1").update(content.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
}

// Bootstrap once. pg_trgm ships with Postgres/Supabase; CREATE EXTENSION is
// idempotent. The GIN index accelerates trigram similarity lookups at scale.
let ready: Promise<boolean> | null = null;
function ensureCorpus(): Promise<boolean> {
  if (!ready) {
    ready = pool
      .query(`
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
        CREATE TABLE IF NOT EXISTS plagiarism_corpus (
          id           SERIAL PRIMARY KEY,
          content_hash TEXT NOT NULL UNIQUE,
          title        TEXT,
          authors      TEXT,
          year         INTEGER,
          url          TEXT,
          source_type  TEXT,
          content      TEXT NOT NULL,
          times_seen   INTEGER NOT NULL DEFAULT 1,
          added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_plag_corpus_trgm
          ON plagiarism_corpus USING gin (content gin_trgm_ops);
      `)
      .then(() => true)
      .catch((err) => {
        logger.warn({ err }, "[corpus] pg_trgm/table bootstrap failed — local corpus disabled");
        return false;
      });
  }
  return ready;
}

/**
 * Ingest fetched academic sources into the corpus (fire-and-forget safe).
 * Dedupes by content hash; a repeat source just bumps times_seen/last_seen.
 */
export async function ingestSources(sources: CorpusSourceInput[]): Promise<void> {
  if (!sources.length) return;
  if (!(await ensureCorpus())) return;

  const rows = sources.filter((s) => s.content && s.content.trim().length >= MIN_CONTENT);
  if (!rows.length) return;

  try {
    const values: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const s of rows) {
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
      params.push(
        hashContent(s.content),
        s.title?.slice(0, 500) ?? null,
        s.authors?.slice(0, 500) ?? null,
        Number.isFinite(s.year) ? s.year : null,
        s.url?.slice(0, 1000) ?? null,
        s.sourceType?.slice(0, 60) ?? "academic",
        s.content.slice(0, 8000),
      );
    }
    await pool.query(
      `INSERT INTO plagiarism_corpus (content_hash, title, authors, year, url, source_type, content)
       VALUES ${values.join(", ")}
       ON CONFLICT (content_hash) DO UPDATE
         SET times_seen = plagiarism_corpus.times_seen + 1, last_seen = NOW()`,
      params,
    );
  } catch (err) {
    logger.warn({ err }, "[corpus] ingest failed — non-fatal");
  }
}

/**
 * Search the local corpus for passages similar to `phrase` using pg_trgm
 * word-similarity (matches a short passage inside a longer stored abstract).
 * Returns [] on any error or empty corpus — always safe to call.
 */
export async function searchCorpus(phrase: string, limit = 5): Promise<CorpusMatch[]> {
  const q = phrase.trim();
  if (q.length < 25) return [];
  if (!(await ensureCorpus())) return [];

  try {
    const { rows } = await pool.query<{
      title: string; authors: string | null; year: number | null;
      url: string | null; source_type: string | null; content: string; sim: string;
    }>(
      `SELECT title, authors, year, url, source_type, content,
              word_similarity($1, content) AS sim
       FROM plagiarism_corpus
       WHERE word_similarity($1, content) > $2
       ORDER BY sim DESC
       LIMIT $3`,
      [q.slice(0, 500), SIM_THRESHOLD, limit],
    );
    return rows.map((r) => ({
      title: r.title ?? "Indexed academic source",
      authors: r.authors ?? "",
      year: r.year,
      url: r.url ?? "",
      sourceType: r.source_type ?? "corpus",
      similarity: Math.round(parseFloat(r.sim) * 1000) / 10,
      matchedText: r.content.slice(0, 160),
    }));
  } catch (err) {
    logger.warn({ err }, "[corpus] search failed — non-fatal");
    return [];
  }
}

/** Total indexed sources — for admin telemetry. Returns 0 on error. */
export async function corpusSize(): Promise<number> {
  if (!(await ensureCorpus())) return 0;
  try {
    const { rows } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM plagiarism_corpus`);
    return parseInt(rows[0]?.n ?? "0", 10);
  } catch {
    return 0;
  }
}
