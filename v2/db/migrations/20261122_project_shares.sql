-- PromptForge V2 — expiring, read-only project share snapshots.
-- Apply this migration in the V2 Supabase SQL editor before enabling public share links.
begin;

create table if not exists public.project_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists project_shares_user_created_idx
  on public.project_shares (user_id, created_at desc);

alter table public.project_shares enable row level security;
alter table public.project_shares force row level security;

drop policy if exists project_shares_select_own on public.project_shares;
create policy project_shares_select_own on public.project_shares
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists project_shares_insert_own on public.project_shares;
create policy project_shares_insert_own on public.project_shares
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists project_shares_delete_own on public.project_shares;
create policy project_shares_delete_own on public.project_shares
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.project_shares from anon;
grant select, insert, delete on public.project_shares to authenticated;

create or replace function public.get_project_share(p_token_hash text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('snapshot', snapshot, 'expiresAt', expires_at)
  from public.project_shares
  where token_hash = p_token_hash
    and revoked_at is null
    and expires_at > now()
  limit 1;
$$;

revoke all on function public.get_project_share(text) from public;
grant execute on function public.get_project_share(text) to anon, authenticated;

commit;
