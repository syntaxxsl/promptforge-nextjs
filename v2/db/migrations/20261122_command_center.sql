-- PromptForge V2 Command Center telemetry.
-- Stores navigation metadata only; never store prompts, generated content, files, or secrets.
create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in ('page_view', 'tool_open')),
  route text not null check (char_length(route) between 1 and 180 and left(route, 1) = '/'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists platform_events_user_created_idx
  on public.platform_events (user_id, created_at desc);
create index if not exists platform_events_created_idx
  on public.platform_events (created_at desc);

alter table public.platform_events enable row level security;
alter table public.platform_events force row level security;

drop policy if exists "Users can read own platform events" on public.platform_events;
create policy "Users can read own platform events"
  on public.platform_events for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own platform events" on public.platform_events;
create policy "Users can insert own platform events"
  on public.platform_events for insert to authenticated
  with check (auth.uid() = user_id);

-- Admin-wide reads are performed server-side with the service role only after
-- checking the trusted auth.users.app_metadata.role claim in the application.
revoke all on public.platform_events from anon;
grant select, insert on public.platform_events to authenticated;
