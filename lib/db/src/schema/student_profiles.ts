import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentProfilesTable = pgTable("student_profiles", {
  id: serial("id").primaryKey(),
  sessionCount: integer("session_count").notNull().default(0),
  strengths: text("strengths").notNull().default("[]"),
  struggles: text("struggles").notNull().default("[]"),
  preferredSubjects: text("preferred_subjects").notNull().default("[]"),
  recentTopics: text("recent_topics").notNull().default("[]"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStudentProfileSchema = createInsertSchema(studentProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudentProfile = z.infer<typeof insertStudentProfileSchema>;
export type StudentProfile = typeof studentProfilesTable.$inferSelect;
