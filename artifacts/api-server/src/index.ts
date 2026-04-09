import app from "./app";
import { logger } from "./lib/logger";
import { ensureUsageTable } from "./lib/usageTracker";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Startup env-var audit ─────────────────────────────────────────────────────
// Logs which critical variables are present/absent so Render logs tell you exactly
// what to add — no guesswork needed.
const REQUIRED_VARS: Record<string, string> = {
  DATABASE_URL:         "PostgreSQL connection string (Supabase → Settings → Database → Connection string)",
  SUPABASE_JWT_SECRET:  "Supabase JWT secret (Supabase → Settings → API → JWT Secret)",
  OPENAI_API_KEY:       "OpenAI API key (platform.openai.com → API keys)",
  ANTHROPIC_API_KEY:    "Anthropic API key (console.anthropic.com → API keys)",
  SESSION_SECRET:       "Random 32-char string for session cookies",
};

const missingVars: string[] = [];
for (const [name, hint] of Object.entries(REQUIRED_VARS)) {
  if (!process.env[name]) {
    missingVars.push(name);
    logger.error(`[startup] MISSING env var: ${name} — ${hint}`);
  } else {
    logger.info(`[startup] env var OK: ${name}`);
  }
}

if (missingVars.length > 0) {
  logger.warn(
    `[startup] ${missingVars.length} env var(s) missing: ${missingVars.join(", ")}. ` +
    "Tools will fail until these are configured in your hosting provider's environment settings.",
  );
}

// ── Startup DB tasks ──────────────────────────────────────────────────────────
async function runStartupTasks(): Promise<void> {
  // 1. Verify DB connection
  try {
    await pool.query("SELECT 1");
    logger.info("[startup] Database connection OK");
  } catch (err) {
    logger.error({ err }, "[startup] FATAL: Cannot connect to database. Check DATABASE_URL.");
    process.exit(1);
  }

  // 2. Ensure user_usage table exists — created via raw SQL because it is
  //    managed outside of Drizzle ORM (usage tracker uses pg pool directly).
  try {
    await ensureUsageTable();
    logger.info("[startup] user_usage table ready");
  } catch (err) {
    logger.error({ err }, "[startup] Failed to ensure user_usage table — usage tracking may fail");
  }

  // 3. Ensure user_sessions table exists (express-session store)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      ) WITH (OIDS=FALSE);
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");
    `);
    logger.info("[startup] user_sessions table ready");
  } catch (err) {
    logger.error({ err }, "[startup] Failed to ensure user_sessions table");
  }

  // 4. Ensure documents table exists (stores all generated papers, outlines, etc.)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT,
        title       TEXT NOT NULL,
        content     TEXT NOT NULL DEFAULT '',
        type        TEXT NOT NULL,
        subject     TEXT,
        doc_number  INTEGER NOT NULL DEFAULT 0,
        word_count  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("[startup] documents table ready");
  } catch (err) {
    logger.error({ err }, "[startup] Failed to ensure documents table — paper saving will fail");
  }

  // 5. Ensure study_sessions and study_messages tables exist (AI Tutor tool)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS study_sessions (
        id             SERIAL PRIMARY KEY,
        user_id        TEXT,
        title          TEXT NOT NULL DEFAULT 'New Session',
        subject        TEXT,
        message_count  INTEGER NOT NULL DEFAULT 0,
        last_activity  TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at     TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS study_messages (
        id          SERIAL PRIMARY KEY,
        session_id  INTEGER NOT NULL REFERENCES study_sessions(id),
        role        TEXT NOT NULL,
        content     TEXT NOT NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    logger.info("[startup] study_sessions and study_messages tables ready");
  } catch (err) {
    logger.error({ err }, "[startup] Failed to ensure study tables — AI Tutor may fail");
  }

  // 6. Ensure student_profiles table exists (study assistant personalised memory)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_profiles (
        id            SERIAL PRIMARY KEY,
        user_id       TEXT,
        session_count INTEGER     NOT NULL DEFAULT 0,
        strengths     TEXT        NOT NULL DEFAULT '[]',
        struggles     TEXT        NOT NULL DEFAULT '[]',
        preferred_subjects TEXT   NOT NULL DEFAULT '[]',
        recent_topics TEXT        NOT NULL DEFAULT '[]',
        notes         TEXT        NOT NULL DEFAULT '',
        created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMP   NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("[startup] student_profiles table ready");
  } catch (err) {
    logger.error({ err }, "[startup] Failed to ensure student_profiles table");
  }
}

runStartupTasks().catch((err) => {
  logger.error({ err }, "[startup] Startup tasks failed");
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
