-- ============================================================
-- Migration 001: Messaging Schema
-- Run this against your PostgreSQL database once.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS messaging;

-- ----------------------------------------------------------------
-- Users  (synced from Clerk on every login)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messaging.users (
  id          VARCHAR(255) PRIMARY KEY,       -- Clerk user ID  (e.g. user_2abc…)
  email       VARCHAR(255) NOT NULL UNIQUE,
  username    VARCHAR(255) NOT NULL UNIQUE,
  image_url   TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- Threads
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messaging.threads (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     VARCHAR(500) NOT NULL,
  created_by  VARCHAR(255) NOT NULL REFERENCES messaging.users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- Thread participants  (1–10 recipients + creator)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messaging.thread_participants (
  thread_id  UUID         NOT NULL REFERENCES messaging.threads(id) ON DELETE CASCADE,
  user_id    VARCHAR(255) NOT NULL REFERENCES messaging.users(id),
  joined_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

-- ----------------------------------------------------------------
-- Messages
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messaging.messages (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID         NOT NULL REFERENCES messaging.threads(id) ON DELETE CASCADE,
  sender_id  VARCHAR(255) NOT NULL REFERENCES messaging.users(id),
  body       TEXT         NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_thread_participants_user_id
  ON messaging.thread_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id
  ON messaging.messages(thread_id);

CREATE INDEX IF NOT EXISTS idx_messages_thread_created
  ON messaging.messages(thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_threads_updated_at
  ON messaging.threads(updated_at DESC);

-- ----------------------------------------------------------------
-- updated_at auto-update trigger
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION messaging.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON messaging.users
  FOR EACH ROW EXECUTE FUNCTION messaging.set_updated_at();

CREATE OR REPLACE TRIGGER trg_threads_updated_at
  BEFORE UPDATE ON messaging.threads
  FOR EACH ROW EXECUTE FUNCTION messaging.set_updated_at();

CREATE OR REPLACE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON messaging.messages
  FOR EACH ROW EXECUTE FUNCTION messaging.set_updated_at();

