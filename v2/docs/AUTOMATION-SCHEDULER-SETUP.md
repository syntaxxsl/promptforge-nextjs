# PromptForge V2 — Automation scheduler setup

PromptForge's scheduled automations are evaluated once per minute. Each dispatcher invocation also checks a bounded 10-minute catch-up window, processing the oldest due schedule first so a brief scheduler outage or a busy minute does not immediately lose every missed tick. Work that does not fit the invocation's time budget remains eligible on the next invocation. Vercel Hobby cron is limited to one scheduled invocation per day, so Supabase Cron is the primary minute-level dispatcher. The Vercel cron in `vercel.json` is retained as a once-daily fallback.

## 1. Configure the Vercel secret

In the Vercel project settings for `promptforge-v2`, set `CRON_SECRET` to a fresh, high-entropy value. Do not paste the value into GitHub, this document, or a chat. If the previous value was shared outside the secret manager, rotate it.

Changing this value only affects **new** deployments: Vercel snapshots the environment of each deployment at build time. After editing `CRON_SECRET`, trigger a fresh deployment (a new commit on the deployment branch) before testing.

## 2. Add three secrets to Supabase Vault

Open the Supabase project for PromptForge, then open **Vault** (under Database / Integrations, depending on the Dashboard layout). Add these secrets:

| Name | Value |
|---|---|
| `promptforge_cron_url` | `https://YOUR-VERCEL-DOMAIN/api/cron/automations` |
| `promptforge_cron_secret` | The exact same value configured as Vercel `CRON_SECRET` |
| `promptforge_vercel_bypass` | The Vercel Deployment Protection bypass token for the automation |

Use the active production domain shown in the Vercel project's **Settings → Domains**. Do not include a trailing slash in the URL.

## 3. Apply the migration

Run the complete file `db/migrations/20261122_supabase_automation_cron.sql` in the Supabase SQL Editor after the Vault secrets exist.

The migration enables `pg_cron` and `pg_net`, and schedules `promptforge-automation-scheduler` every minute. Re-running it updates the job with the same name (same job id) rather than creating a second scheduled job.

### Why two headers are required

The pg_cron job sends two headers, and both are mandatory:

| Header | Value source | Checked by |
|---|---|---|
| `Authorization: Bearer <secret>` | `promptforge_cron_secret` | the route handler (`CRON_SECRET` comparison) |
| `x-vercel-protection-bypass` | `promptforge_vercel_bypass` | Vercel Deployment Protection |

Without the bypass header, Vercel answers the request with the SSO/deployment-protection HTML page instead of the API route, so the route never executes. The symptom is a `net._http_response` row with `status_code = 200` whose body starts with `<!DOCTYPE html>` — a 200 that is not the API response.

## 4. Verify it

In Supabase, open **Integrations → Cron** (or query the database):

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'promptforge-automation-scheduler';
```

Check recent executions:

```sql
select id, status_code, left(content, 160) as snippet, created
from net._http_response
order by created desc
limit 10;
```

A successful dispatch returns `status_code = 200` with a JSON body such as `{"ok":true,"checked":0,"executed":0,"skipped":0,"recovered":0,"deferred":0,"catchUpMinutes":10,"failures":[]}`. Any other body shape (HTML, `NOT_FOUND`, `401`) means the request did not reach the route handler.

## 5. Build configuration note

The repository also contains the V1 app with its own lockfile, so Next.js may infer the workspace root as the repository root. That mis-inference writes the build output to the wrong directory and Vercel deploys an empty bundle where every route answers 404. `v2/next.config.js` therefore pins `turbopack.root` to the `v2/` directory.

## Notes

- Vercel Hobby's once-daily cron is only a fallback. Supabase Cron provides the minute-level schedule needed by user-defined automations.
- The endpoint's database uniqueness constraint prevents the daily Vercel fallback and Supabase dispatcher from executing the same automation for the same scheduled minute twice. Stale `running` locks older than three minutes can be reclaimed after an interrupted invocation. Catch-up is intentionally bounded to the latest 10 minutes; longer outages require manual review rather than an unbounded replay.
- Supabase Cron and `pg_net` run inside the Supabase database. Their job history is visible in the Supabase Cron dashboard.
- The migration is committed to the repository but is **not applied automatically**. Apply it in the Supabase SQL Editor; do not assume the scheduler is active until the verification query shows the job and recent successful runs.