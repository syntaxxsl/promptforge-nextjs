-- PromptForge V2 — deduplicated scheduled workflow execution.
begin;

create table if not exists public.automation_schedule_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  automation_id text not null,
  scheduled_for timestamptz not null,
  status text not null default 'running'
    check (status in ('running', 'complete', 'failed')),
  run_id text,
  error text check (error is null or char_length(error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, automation_id, scheduled_for)
);

create index if not exists automation_schedule_executions_created_idx
  on public.automation_schedule_executions (created_at desc);

alter table public.automation_schedule_executions enable row level security;
alter table public.automation_schedule_executions force row level security;
revoke all on public.automation_schedule_executions from anon, authenticated;
grant all on public.automation_schedule_executions to service_role;

commit;
