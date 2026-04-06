/**
 * Student Persistent Memory — OpenClaw MEMORY.md + memU pattern.
 * Tracks per-student struggles, strengths, topics, and preferences.
 * Provides the "Jarvis Effect": AI remembers what topics a student finds hard.
 *
 * Per-user architecture: each Supabase userId gets their own profile row.
 * Falls back to a global shared profile for unauthenticated sessions.
 */

import { db } from "@workspace/db";
import { studentProfilesTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";

export interface StudentMemory {
  id: number;
  sessionCount: number;
  strengths: string[];
  struggles: string[];
  preferredSubjects: string[];
  recentTopics: string[];
  notes: string;
}

// ── Per-user profile lookup ────────────────────────────────────────────────────

export async function getStudentMemory(userId?: string): Promise<StudentMemory> {
  try {
    // Look up by userId if provided, otherwise use the shared anonymous profile
    const rows = userId
      ? await db.select().from(studentProfilesTable).where(eq(studentProfilesTable.userId, userId)).limit(1)
      : await db.select().from(studentProfilesTable).where(isNull(studentProfilesTable.userId)).limit(1);

    if (rows.length > 0) {
      const r = rows[0];
      return {
        id: r.id,
        sessionCount: r.sessionCount,
        strengths: safeJsonParse(r.strengths, []),
        struggles: safeJsonParse(r.struggles, []),
        preferredSubjects: safeJsonParse(r.preferredSubjects, []),
        recentTopics: safeJsonParse(r.recentTopics, []),
        notes: r.notes,
      };
    }

    // Create a new profile for this user
    const [created] = await db
      .insert(studentProfilesTable)
      .values({
        userId: userId ?? null,
        sessionCount: 0,
        strengths: "[]",
        struggles: "[]",
        preferredSubjects: "[]",
        recentTopics: "[]",
        notes: "",
      })
      .returning();

    return {
      id: created.id,
      sessionCount: 0,
      strengths: [],
      struggles: [],
      preferredSubjects: [],
      recentTopics: [],
      notes: "",
    };
  } catch {
    return {
      id: 0,
      sessionCount: 0,
      strengths: [],
      struggles: [],
      preferredSubjects: [],
      recentTopics: [],
      notes: "",
    };
  }
}

export async function updateStudentMemory(
  updates: {
    newTopic?: string;
    newStrength?: string;
    newStruggle?: string;
    subject?: string;
    noteFragment?: string;
  },
  userId?: string
): Promise<void> {
  try {
    const current = await getStudentMemory(userId);

    const recentTopics = updates.newTopic
      ? [updates.newTopic, ...current.recentTopics].slice(0, 20)
      : current.recentTopics;

    const strengths = updates.newStrength
      ? [...new Set([...current.strengths, updates.newStrength])].slice(0, 10)
      : current.strengths;

    const struggles = updates.newStruggle
      ? [...new Set([...current.struggles, updates.newStruggle])].slice(0, 10)
      : current.struggles;

    const preferredSubjects = updates.subject
      ? [...new Set([...current.preferredSubjects, updates.subject])].slice(0, 7)
      : current.preferredSubjects;

    const notes = updates.noteFragment
      ? (current.notes + "\n" + updates.noteFragment).slice(-2000)
      : current.notes;

    const payload = {
      sessionCount: current.sessionCount + 1,
      strengths: JSON.stringify(strengths),
      struggles: JSON.stringify(struggles),
      preferredSubjects: JSON.stringify(preferredSubjects),
      recentTopics: JSON.stringify(recentTopics),
      notes,
      updatedAt: new Date(),
    };

    if (current.id > 0) {
      await db
        .update(studentProfilesTable)
        .set(payload)
        .where(eq(studentProfilesTable.id, current.id));
    } else {
      // Row doesn't exist yet — create it
      await db.insert(studentProfilesTable).values({
        userId: userId ?? null,
        ...payload,
      });
    }
  } catch {
    // Non-fatal — memory updates should never block the response
  }
}

export function buildMemoryContext(memory: StudentMemory): string {
  if (
    memory.sessionCount === 0 &&
    memory.strengths.length === 0 &&
    memory.struggles.length === 0
  ) {
    return "";
  }

  const parts: string[] = ["[STUDENT MEMORY — personalise responses using this]"];
  if (memory.sessionCount > 0) parts.push(`Sessions so far: ${memory.sessionCount}`);
  if (memory.strengths.length) parts.push(`Known strengths: ${memory.strengths.join(", ")}`);
  if (memory.struggles.length) parts.push(`Topics needing extra support: ${memory.struggles.join(", ")}`);
  if (memory.recentTopics.length) parts.push(`Recently studied: ${memory.recentTopics.slice(0, 5).join(", ")}`);
  if (memory.preferredSubjects.length) parts.push(`Preferred subjects: ${memory.preferredSubjects.join(", ")}`);
  if (memory.notes.trim()) parts.push(`Session notes: ${memory.notes.slice(0, 400)}`);
  return parts.join("\n");
}

/**
 * Flush an important fact into the student's persistent notes.
 * Call whenever the AI detects something worth remembering long-term.
 */
export async function memoryFlush(importantFact: string, userId?: string): Promise<void> {
  const flushed = `[${new Date().toISOString().slice(0, 10)}] ${importantFact}`;
  await updateStudentMemory({ noteFragment: flushed }, userId);
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
