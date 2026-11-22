# PromptForge V2 Security and Dependency Review

Review date: 2026-11-22

## Stable development branch baseline

The stable `promptforge-v2-development` branch remains on this dependency baseline:

| Package | Resolved version |
|---|---:|
| Next.js | 14.2.35 |
| React / React DOM | 18.3.1 |
| Zod | 3.25.76 |
| Vitest | 1.6.1 |

The baseline audit recorded 8 advisories (3 critical, 3 high, 2 moderate). Production dependencies alone recorded 3 advisories (1 critical, 2 high). This branch has not received the isolated major-version upgrade.

## Isolated upgrade evaluation

A separate branch, `promptforge-v2-next16-upgrade`, has been prepared and validated:

| Package | Verified version |
|---|---:|
| Next.js | 16.4.6 |
| React / React DOM | 18.3.1 |
| Zod | 4.6.7 |
| Vitest | 5.1.1 |
| Vite | 6.4.6 |
| Node type definitions | 22.x |

Next.js 16.4.6 accepts React 18.2+ or React 19. The project therefore keeps React 18.3.1 and avoids an unnecessary React-major migration.

The isolated branch also:
- Migrates the deprecated `middleware.ts` convention to `proxy.ts`.
- Awaits the asynchronous Next.js request-cookie API in the Supabase server client and all call sites.
- Keeps the project's custom Webpack build path explicit with `--webpack`.
- Updates the generated TypeScript configuration for Next.js 16.

## Verified results

Latest successful isolated CI run: [GitHub Actions #45016775455](https://github.com/syntaxxsl/promptforge-nextjs/actions/runs/45016775455)

- Dependency installation: passed
- Vitest suite: passed
- TypeScript: passed
- Production build: passed
- Final `npm audit`: 0 advisories across all dependencies
- Production-only `npm audit`: 0 advisories

## Release checklist

1. Review the complete diff from `promptforge-v2-development` to `promptforge-v2-next16-upgrade`.
2. Run authenticated smoke tests with a real Supabase test project: login, session refresh, API routes, storage, and sign-out.
3. Merge only after review and approval.
4. Configure production environment variables and apply the documented Supabase migrations only after explicit approval.
5. Deploy only after separate authorization.

## Safety boundaries

- The isolated upgrade branch is **not merged** into the stable V2 development branch.
- V1 source and the live V1 deployment remain untouched.
- No production deployment has been performed.
- No Supabase migrations have been applied.
- No real provider API keys or secrets are included in the repository.

## References

- https://nextjs.org/support-policy
- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://vitest.dev/guide/migration/
