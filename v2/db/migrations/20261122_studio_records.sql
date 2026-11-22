-- PromptForge V2 — generic per-user studio records
-- Prepared only; do not apply until the V2 Supabase project is ready.
begin;

create table if not exists public.studio_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  collection text not null check (collection in (
    'code-workspaces', 'projects', 'project-files', 'project-outputs',
    'agents', 'agent-runs', 'image-jobs', 'video-jobs'
  )),
  record_id text not null,
  record_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, record_id),
  constraint studio_records_id_length check (char_length(record_id) between 1 and 120),
  constraint studio_records_data_object check (jsonb_typeof(record_data) = 'object')
);

create index if not exists studio_records_user_collection_updated_idx
  on public.studio_records (user_id, collection, updated_at desc);

alter table public.studio_records enable row level security;
alter table public.studio_records force row level security;

drop policy if exists studio_records_select_own on public.studio_records;
create policy studio_records_select_own on public.studio_records
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists studio_records_insert_own on public.studio_records;
create policy studio_records_insert_own on public.studio_records
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists studio_records_update_own on public.studio_records;
create policy studio_records_update_own on public.studio_records
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists studio_records_delete_own on public.studio_records;
create policy studio_records_delete_own on public.studio_records
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.studio_records to authenticated;
revoke all on public.studio_records from anon;
commit;
