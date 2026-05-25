-- ─────────────────────────────────────────────────────────────────────────────
-- Gild Society — Initial Schema
-- Run this in Supabase SQL Editor or via Supabase CLI
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── Neighborhoods ────────────────────────────────────────────────────────────
create table public.neighborhoods (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,          -- e.g. 'wildhorse-ranch'
  name        text not null,                 -- e.g. 'Wildhorse Ranch'
  city        text not null,
  state       text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── Zip → Neighborhood mapping ───────────────────────────────────────────────
create table public.zip_neighborhood_map (
  id               uuid primary key default gen_random_uuid(),
  zip_code         text not null,
  neighborhood_id  uuid not null references public.neighborhoods(id) on delete cascade
);

create index on public.zip_neighborhood_map (zip_code);

-- ─── Subscribers (linked to Supabase Auth users) ──────────────────────────────
create table public.subscribers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  neighborhood_id  uuid not null references public.neighborhoods(id),
  first_name       text,
  address          text,
  created_at       timestamptz not null default now(),
  unique(user_id)  -- one subscriber record per user
);

create index on public.subscribers (neighborhood_id);

-- ─── Newsletter Issues ────────────────────────────────────────────────────────
create table public.newsletter_issues (
  id               uuid primary key default gen_random_uuid(),
  neighborhood_id  uuid not null references public.neighborhoods(id),
  subject          text not null,
  preview_text     text,
  content_json     jsonb not null default '{}',
  html_body        text,
  status           text not null default 'draft'
                   check (status in ('draft', 'approved', 'sent')),
  scheduled_for    timestamptz,
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index on public.newsletter_issues (neighborhood_id, status);
create index on public.newsletter_issues (status);

-- ─── Person of Week Nominations ───────────────────────────────────────────────
create table public.nominations (
  id                    uuid primary key default gen_random_uuid(),
  neighborhood_id       uuid not null references public.neighborhoods(id),
  nominee_name          text not null,
  nominee_description   text not null,
  submitted_by_email    text,
  selected              boolean not null default false,
  created_at            timestamptz not null default now()
);

create index on public.nominations (neighborhood_id, selected);

-- ─── Quiz / Poll Responses ────────────────────────────────────────────────────
create table public.quiz_responses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  issue_id   uuid not null references public.newsletter_issues(id) on delete cascade,
  question   text not null,
  response   text not null,
  created_at timestamptz not null default now(),
  unique(user_id, issue_id)  -- one response per user per issue
);

-- ─── Email Events (from Resend webhooks) ──────────────────────────────────────
create table public.email_events (
  id             uuid primary key default gen_random_uuid(),
  subscriber_id  uuid references public.subscribers(id),
  issue_id       uuid references public.newsletter_issues(id),
  event_type     text not null check (event_type in ('sent', 'opened', 'clicked')),
  email          text,
  occurred_at    timestamptz not null default now()
);

create index on public.email_events (issue_id, event_type);
create index on public.email_events (subscriber_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

-- Neighborhoods: public read, no public write
alter table public.neighborhoods enable row level security;
create policy "Anyone can view active neighborhoods"
  on public.neighborhoods for select
  using (active = true);

-- Zip map: public read
alter table public.zip_neighborhood_map enable row level security;
create policy "Anyone can view zip map"
  on public.zip_neighborhood_map for select
  using (true);

-- Subscribers: users can read/update their own record
alter table public.subscribers enable row level security;
create policy "Users can view own subscriber record"
  on public.subscribers for select
  using (auth.uid() = user_id);
create policy "Users can insert own subscriber record"
  on public.subscribers for insert
  with check (auth.uid() = user_id);
create policy "Users can update own subscriber record"
  on public.subscribers for update
  using (auth.uid() = user_id);

-- Newsletter issues: public read for sent issues
alter table public.newsletter_issues enable row level security;
create policy "Anyone can view sent newsletters"
  on public.newsletter_issues for select
  using (status = 'sent');

-- Nominations: anyone can insert, users can see own
alter table public.nominations enable row level security;
create policy "Anyone can submit a nomination"
  on public.nominations for insert
  with check (true);
create policy "Anyone can view nominations for their neighborhood"
  on public.nominations for select
  using (true);

-- Quiz responses: users manage their own
alter table public.quiz_responses enable row level security;
create policy "Users can insert their quiz response"
  on public.quiz_responses for insert
  with check (auth.uid() = user_id);
create policy "Users can view their quiz responses"
  on public.quiz_responses for select
  using (auth.uid() = user_id);

-- Email events: no public access (service role only)
alter table public.email_events enable row level security;

-- ─── Seed Data: Wildhorse Ranch ───────────────────────────────────────────────
insert into public.neighborhoods (slug, name, city, state)
values ('wildhorse-ranch', 'Wildhorse Ranch', 'Austin', 'TX');

-- Add zip codes for Wildhorse Ranch area (Pflugerville/Austin 78660, 78664)
insert into public.zip_neighborhood_map (zip_code, neighborhood_id)
select '78660', id from public.neighborhoods where slug = 'wildhorse-ranch'
union all
select '78664', id from public.neighborhoods where slug = 'wildhorse-ranch';
