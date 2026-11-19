-- PromptForge güvenlik ve performans şeması
-- Supabase SQL Editor'de tek seferde çalıştırılabilir.

-- 1) Yönetici aktivite kayıtları -------------------------------------------------
create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_logs_created_idx
  on public.admin_activity_logs (created_at desc);

-- Bu tabloya yalnızca sunucu (service role) yazar; istemci erişimi kapalı.
alter table public.admin_activity_logs enable row level security;

-- 2) Şifreli API anahtarları -----------------------------------------------------
create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  encrypted_key text not null,
  last_four text,
  created_at timestamptz not null default now(),
  unique (user_id, label)
);

create index if not exists user_api_keys_user_idx
  on public.user_api_keys (user_id, created_at desc);

alter table public.user_api_keys enable row level security;

-- Kullanıcı yalnızca kendi kayıtlarını görebilir/silebilir.
-- Şifreli anahtar değeri istemciye hiçbir zaman gönderilmez (API rotası maskeler).
drop policy if exists "user_api_keys_select_own" on public.user_api_keys;
create policy "user_api_keys_select_own"
  on public.user_api_keys for select
  using (auth.uid() = user_id);

drop policy if exists "user_api_keys_delete_own" on public.user_api_keys;
create policy "user_api_keys_delete_own"
  on public.user_api_keys for delete
  using (auth.uid() = user_id);

-- 3) Sorgu performansı için indeksler -------------------------------------------
create index if not exists projects_user_updated_idx
  on public.projects (user_id, updated_at desc);

create index if not exists projects_user_deleted_idx
  on public.projects (user_id, deleted_at);

create index if not exists projects_share_token_idx
  on public.projects (share_token)
  where share_token is not null;

create index if not exists project_versions_project_idx
  on public.project_versions (project_id, created_at desc);

create index if not exists support_tickets_user_idx
  on public.support_tickets (user_id, created_at desc);

create index if not exists support_tickets_replied_idx
  on public.support_tickets (user_id)
  where admin_reply is not null;

create index if not exists project_chat_messages_project_idx
  on public.project_chat_messages (project_id, created_at);

-- 4) RLS kontrol listesi (tablolarınızın hepsinde açık olmalı) -------------------
-- Aşağıdaki komutlar, RLS kapalı tabloları listeler. Boş dönmesi gerekir.
--
--   select tablename
--   from pg_tables
--   where schemaname = 'public'
--     and tablename not in ('admin_activity_logs')
--     and rowsecurity = false;
