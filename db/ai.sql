-- PromptForge yapay zekâ ayarları ve günlük kullanım sayacı
-- Supabase > SQL Editor içinde tek seferde çalıştırılabilir.

-- 1) Site geneli yapay zekâ ayarları (tek satır: id = 1) ------------------------
create table if not exists public.ai_settings (
  id integer primary key check (id = 1),
  default_provider text not null default 'groq',
  daily_limit integer not null default 20 check (daily_limit >= 0),
  enabled_providers text[] not null default array[
    'groq', 'openai', 'anthropic', 'gemini',
    'openrouter', 'deepseek', 'mistral', 'xai'
  ],
  models jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Yalnızca sunucu (service role) okur/yazar; istemci erişimi kapalı.
alter table public.ai_settings enable row level security;

insert into public.ai_settings (id)
values (1)
on conflict (id) do nothing;

-- 2) Kullanıcı başına günlük istek sayacı ---------------------------------------
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);

create index if not exists ai_usage_day_idx on public.ai_usage (day);

alter table public.ai_usage enable row level security;

-- 3) Kullanıcı anahtarları için sağlayıcı etiketi -------------------------------
-- user_api_keys tablosu db/security.sql içinde oluşturuluyor.
-- Buradaki "label" alanı sağlayıcı kimliğini taşır: groq, openai, anthropic...
-- (ör. label = 'groq'). Aynı kullanıcı aynı sağlayıcı için tek anahtar tutar.

-- 4) Şifreleme anahtarı hatırlatması -------------------------------------------
-- Kullanıcı anahtarları AES-256-GCM ile şifrelenir ve
-- API_KEY_ENCRYPTION_SECRET ortam değişkeninden türetilir.
-- Vercel > Settings > Environment Variables içinde en az 32 karakterlik
-- rastgele bir değer tanımlı olmalı.
