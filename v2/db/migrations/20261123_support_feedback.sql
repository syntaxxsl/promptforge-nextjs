-- PromptForge V2 — authenticated support requests and product feedback.
begin;

create table if not exists public.support_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('support', 'feedback')),
  title text not null check (char_length(title) between 3 and 120),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_note text not null default '' check (char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_feedback_status_created_idx
  on public.support_feedback (status, created_at desc);
create index if not exists support_feedback_user_created_idx
  on public.support_feedback (user_id, created_at desc);

alter table public.support_feedback enable row level security;
alter table public.support_feedback force row level security;

drop policy if exists support_feedback_read_own_or_admin on public.support_feedback;
create policy support_feedback_read_own_or_admin
  on public.support_feedback for select to authenticated
  using (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists support_feedback_insert_own on public.support_feedback;
create policy support_feedback_insert_own
  on public.support_feedback for insert to authenticated
  with check (auth.uid() = user_id and status = 'open' and admin_note = '');

drop policy if exists support_feedback_update_admin on public.support_feedback;
create policy support_feedback_update_admin
  on public.support_feedback for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

revoke all on public.support_feedback from anon;
grant select, insert, update on public.support_feedback to authenticated;

commit;
