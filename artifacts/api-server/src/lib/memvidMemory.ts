/**
 * LightSpeed AI Memory — Persistent semantic memory per student.
 * Stores a single-file memory capsule as base64 in PostgreSQL so it
 * survives server restarts and redeployments with no extra infrastructure.
 *
 * Pattern: PostgreSQL → /tmp/{userId}.mv2 → Memvid SDK → /tmp → PostgreSQL
 */

import { pool } from "@workspace/db";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const CAPSULE_DIR = path.join(os.tmpdir(), "lsg-capsules");

async function getMemvid() {
  try {
    return await import("@memvid/sdk");
  } catch {
    return null;
  }
}

async function ensureCapsuleDir(): Promise<void> {
  await fs.mkdir(CAPSULE_DIR, { recursive: true });
}

function capsulePath(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return path.join(CAPSULE_DIR, `${safe}.mv2`);
}

async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_memory_capsules (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL UNIQUE,
      capsule_data TEXT,
      frame_count INTEGER NOT NULL DEFAULT 0,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

ensureTable().catch(() => {});

async function loadCapsule(userId: string): Promise<string | null> {
  try {
    await ensureCapsuleDir();
    const filePath = capsulePath(userId);

    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      // Not cached in /tmp yet — load from DB
    }

    const { rows } = await pool.query<{ capsule_data: string | null }>(
      "SELECT capsule_data FROM user_memory_capsules WHERE user_id = $1",
      [userId],
    );

    if (rows[0]?.capsule_data) {
      const bytes = Buffer.from(rows[0].capsule_data, "base64");
      await fs.writeFile(filePath, bytes);
      return filePath;
    }

    return null;
  } catch {
    return null;
  }
}

async function saveCapsule(userId: string): Promise<void> {
  try {
    const filePath = capsulePath(userId);
    const bytes = await fs.readFile(filePath);
    const base64 = bytes.toString("base64");
    const frameCount = Math.max(1, Math.floor(bytes.length / 400));

    await pool.query(
      `INSERT INTO user_memory_capsules (user_id, capsule_data, frame_count, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET capsule_data = $2, frame_count = $3, updated_at = NOW()`,
      [userId, base64, frameCount],
    );
  } catch {
    // Non-fatal — memory persistence failure should never block the response
  }
}

/**
 * Index a study Q&A exchange into the user's persistent memory capsule.
 * Called fire-and-forget after every study assistant response.
 */
export async function indexStudyExchange(
  userId: string,
  question: string,
  answer: string,
  topic: string,
  subject: string,
): Promise<void> {
  const memvid = await getMemvid();
  if (!memvid) return;

  try {
    await ensureCapsuleDir();
    const filePath = capsulePath(userId);
    await loadCapsule(userId);

    const mv = await memvid.use("basic", filePath, { mode: "auto" });

    await mv.put({
      title: topic || question.slice(0, 60),
      label: subject || "General",
      text: `Question: ${question}\n\nAnswer: ${answer.slice(0, 1200)}`,
      metadata: {
        subject,
        topic,
        timestamp: new Date().toISOString(),
        type: "study_exchange",
      },
    });

    await mv.seal();
    await saveCapsule(userId);
  } catch {
    // Non-fatal
  }
}

/**
 * Semantic recall — search the user's memory capsule for relevant past context.
 * Returns a formatted string ready to inject into the AI system prompt.
 */
export async function recallStudyContext(
  userId: string,
  query: string,
  k = 3,
): Promise<string> {
  const memvid = await getMemvid();
  if (!memvid) return "";

  try {
    const filePath = await loadCapsule(userId);
    if (!filePath) return "";

    const mv = await memvid.use("basic", filePath, { mode: "open", readOnly: true });
    const results = await mv.find(query, { k, mode: "lex" });
    await mv.seal();

    if (!results?.hits?.length) return "";

    const snippets = results.hits
      .map((h: { title: string; snippet: string }) => `• ${h.title}: ${h.snippet}`)
      .join("\n");

    return `STUDENT LONG-TERM MEMORY (topics & exchanges from past sessions):\n${snippets}`;
  } catch {
    return "";
  }
}

/**
 * Return a timeline of the student's recent study topics.
 * Used on the Study Assistant dashboard for "Your learning history".
 */
export async function getStudyTimeline(
  userId: string,
  limit = 10,
): Promise<Array<{ title: string; label: string }>> {
  const memvid = await getMemvid();
  if (!memvid) return [];

  try {
    const filePath = await loadCapsule(userId);
    if (!filePath) return [];

    const mv = await memvid.use("basic", filePath, { mode: "open", readOnly: true });
    const timeline = await mv.timeline({ limit });
    await mv.seal();

    return (timeline || []).map((t: { title?: string; label?: string }) => ({
      title: t.title ?? "Study session",
      label: t.label ?? "General",
    }));
  } catch {
    return [];
  }
}

/**
 * Return the total number of indexed memory frames for a user.
 */
export async function getMemoryStats(userId: string): Promise<{ frameCount: number }> {
  try {
    const { rows } = await pool.query<{ frame_count: number }>(
      "SELECT frame_count FROM user_memory_capsules WHERE user_id = $1",
      [userId],
    );
    return { frameCount: rows[0]?.frame_count ?? 0 };
  } catch {
    return { frameCount: 0 };
  }
}
