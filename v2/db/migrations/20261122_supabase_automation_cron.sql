-- PromptForge V2 — run the automation dispatcher through Supabase Cron.
-- Required Vault secrets (create these in Supabase Dashboard > Vault first):
--   promptforge_cron_url    = https://YOUR-VERCEL-DOMAIN/api/cron/automations
--   promptforge_cron_secret = the same value configured as Vercel CRON_SECRET
--
-- The Vercel cron remains as a once-daily fallback for Hobby deployments.
-- Supabase Cron is the primary minute-level dispatcher.

begin;

create extension if not exists pg_cron with schema pg_catalog;
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'promptforge_cron_url'
  ) then
    raise exception 'Missing Vault secret: promptforge_cron_url';
  end if;

  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'promptforge_cron_secret'
  ) then
    raise exception 'Missing Vault secret: promptforge_cron_secret';
  end if;
end
$$;

-- Scheduling with the same job name updates the existing job rather than
-- creating duplicates. pg_net sends an authenticated GET to the Next.js route.
select cron.schedule(
  'promptforge-automation-scheduler',
  '* * * * *',
  $job$
    select net.http_get(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'promptforge_cron_url'
        limit 1
      ),
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'promptforge_cron_secret'
          limit 1
        )
      ),
      timeout_milliseconds := 55000
    );
  $job$
);

commit;
