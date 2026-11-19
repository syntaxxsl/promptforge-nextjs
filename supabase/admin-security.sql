-- PromptForge — yetki yönetimi ve IP engelleme
-- Supabase > SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenlidir.

-- 1) Kullanıcı bazlı yetkiler
alter table public.users
  add column if not exists permissions text[] not null default '{}'::text[];

-- 2) IP engelleri
create table if not exists public.ip_bans (
  id uuid primary key default gen_random_uuid(),
  ip text not null unique,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists ip_bans_ip_idx on public.ip_bans (ip);
create index if not exists ip_bans_created_idx on public.ip_bans (created_at desc);

-- Tabloya yalnızca sunucu (service key) erişir; tarayıcıdan okunamaz.
alter table public.ip_bans enable row level security;

-- 3) Denetim kaydı için yeni işlem türlerine izin ver (kısıt varsa)
do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'admin_activity_logs_target_type_check'
  ) then
    alter table public.admin_activity_logs
      drop constraint admin_activity_logs_target_type_check;
  end if;
end $$;
