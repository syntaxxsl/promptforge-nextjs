-- PromptForge yönetici API deposu (anahtar havuzu) ve kullanıcı bazlı yapay zekâ erişimi
-- Supabase > SQL Editor içinde tek seferde çalıştırılabilir.

-- 1) Anahtar havuzu -------------------------------------------------------------
-- Yönetici buraya istediği kadar anahtar ekler. Aynı sağlayıcıdan birden fazla
-- anahtar olabilir; istekler sırayla döner, limite takılan anahtar dinlenmeye alınır.
create table if not exists public.ai_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  label text not null default '',
  encrypted_key text not null,
  last_four text not null default '',
  active boolean not null default true,
  model text,
  note text,
  cooldown_until timestamptz,
  last_used_at timestamptz,
  last_error text,
  uses_today integer not null default 0,
  uses_day date,
  total_uses bigint not null default 0,
  error_count integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_keys_provider_idx
  on public.ai_keys (provider, active);

-- Yalnızca sunucu (service role) erişir; anahtarlar istemciye hiç gitmez.
alter table public.ai_keys enable row level security;

-- 2) Kullanıcı bazlı yapay zekâ erişimi -----------------------------------------
-- mode:
--   'site' = yalnızca sitenin havuzunu kullanır (günlük haktan düşer)
--   'own'  = yalnızca kendi anahtarını kullanır (sınırsız, ücret kendisinde)
--   'both' = kendi anahtarı varsa onu, yoksa site havuzunu kullanır (varsayılan)
--   'off'  = yapay zekâ kapalı
-- daily_limit boşsa ai_settings.daily_limit geçerlidir.
-- providers boşsa açık olan tüm sağlayıcılar serbesttir.
create table if not exists public.ai_user_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mode text not null default 'both'
    check (mode in ('site', 'own', 'both', 'off')),
  daily_limit integer check (daily_limit is null or daily_limit >= 0),
  providers text[],
  note text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.ai_user_access enable row level security;

-- 3) Anahtarlar AES-256-GCM ile şifrelenir; sır API_KEY_ENCRYPTION_SECRET
--    ortam değişkeninden türetilir (Vercel > Environment Variables).
