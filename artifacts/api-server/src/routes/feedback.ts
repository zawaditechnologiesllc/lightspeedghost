/**
 * Output Feedback — captures user thumbs-up / thumbs-down on every AI output.
 * Feeds the intelligence loop: admin dashboard, quality trend analysis.
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";

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
  const { type, documentId, rating, subject } = req.body as {
    type?: string;
    documentId?: number;
    rating?: string;
    subject?: string;
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
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

export default router;
