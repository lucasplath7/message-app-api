-- ============================================================
-- Migration 002: Replace first_name / last_name with username
-- Run this against your PostgreSQL database once.
-- Safe to run whether old columns exist or were already removed.
-- ============================================================

-- Ensure username column exists.
ALTER TABLE messaging.users
  ADD COLUMN IF NOT EXISTS username VARCHAR(255);

-- If legacy columns still exist, back-fill username from names.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'messaging'
      AND table_name = 'users'
      AND column_name = 'first_name'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'messaging'
      AND table_name = 'users'
      AND column_name = 'last_name'
  ) THEN
    EXECUTE $sql$
      UPDATE messaging.users
      SET username = TRIM(COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), email))
      WHERE username IS NULL OR TRIM(username) = ''
    $sql$;
  END IF;
END
$$;

-- Final fallback so every row has a value, even if no legacy name data exists.
UPDATE messaging.users
SET username = email
WHERE username IS NULL OR TRIM(username) = '';

-- Remove legacy columns if present.
ALTER TABLE messaging.users
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name;

-- Enforce new constraints.
ALTER TABLE messaging.users
  ALTER COLUMN username SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_username_unique'
  ) THEN
    ALTER TABLE messaging.users
      ADD CONSTRAINT users_username_unique UNIQUE (username);
  END IF;
END
$$;

