-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Featured article pinning + app-wide settings
-- ─────────────────────────────────────────────────────────────────────────────

-- Add featured issue per neighborhood (admin pins this)
alter table public.neighborhoods
  add column if not exists featured_issue_id uuid
    references public.newsletter_issues(id) on delete set null;

-- App-wide settings table (key/value store)
-- Used for: default_neighborhood_slug, etc.
create table if not exists public.app_settings (
  key    text primary key,
  value  text not null,
  updated_at timestamptz not null default now()
);

-- Seed: default neighborhood is Wildhorse Ranch
insert into public.app_settings (key, value)
values ('default_neighborhood_slug', 'wildhorse-ranch')
on conflict (key) do nothing;

-- RLS: app_settings is read-only publicly, write via service role
alter table public.app_settings enable row level security;
create policy "Anyone can read app settings"
  on public.app_settings for select using (true);

-- Also allow public reads on ALL newsletter issues (not just sent),
-- but only for the featured article preview (even drafts can be previewed by admin).
-- For public users: only show sent issues.
-- The existing policy on newsletter_issues already handles this.
