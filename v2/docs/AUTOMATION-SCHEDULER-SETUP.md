# PromptForge V2 — Automation scheduler setup

PromptForge's scheduled automations are evaluated once per minute. Vercel Hobby cron is limited to one scheduled invocation per day, so Supabase Cron is the primary minute-level dispatcher. The Vercel cron in `vercel.json` is retained as a once-daily fallback.

## 1. Configure the Vercel secret

In the Vercel project settings for `promptforge-v2`, set `CRON_SECRET` to a fresh, high-entropy value. Do not paste the value into GitHub, this document, or a chat. If the previous value was shared outside the secret manager, rotate it.

## 2. Add two secrets to Supabase Vault

Open the Supabase project for PromptForge, then open **Vault** (under Database / Integrations, depending on the Dashboard layout). Add these two secrets:

| Name | Value |
|---|---|
| `promptforge_cron_url` | `https://YOUR-VERCEL-DOMAIN/api/cron/automations` |
| `promptforge_cron_secret` | The exact same fresh value configured as Vercel `CRON_SECRET` |

Use the active production domain shown in the Vercel project's **Settings → Domains**. Do not include a trailing slash in the URL.

## 3. Apply the migration

Run the complete file `db/migrations/20261122_supabase_automation_cron.sql` in the Supabase SQL Editor after both Vault secrets exist.

The migration enables `pg_cron` and `pg_net`, validates the two Vault entries, and schedules `promptforge-automation-scheduler` every minute. Re-running the migration updates the job with the same name rather than creating a second scheduled job.

## 4. Verify it

In Supabase, open **Integrations → Cron** (or query the database):

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'promptforge-automation-scheduler';
```

Check recent executions:

```sql
select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'promptforge-automation-scheduler'
)
order by start_time desc
limit 10;
```

A successful HTTP dispatch should return HTTP 200 from `/api/cron/automations`. The endpoint itself still requires the `CRON_SECRET` bearer header and the existing Supabase admin configuration.

## Notes

- Vercel Hobby's once-daily cron is only a fallback. Supabase Cron provides the minute-level schedule needed by user-defined automations.
- The endpoint's database uniqueness constraint prevents the daily Vercel fallback and Supabase dispatcher from executing the same automation for the same scheduled minute twice.
- Supabase Cron and `pg_net` run inside the Supabase database. Their job history is visible in the Supabase Cron dashboard.
- The migration is committed to the repository but is **not applied automatically**. Apply it in the Supabase SQL Editor; do not assume the scheduler is active until the verification query shows the job and recent successful runs.
