-- PromptForge — brute force koruması ve güvenlik olayları
-- Supabase > SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenlidir.

-- 1) Giriş denemeleri (brute force sayaçları)
create table if not exists public.login_attempts (
  key text primary key,
  attempts integer not null default 0,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  locked_until timestamptz
);

create index if not exists login_attempts_locked_idx
  on public.login_attempts (locked_until);

-- Tabloya yalnızca sunucu (service key) erişir.
alter table public.login_attempts enable row level security;

-- 2) Güvenlik olayları (admine rapor)
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null default 'warning',
  ip text,
  email text,
  user_id uuid,
  path text,
  user_agent text,
  detail jsonb not null default '{}'::jsonb,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists security_events_created_idx
  on public.security_events (created_at desc);
create index if not exists security_events_unread_idx
  on public.security_events (acknowledged, created_at desc);
create index if not exists security_events_kind_idx
  on public.security_events (kind, created_at desc);

alter table public.security_events enable row level security;

-- 3) Eski kayıtları temizle (isteğe bağlı, pg_cron varsa)
-- delete from public.security_events where created_at < now() - interval '180 days';
-- delete from public.login_attempts where last_at < now() - interval '7 days';

-- Kontrol: iki tablo da RLS açık olmalı.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('login_attempts', 'security_events');
