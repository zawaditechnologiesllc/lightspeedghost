import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { db } from "@workspace/db";
import { studentProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const VALID_ACADEMIC_LEVELS = new Set([
  "high_school",
  "undergrad_1_2",
  "undergrad_3_4",
  "honours",
  "masters",
  "phd",
]);

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const [profile] = await db
      .select({ academicLevel: studentProfilesTable.academicLevel })
      .from(studentProfilesTable)
      .where(eq(studentProfilesTable.userId, userId))
      .limit(1);

    res.json({ academicLevel: profile?.academicLevel ?? "" });
  } catch (err) {
    req.log.error({ err }, "Error fetching user profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/profile", requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { academicLevel } = req.body as { academicLevel?: string };

    if (academicLevel !== undefined && !VALID_ACADEMIC_LEVELS.has(academicLevel)) {
      res.status(400).json({ error: "Invalid academic level" });
      return;
    }

    await db
      .insert(studentProfilesTable)
      .values({ userId, academicLevel: academicLevel ?? "" })
      .onConflictDoNothing();

    if (academicLevel !== undefined) {
      await db
        .update(studentProfilesTable)
        .set({ academicLevel, updatedAt: new Date() })
        .where(eq(studentProfilesTable.userId, userId));
    }

    res.json({ ok: true, academicLevel });
  } catch (err) {
    req.log.error({ err }, "Error updating user profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
