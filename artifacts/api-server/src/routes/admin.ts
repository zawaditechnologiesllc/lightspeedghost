import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable, studySessionsTable, studentProfilesTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function verifyAdminToken(req: Request): boolean {
  if (!ADMIN_PASSWORD) return false;
  const token = req.headers["x-admin-password"] as string | undefined;
  return token === ADMIN_PASSWORD;
}

/** Verify admin password — returns a token to use in subsequent calls */
router.post("/admin/verify", (req, res) => {
  const { password } = req.body as { password?: string };
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: "Admin not configured. Set ADMIN_PASSWORD environment variable." });
    return;
  }
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: "Invalid admin password" });
  }
});

/** Platform-wide stats */
router.get("/admin/stats", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const allDocs = await db.select().from(documentsTable);
    const allSessions = await db.select().from(studySessionsTable);

    const uniqueUsers = new Set([
      ...allDocs.map((d) => d.userId).filter(Boolean),
      ...allSessions.map((s) => s.userId).filter(Boolean),
    ]);

    const docsByType = allDocs.reduce(
      (acc, d) => {
        acc[d.type] = (acc[d.type] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const recentDocs = await db
      .select()
      .from(documentsTable)
      .orderBy(desc(documentsTable.updatedAt))
      .limit(10);

    res.json({
      totalUsers: uniqueUsers.size,
      totalDocuments: allDocs.length,
      papersWritten: docsByType["paper"] ?? 0,
      revisionsCompleted: docsByType["revision"] ?? 0,
      stemSolved: docsByType["stem"] ?? 0,
      studySessions: allSessions.length,
      recentDocuments: recentDocs.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/** List all users (from DB distinct userIds + Supabase admin API if service role set) */
router.get("/admin/users", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // First, collect distinct userIds from DB
    const docUsers = await db
      .select({ userId: documentsTable.userId })
      .from(documentsTable)
      .where(sql`${documentsTable.userId} is not null`);

    const sessionUsers = await db
      .select({ userId: studySessionsTable.userId })
      .from(studySessionsTable)
      .where(sql`${studySessionsTable.userId} is not null`);

    const userDocCounts: Record<string, number> = {};
    for (const { userId } of docUsers) {
      if (userId) userDocCounts[userId] = (userDocCounts[userId] ?? 0) + 1;
    }

    const userSessionCounts: Record<string, number> = {};
    for (const { userId } of sessionUsers) {
      if (userId) userSessionCounts[userId] = (userSessionCounts[userId] ?? 0) + 1;
    }

    const allUserIds = new Set([...Object.keys(userDocCounts), ...Object.keys(userSessionCounts)]);

    // If service role key is set, fetch user details from Supabase
    let supabaseUsers: Array<{ id: string; email: string; created_at: string; last_sign_in_at?: string }> = [];

    if (SUPABASE_SERVICE_ROLE_KEY && SUPABASE_URL) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=500`, {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
      });

      if (response.ok) {
        const data = await response.json() as { users?: typeof supabaseUsers };
        supabaseUsers = data.users ?? [];
      }
    }

    // Merge DB stats with Supabase user data
    const users = supabaseUsers.length > 0
      ? supabaseUsers.map((u) => ({
          id: u.id,
          email: u.email,
          createdAt: u.created_at,
          lastSignIn: u.last_sign_in_at ?? null,
          documentCount: userDocCounts[u.id] ?? 0,
          sessionCount: userSessionCounts[u.id] ?? 0,
        }))
      : Array.from(allUserIds).map((id) => ({
          id,
          email: null,
          createdAt: null,
          lastSignIn: null,
          documentCount: userDocCounts[id] ?? 0,
          sessionCount: userSessionCounts[id] ?? 0,
        }));

    res.json({ users, hasEmailData: supabaseUsers.length > 0 });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Delete a user (requires service role key) */
router.delete("/admin/users/:id", async (req: Request, res: Response) => {
  if (!verifyAdminToken(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_URL) {
    res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" });
    return;
  }

  const { id } = req.params;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
    });

    if (response.ok) {
      res.json({ ok: true });
    } else {
      const err = await response.json().catch(() => ({}));
      res.status(response.status).json({ error: "Failed to delete user", details: err });
    }
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
