-- PromptForge V2 — cloud chat threads
-- Prepared for the V2 Supabase project only. Not applied automatically.
begin;

create table if not exists public.chat_threads (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null default 'Yeni sohbet',
  thread_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint chat_threads_id_length check (char_length(id) between 1 and 100),
  constraint chat_threads_title_length check (char_length(title) between 1 and 200),
  constraint chat_threads_data_object check (jsonb_typeof(thread_data) = 'object')
);

create index if not exists chat_threads_user_updated_idx
  on public.chat_threads (user_id, updated_at desc);

alter table public.chat_threads enable row level security;
alter table public.chat_threads force row level security;

drop policy if exists chat_threads_select_own on public.chat_threads;
create policy chat_threads_select_own
  on public.chat_threads for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists chat_threads_insert_own on public.chat_threads;
create policy chat_threads_insert_own
  on public.chat_threads for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists chat_threads_update_own on public.chat_threads;
create policy chat_threads_update_own
  on public.chat_threads for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists chat_threads_delete_own on public.chat_threads;
create policy chat_threads_delete_own
  on public.chat_threads for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.chat_threads to authenticated;
revoke all on public.chat_threads from anon;

commit;
