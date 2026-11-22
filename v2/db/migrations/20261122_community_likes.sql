-- PromptForge V2 — private prompt likes with public aggregate counts
-- Prepared for the V2 Supabase project; apply after 20261122_community_templates.sql.
begin;

alter table public.community_templates
  add column if not exists like_count integer not null default 0
  check (like_count >= 0);

create table if not exists public.community_template_likes (
  template_id uuid not null references public.community_templates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (template_id, user_id)
);

create index if not exists community_template_likes_user_idx
  on public.community_template_likes (user_id, created_at desc);

alter table public.community_template_likes enable row level security;
alter table public.community_template_likes force row level security;

drop policy if exists community_template_likes_read_own on public.community_template_likes;
create policy community_template_likes_read_own on public.community_template_likes
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists community_template_likes_insert_own on public.community_template_likes;
create policy community_template_likes_insert_own on public.community_template_likes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists community_template_likes_delete_own on public.community_template_likes;
create policy community_template_likes_delete_own on public.community_template_likes
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.update_community_template_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_templates
      set like_count = like_count + 1
      where id = new.template_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.community_templates
      set like_count = greatest(0, like_count - 1)
      where id = old.template_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists community_template_like_insert on public.community_template_likes;
create trigger community_template_like_insert
  after insert on public.community_template_likes
  for each row execute function public.update_community_template_like_count();

drop trigger if exists community_template_like_delete on public.community_template_likes;
create trigger community_template_like_delete
  after delete on public.community_template_likes
  for each row execute function public.update_community_template_like_count();

grant select, insert, delete on public.community_template_likes to authenticated;
revoke all on public.community_template_likes from anon;

commit;
