-- PromptForge V2 compatibility repair.
-- The first SQL shared in chat created a JSONB column named "data".
-- The application reads/writes "record_data". Preserve existing rows and add
-- the canonical column without deleting the original data.

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

-- Do not silently continue if existing rows could not be migrated.
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

commit;
