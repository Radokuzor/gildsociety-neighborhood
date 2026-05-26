-- Migration 004: add email to subscribers + pkce_verifiers table

-- Add email column to subscribers (captures email immediately on magic-link
-- sign-in, before the user completes the onboarding form)
ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Make neighborhood_id optional so a stub row can be inserted at login time
-- (neighborhood is filled in properly when onboarding is completed)
ALTER TABLE subscribers
  ALTER COLUMN neighborhood_id DROP NOT NULL;

-- Temporary PKCE verifier storage.
-- Verifiers are generated server-side, stored here with a 10-minute TTL,
-- and deleted immediately after the code exchange succeeds.
CREATE TABLE IF NOT EXISTS pkce_verifiers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code_verifier TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Only the service role should touch this table
ALTER TABLE pkce_verifiers ENABLE ROW LEVEL SECURITY;

-- Clean up expired verifiers automatically (Supabase pg_cron or manual sweep)
-- Rows older than 10 minutes are safe to delete at any time.
