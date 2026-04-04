/**
 * Student Persistent Memory — OpenClaw MEMORY.md + memU pattern.
 * Tracks per-student struggles, strengths, topics, and preferences.
 * Provides the "Jarvis Effect": AI remembers what topics a student finds hard.
 */

import { db } from "@workspace/db";
import { studentProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface StudentMemory {
  id: number;
  sessionCount: number;
  strengths: string[];
  struggles: string[];
  preferredSubjects: string[];
  recentTopics: string[];
  notes: string;
}

const DEFAULT_PROFILE_ID = 1;

export async function getStudentMemory(): Promise<StudentMemory> {
  const rows = await db
    .select()
    .from(studentProfilesTable)
    .where(eq(studentProfilesTable.id, DEFAULT_PROFILE_ID));

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

  const [created] = await db
    .insert(studentProfilesTable)
    .values({
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
}

export async function updateStudentMemory(updates: {
  newTopic?: string;
  newStrength?: string;
  newStruggle?: string;
  subject?: string;
  noteFragment?: string;
}): Promise<void> {
  const current = await getStudentMemory();

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

  await db
    .update(studentProfilesTable)
    .set({
      sessionCount: current.sessionCount + 1,
      strengths: JSON.stringify(strengths),
      struggles: JSON.stringify(struggles),
      preferredSubjects: JSON.stringify(preferredSubjects),
      recentTopics: JSON.stringify(recentTopics),
      notes,
      updatedAt: new Date(),
    })
    .where(eq(studentProfilesTable.id, DEFAULT_PROFILE_ID));
}

export function buildMemoryContext(memory: StudentMemory): string {
  const parts: string[] = ["[STUDENT MEMORY — use this to personalize responses]"];
  if (memory.sessionCount > 0) parts.push(`Sessions so far: ${memory.sessionCount}`);
  if (memory.strengths.length) parts.push(`Strengths: ${memory.strengths.join(", ")}`);
  if (memory.struggles.length) parts.push(`Topics needing support: ${memory.struggles.join(", ")}`);
  if (memory.recentTopics.length) parts.push(`Recently studied: ${memory.recentTopics.slice(0, 5).join(", ")}`);
  if (memory.preferredSubjects.length) parts.push(`Preferred subjects: ${memory.preferredSubjects.join(", ")}`);
  if (memory.notes.trim()) parts.push(`Notes: ${memory.notes.slice(0, 400)}`);
  return parts.join("\n");
}

/**
 * Flush important facts before memory gets compacted.
 * Inspired by OpenClaw's memory_flush pattern.
 */
export async function memoryFlush(importantFact: string): Promise<void> {
  const current = await getStudentMemory();
  const flushed = `[${new Date().toISOString().slice(0, 10)}] ${importantFact}`;
  await updateStudentMemory({
    noteFragment: flushed,
  });
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
