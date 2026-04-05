import { pgTable, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export const paymentsTable = pgTable("payments", {
  id:                uuid("id").primaryKey().defaultRandom(),
  userId:            text("user_id").notNull(),
  gateway:           text("gateway").notNull(),
  gatewaySessionId:  text("gateway_session_id").notNull(),
  type:              text("type").notNull(),       // 'subscription' | 'payg'
  plan:              text("plan"),                 // 'pro_monthly' | 'pro_annual' | 'campus_annual'
  tool:              text("tool"),                 // payg: 'paper' | 'revision' | ...
  tier:              text("tier"),                 // payg: 'discussion' | 'essay' | ...
  amountCents:       integer("amount_cents").notNull(),
  currency:          text("currency").notNull().default("USD"),
  status:            text("status").notNull().default("pending"), // 'pending'|'completed'|'failed'
  metadata:          text("metadata"),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
  completedAt:       timestamp("completed_at"),
});

export const userSubscriptionsTable = pgTable("user_subscriptions", {
  userId:                  text("user_id").primaryKey(),
  plan:                    text("plan").notNull().default("free"), // 'free'|'pro'|'campus'
  billing:                 text("billing"),                        // 'monthly'|'annual'
  gateway:                 text("gateway"),
  gatewaySubscriptionId:   text("gateway_subscription_id"),
  status:                  text("status").notNull().default("active"), // 'active'|'cancelled'|'expired'
  currentPeriodEnd:        timestamp("current_period_end"),
  seats:                   integer("seats"),
  createdAt:               timestamp("created_at").notNull().defaultNow(),
  updatedAt:               timestamp("updated_at").notNull().defaultNow(),
});

export const gatewaySettingsTable = pgTable("gateway_settings", {
  gateway:    text("gateway").primaryKey(),
  paused:     boolean("paused").notNull().default(false),
  notes:      text("notes"),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
});

export const userRiskTable = pgTable("user_risk", {
  userId:    text("user_id").primaryKey(),
  riskLevel: text("risk_level").notNull().default("low"), // 'low'|'medium'|'high'
  reason:    text("reason"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
