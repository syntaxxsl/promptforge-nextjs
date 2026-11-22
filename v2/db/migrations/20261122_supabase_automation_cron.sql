-- PromptForge V2 — run the automation dispatcher through Supabase Cron.
--
-- Required Vault secrets (create these in Supabase Dashboard > Vault first):
--   promptforge_cron_url      = https://YOUR-VERCEL-DOMAIN/api/cron/automations
--   promptforge_cron_secret   = the same value configured as Vercel CRON_SECRET
--   promptforge_vercel_bypass = the Vercel Deployment Protection bypass token
--
-- Two headers are mandatory:
--   Authorization               -> validated by the route handler (CRON_SECRET)
--   x-vercel-protection-bypass  -> gets past Vercel Deployment Protection, which
--                                  otherwise answers with the SSO HTML page and
--                                  the route never runs.
--
-- The Vercel cron remains as a once-daily fallback for Hobby deployments.
-- Supabase Cron is the primary minute-level dispatcher.

begin;

create extension if not exists pg_cron with schema pg_catalog;
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;

-- Scheduling with the same job name updates the existing job in place rather
-- than creating duplicates; the job id stays stable.
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
        ),
        'x-vercel-protection-bypass',
        (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'promptforge_vercel_bypass'
          limit 1
        )
      ),
      timeout_milliseconds := 55000
    );
  $job$
);

commit;