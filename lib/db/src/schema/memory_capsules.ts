import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const userMemoryCapsulesTable = pgTable("user_memory_capsules", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  capsuleData: text("capsule_data"),
  frameCount: integer("frame_count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UserMemoryCapsule = typeof userMemoryCapsulesTable.$inferSelect;
