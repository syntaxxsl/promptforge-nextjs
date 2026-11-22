-- PromptForge V2 compatibility repair.
-- The first SQL shared in chat created a JSONB column named "data".
-- The application reads/writes "record_data". Preserve existing rows and add
-- the canonical column without deleting the original data.
-- Also harden the public share RPC created by the earlier chat SQL.

begin;

alter table public.studio_records
  add column if not exists record_data jsonb;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'studio_records'
      and column_name = 'data'
  ) then
    execute 'update public.studio_records
             set record_data = coalesce(record_data, data)
             where record_data is null';
  end if;
end
$$;

do $$
begin
  if exists (select 1 from public.studio_records where record_data is null) then
    raise exception 'studio_records contains rows without record_data; inspect the data column before retrying';
  end if;
end
$$;

alter table public.studio_records
  alter column record_data set not null;

grant select, insert, update, delete on public.studio_records to authenticated;
revoke all on public.studio_records from anon;

create or replace function public.get_project_share(p_token_hash text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'snapshot', shares.snapshot,
    'expiresAt', shares.expires_at
  )
  from public.project_shares as shares
  where shares.token_hash = p_token_hash
    and shares.revoked_at is null
    and shares.expires_at > now()
  limit 1;
$$;

revoke all on function public.get_project_share(text) from public;
grant execute on function public.get_project_share(text) to anon, authenticated;

commit;
