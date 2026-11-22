# PromptForge V2 Security and Dependency Review

Review date: 2026-11-22

## Verified upgrade branch

The isolated branch `promptforge-v2-next16-upgrade` has been tested without changing the stable `promptforge-v2-development` branch.

| Package | Verified version |
|---|---:|
| Next.js | 16.4.6 |
| React / React DOM | 18.3.1 |
| Zod | 4.6.7 |
| Vitest | 5.1.1 |
| Vite | 6.4.6 |
| Node type definitions | 22.x |

Next.js 16.4.6 accepts React 18.2+ or React 19, so the existing React 18.3.1 runtime was retained to avoid an unnecessary React-major migration.

## CI verification

Latest successful run: [GitHub Actions #45016775455](https://github.com/syntaxxsl/promptforge-nextjs/actions/runs/45016775455)

- Dependency installation: passed
- Vitest suite: passed
- TypeScript: passed
- Production build: passed
- Generated dependency lockfile: committed to this isolated branch

The upgrade also migrates the deprecated `middleware.ts` convention to `proxy.ts`, updates the Supabase server client to await Next.js request cookies, and explicitly uses Webpack because the project retains a custom Webpack memory configuration.

## Dependency audit

The final `npm audit` report for the upgrade branch reports:

| Scope | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| All dependencies | 0 | 0 | 0 | 0 | 0 |
| Production only | 0 | 0 | 0 | 0 | 0 |

The audit JSON was retained as a short-lived GitHub Actions artifact for traceability.

## Remaining release checklist

1. Review the isolated upgrade branch and its complete diff.
2. Run authenticated smoke tests with a real Supabase test project, including login, session refresh, API routes, storage, and sign-out.
3. Only after review, merge the upgrade branch into `promptforge-v2-development`.
4. Configure production environment variables and apply the documented Supabase migrations only after explicit approval.
5. Deploy only after separate authorization.

## Safety boundaries

- This branch is not merged into `promptforge-v2-development`.
- V1 source and the live V1 deployment remain untouched.
- No production deployment has been performed.
- No Supabase migrations have been applied.
- No real provider API keys or secrets are included in the repository.
