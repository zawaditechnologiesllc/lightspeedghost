-- ============================================================
-- Light Speed Ghost — Database Schema
-- Run this in Supabase → SQL Editor to initialise the database
-- ============================================================

-- Documents table (papers, outlines, revisions, STEM solutions)
CREATE TABLE IF NOT EXISTS documents (
  id          SERIAL PRIMARY KEY,
  title       TEXT      NOT NULL,
  content     TEXT      NOT NULL DEFAULT '',
  type        TEXT      NOT NULL,           -- paper | revision | stem | study
  subject     TEXT,
  word_count  INTEGER   NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Study sessions table
CREATE TABLE IF NOT EXISTS study_sessions (
  id             SERIAL PRIMARY KEY,
  title          TEXT      NOT NULL DEFAULT 'New Session',
  subject        TEXT,
  message_count  INTEGER   NOT NULL DEFAULT 0,
  last_activity  TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Study messages table (chat history per session)
CREATE TABLE IF NOT EXISTS study_messages (
  id          SERIAL PRIMARY KEY,
  session_id  INTEGER   NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  role        TEXT      NOT NULL,   -- user | assistant
  content     TEXT      NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_documents_type      ON documents (type);
CREATE INDEX IF NOT EXISTS idx_documents_created   ON documents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_messages_sess ON study_messages (session_id);
