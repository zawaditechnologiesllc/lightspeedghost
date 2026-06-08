import app from "./app";
import { logger } from "./lib/logger";
import { ensureUsageTable } from "./lib/usageTracker";
import { initReferralTables } from "./routes/referral";
import { initEbooksTable } from "./routes/ebooks";
import { startScheduler } from "./seo-engine/scheduler";
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
  DATABASE_URL:              "PostgreSQL connection string (Supabase → Settings → Database → Connection string)",
  SUPABASE_JWT_SECRET:       "Supabase JWT secret (Supabase → Settings → API → JWT Secret)",
  SUPABASE_URL:              "Your Supabase project URL, e.g. https://xxxx.supabase.co (Supabase → Settings → API → Project URL) — required for ES256/RS256 JWT verification",
  SUPABASE_SERVICE_ROLE_KEY: "Supabase service role key (Supabase → Settings → API → service_role) — required to list users in Admin panel",
  OPENAI_API_KEY:            "OpenAI API key (platform.openai.com → API keys)",
  ANTHROPIC_API_KEY:         "Anthropic API key (console.anthropic.com → API keys)",
  SESSION_SECRET:            "Random 32-char string for session cookies",
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
    // Add columns that may be missing on older deployments (safe no-ops if they already exist)
    await pool.query(`
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id     TEXT;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_number  INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS word_count  INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS subject     TEXT;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP NOT NULL DEFAULT NOW();
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

  // 7. Ensure referral tables exist (affiliate / ambassador program)
  try {
    await initReferralTables();
    logger.info("[startup] referral tables ready");
  } catch (err) {
    logger.error({ err }, "[startup] Failed to ensure referral tables — affiliate program may fail");
  }

  // 8. Ensure ebooks subscription table exists
  try {
    await initEbooksTable();
    logger.info("[startup] ebooks table ready");
  } catch (err) {
    logger.error({ err }, "[startup] Failed to ensure ebooks table — ebook subscriptions may fail");
  }

  // 9. Ensure SEO engine tables exist
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS seo_pages (
        id                  BIGSERIAL PRIMARY KEY,
        slug                TEXT UNIQUE NOT NULL,
        title               TEXT NOT NULL DEFAULT '',
        meta_description    TEXT,
        content_html        TEXT,
        schema_json         JSONB,
        keywords            TEXT[],
        page_type           TEXT NOT NULL DEFAULT 'tool',
        audience_segment    TEXT,
        tool_focus          TEXT,
        software_focus      TEXT,
        paper_type_focus    TEXT,
        financial_focus     TEXT,
        cluster_id          TEXT,
        cluster_page_type   TEXT,
        cluster_page_number INTEGER,
        published           BOOLEAN NOT NULL DEFAULT false,
        status              TEXT NOT NULL DEFAULT 'draft',
        word_count          INTEGER,
        unique_data_points  INTEGER,
        has_faq_schema      BOOLEAN NOT NULL DEFAULT false,
        has_ai_disclosure   BOOLEAN NOT NULL DEFAULT false,
        integrity_check     BOOLEAN NOT NULL DEFAULT false,
        llm_used            TEXT,
        llm_cost_usd        NUMERIC(10,6),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS seo_article_clusters (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic            TEXT NOT NULL,
        topic_slug       TEXT NOT NULL,
        tool_focus       TEXT NOT NULL DEFAULT '',
        competitor       TEXT NOT NULL DEFAULT 'auto',
        audience_segment TEXT NOT NULL DEFAULT 'students',
        status           TEXT NOT NULL DEFAULT 'pending',
        current_stage    TEXT NOT NULL DEFAULT 'research',
        pages_completed  INTEGER NOT NULL DEFAULT 0,
        research_data    JSONB,
        outline_data     JSONB,
        error_message    TEXT,
        started_at       TIMESTAMPTZ,
        completed_at     TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS seo_llm_cost_log (
        id            BIGSERIAL PRIMARY KEY,
        task_type     TEXT NOT NULL,
        model_used    TEXT NOT NULL,
        input_tokens  INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
        page_slug     TEXT,
        logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS seo_budget_status (
        month             TEXT PRIMARY KEY,
        gemini_spend_usd  NUMERIC(10,4) NOT NULL DEFAULT 0,
        claude_spend_usd  NUMERIC(10,4) NOT NULL DEFAULT 0,
        total_spend_usd   NUMERIC(10,4) NOT NULL DEFAULT 0,
        budget_limit_usd  NUMERIC(10,4) NOT NULL DEFAULT 25,
        pages_generated   INTEGER NOT NULL DEFAULT 0,
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id             SERIAL PRIMARY KEY,
        name           TEXT NOT NULL,
        email          TEXT UNIQUE NOT NULL,
        sectors        TEXT[] NOT NULL DEFAULT '{}',
        password_hash  TEXT NOT NULL,
        active         BOOLEAN NOT NULL DEFAULT true,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    logger.info("[startup] SEO engine tables ready");
  } catch (err) {
    logger.error({ err }, "[startup] Failed to ensure SEO tables — SEO engine may fail");
  }
}

runStartupTasks().catch((err) => {
  logger.error({ err }, "[startup] Startup tasks failed");
});

// Start SEO article scheduler (runs daily at configured UTC time)
startScheduler();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
