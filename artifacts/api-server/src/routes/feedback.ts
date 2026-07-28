/**
 * Output Feedback — captures user thumbs-up / thumbs-down on every AI output.
 * Feeds the intelligence loop: admin dashboard, quality trend analysis.
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { recordExemplar } from "../lib/learningEngine";

const router = Router();

async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS output_feedback (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT,
      type        TEXT NOT NULL,
      document_id INTEGER,
      rating      TEXT NOT NULL CHECK (rating IN ('up', 'down')),
      subject     TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_output_feedback_type    ON output_feedback (type);
    CREATE INDEX IF NOT EXISTS idx_output_feedback_user    ON output_feedback (user_id);
    CREATE INDEX IF NOT EXISTS idx_output_feedback_created ON output_feedback (created_at);
  `);
}

ensureTable().catch(() => {});

// POST /api/feedback
router.post("/feedback", async (req: Request, res: Response) => {
  const { type, documentId, rating, subject, output } = req.body as {
    type?: string;
    documentId?: number;
    rating?: string;
    subject?: string;
    output?: string; // optional: the rated output text, used to seed exemplars
  };

  if (!type || !rating || !["up", "down"].includes(rating)) {
    res.status(400).json({ error: "type and rating (up|down) are required" });
    return;
  }

  const userId: string | null = (req as Request & { userId?: string }).userId ?? null;

  try {
    await pool.query(
      `INSERT INTO output_feedback (user_id, type, document_id, rating, subject, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, type, documentId ?? null, rating, subject ?? null]
    );
    // A 👍 with the output attached becomes an exemplar — closing the loop so
    // this tool's future generations are steered toward what users rewarded.
    if (rating === "up" && typeof output === "string" && output.trim().length >= 40) {
      recordExemplar({ tool: type, subject, output, score: 90 }).catch(() => {});
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

// ── The "learn" side of the loop ──────────────────────────────────────────────
// Aggregate approval per tool over a window. Phase 2 uses this to (a) surface a
// quality-trend widget in admin, and (b) nudge each tool's model/temperature and
// inject top-rated exemplars into its prompt — a feedback→prompt loop with no
// fine-tuning. Exposed for reuse by the tools + admin.
export interface FeedbackStats { type: string; up: number; down: number; approval: number; total: number; }
export async function getFeedbackStats(type: string, days = 30): Promise<FeedbackStats> {
  try {
    await ensureTable();
    const { rows } = await pool.query<{ up: string; down: string }>(
      `SELECT
         COALESCE(SUM(CASE WHEN rating = 'up'   THEN 1 ELSE 0 END), 0) AS up,
         COALESCE(SUM(CASE WHEN rating = 'down' THEN 1 ELSE 0 END), 0) AS down
       FROM output_feedback
       WHERE type = $1 AND created_at > NOW() - ($2 || ' days')::interval`,
      [type, String(days)],
    );
    const up = parseInt(rows[0]?.up ?? "0", 10);
    const down = parseInt(rows[0]?.down ?? "0", 10);
    const total = up + down;
    return { type, up, down, total, approval: total ? Math.round((up / total) * 100) : 0 };
  } catch {
    return { type, up: 0, down: 0, total: 0, approval: 0 };
  }
}

export default router;
