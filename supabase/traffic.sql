-- PromptForge canlı trafik ve oturum takibi
-- Supabase → SQL Editor'de bir kez çalıştırın.

-- 1) Kullanıcı başına son durum (tek satır) --------------------------------------
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  ip text,
  user_agent text,
  last_path text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  view_count bigint not null default 0,
  login_count bigint not null default 0
);

create index if not exists user_presence_last_seen_idx
  on public.user_presence (last_seen desc);

alter table public.user_presence enable row level security;

-- 2) Olay akışı: giriş / çıkış / sayfa görüntüleme -------------------------------
create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  kind text not null,
  path text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists site_events_created_idx
  on public.site_events (created_at desc);

create index if not exists site_events_ip_idx
  on public.site_events (ip, created_at desc);

create index if not exists site_events_user_idx
  on public.site_events (user_id, created_at desc);

alter table public.site_events enable row level security;

-- Bu iki tabloya yalnızca sunucu (service role) yazar ve okur.
-- İstemci için politika tanımlanmaz; bu yüzden tarayıcıdan erişilemez.
