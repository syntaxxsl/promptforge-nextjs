-- PromptForge 2.0 — Research Studio persistence
--
-- STATUS: PREPARED, NOT APPLIED.
-- This file has not been executed against any database. Applying it is a
-- separate, explicitly approved step.
--
-- TARGET: the V2 Supabase project (the same one used by /api/ai/chat).
-- Run order: this file after the V2 auth/session base exists.
--
-- SECURITY MODEL
-- Row Level Security is the primary control: every policy below restricts rows
-- to `auth.uid() = user_id`. The API layer additionally filters by user_id, so
-- a policy mistake alone cannot expose another user's research.
-- The service-role key bypasses RLS and is never used for these tables.

begin;

create table if not exists public.research_runs (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  topic       text not null,
  goal        text not null default '',
  depth       text not null default 'standard',
  provider    text,
  model       text,
  status      text not null default 'running',
  stages      jsonb not null default '[]'::jsonb,
  sources     jsonb not null default '[]'::jsonb,
  summary     text not null default '',
  report      text not null default '',
  error       text,
  origin      text not null default 'server',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint research_runs_depth_check
    check (depth in ('quick', 'standard', 'deep')),
  constraint research_runs_status_check
    check (status in ('draft', 'running', 'complete', 'failed')),
  constraint research_runs_origin_check
    check (origin in ('local', 'server')),
  constraint research_runs_topic_len_check
    check (char_length(topic) between 1 and 200)
);

create index if not exists research_runs_user_updated_idx
  on public.research_runs (user_id, updated_at desc);

-- Keeps updated_at honest on every write.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists research_runs_set_updated_at on public.research_runs;
create trigger research_runs_set_updated_at
  before update on public.research_runs
  for each row
  execute function public.set_updated_at();

alter table public.research_runs enable row level security;
alter table public.research_runs force row level security;

-- ---------------------------------------------------------------- policies
-- Four policies, one per operation. `to authenticated` matters: without it the
-- policy would also apply to anon, and `auth.uid()` would be null.

drop policy if exists research_runs_select_own on public.research_runs;
create policy research_runs_select_own
  on public.research_runs
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists research_runs_insert_own on public.research_runs;
create policy research_runs_insert_own
  on public.research_runs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists research_runs_update_own on public.research_runs;
create policy research_runs_update_own
  on public.research_runs
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists research_runs_delete_own on public.research_runs;
create policy research_runs_delete_own
  on public.research_runs
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------- grants
-- No anon access: a research run always belongs to a signed-in user.
revoke all on public.research_runs from anon;
grant select, insert, update, delete on public.research_runs to authenticated;

commit;

-- ---------------------------------------------------------------- verification
-- Run these after applying (read-only):
--
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where tablename = 'research_runs';
--
--   select relname, relrowsecurity, relforcerowsecurity
--     from pg_class
--    where relname = 'research_runs';
--
-- Expected: 4 policies (select/insert/update/delete, role = authenticated),
-- relrowsecurity = true, relforcerowsecurity = true.