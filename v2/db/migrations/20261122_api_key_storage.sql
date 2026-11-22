-- PromptForge V2 — encrypted provider API key storage
-- STATUS: prepared only. This migration has NOT been applied to any database.
-- Apply only to the dedicated V2 Supabase project after reviewing this file.

begin;

create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in (
    'openai', 'anthropic', 'gemini', 'groq',
    'openrouter', 'deepseek', 'mistral', 'xai'
  )),
  key_encrypted text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists user_api_keys_user_provider_idx
  on public.user_api_keys (user_id, provider);

alter table public.user_api_keys enable row level security;
alter table public.user_api_keys force row level security;

drop policy if exists user_api_keys_select_own on public.user_api_keys;
create policy user_api_keys_select_own
  on public.user_api_keys for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_api_keys_insert_own on public.user_api_keys;
create policy user_api_keys_insert_own
  on public.user_api_keys for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_api_keys_update_own on public.user_api_keys;
create policy user_api_keys_update_own
  on public.user_api_keys for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_api_keys_delete_own on public.user_api_keys;
create policy user_api_keys_delete_own
  on public.user_api_keys for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_api_keys to authenticated;
revoke all on public.user_api_keys from anon;

-- Admin-managed pool. No client role receives privileges or RLS policies.
-- The service-role client is the only intended reader/writer.
create table if not exists public.ai_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in (
    'openai', 'anthropic', 'gemini', 'groq',
    'openrouter', 'deepseek', 'mistral', 'xai'
  )),
  encrypted_key text not null,
  active boolean not null default true,
  cooldown_until timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_keys_provider_active_idx
  on public.ai_keys (provider, active, last_used_at);

alter table public.ai_keys enable row level security;
alter table public.ai_keys force row level security;
revoke all on public.ai_keys from anon, authenticated;

commit;

-- Verification after a separately approved apply:
-- select tablename, policyname, cmd, roles
-- from pg_policies where tablename in ('user_api_keys', 'ai_keys');
-- user_api_keys: four authenticated own-row policies.
-- ai_keys: no policies; inaccessible to anon/authenticated roles.
