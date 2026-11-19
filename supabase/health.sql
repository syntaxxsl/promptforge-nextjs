-- PromptForge sistem sağlığı: otomatik tarama sonuçları (sadece admin görür)

create table if not exists public.system_health_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trigger_source text not null default 'manual',
  ok boolean not null default false,
  passed integer not null default 0,
  warned integer not null default 0,
  failed integer not null default 0,
  duration_ms integer not null default 0,
  results jsonb not null default '[]'::jsonb
);

create index if not exists system_health_runs_created_idx
  on public.system_health_runs (created_at desc);

alter table public.system_health_runs enable row level security;
