import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studySessionsTable = pgTable("study_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  title: text("title").notNull().default("New Session"),
  subject: text("subject"),
  messageCount: integer("message_count").notNull().default(0),
  lastActivity: timestamp("last_activity").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudySessionSchema = createInsertSchema(studySessionsTable).omit({ id: true, createdAt: true });
export type InsertStudySession = z.infer<typeof insertStudySessionSchema>;
export type StudySession = typeof studySessionsTable.$inferSelect;

export const studyMessagesTable = pgTable("study_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => studySessionsTable.id),
  role: text("role").notNull(), // user | assistant
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudyMessageSchema = createInsertSchema(studyMessagesTable).omit({ id: true, createdAt: true });
export type InsertStudyMessage = z.infer<typeof insertStudyMessageSchema>;
export type StudyMessage = typeof studyMessagesTable.$inferSelect;
