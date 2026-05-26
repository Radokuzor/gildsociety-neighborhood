-- ─────────────────────────────────────────────────────────────────────────────
-- Add last_name column to subscribers
-- Run this in Supabase SQL Editor or via Supabase CLI
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.subscribers
  add column if not exists last_name text;
