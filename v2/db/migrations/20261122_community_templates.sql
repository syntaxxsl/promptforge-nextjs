-- PromptForge V2 — moderated community prompt marketplace
-- Prepared for the V2 Supabase project; apply manually before enabling public sharing.
begin;

create table if not exists public.community_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  description text not null default '' check (char_length(description) <= 300),
  category text not null check (category in ('Web tasarım','Yazılım','Marka','Araştırma','İçerik','Video','Ses','Tasarım','Diğer')),
  prompt text not null check (char_length(prompt) between 20 and 10000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_templates_status_created_idx
  on public.community_templates (status, created_at desc);
create index if not exists community_templates_owner_created_idx
  on public.community_templates (owner_id, created_at desc);

alter table public.community_templates enable row level security;
alter table public.community_templates force row level security;

drop policy if exists community_templates_read_visible on public.community_templates;
create policy community_templates_read_visible on public.community_templates
  for select to anon, authenticated
  using (
    status = 'approved'
    or owner_id = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists community_templates_submit_pending on public.community_templates;
create policy community_templates_submit_pending on public.community_templates
  for insert to authenticated
  with check (owner_id = auth.uid() and status = 'pending');

drop policy if exists community_templates_moderate_admin on public.community_templates;
create policy community_templates_moderate_admin on public.community_templates
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists community_templates_delete_pending_or_admin on public.community_templates;
create policy community_templates_delete_pending_or_admin on public.community_templates
  for delete to authenticated
  using (
    (owner_id = auth.uid() and status = 'pending')
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

grant select on public.community_templates to anon, authenticated;
grant insert, update, delete on public.community_templates to authenticated;

commit;
