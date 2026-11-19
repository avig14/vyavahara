# Database: Neon free plan, and how the app stays inside it

Neon Free gives each project **5 GB of public network transfer per month** and 1 GB of storage ([limits](https://neon.com/faqs/free-plan-limits-and-quotas)).
When transfer runs out Neon suspends the database and every query fails with HTTP 402 "exceeded the quota". It resets at the start of the billing period.
Every query result counts as transfer ([docs](https://neon.com/docs/introduction/network-transfer)).

## What went wrong once (20 Nov 2026)

`loadSnapshot` reads the whole shop (about 3.7 MB) and ran on every dashboard call, WhatsApp message and agent run. About 1,400 loads used the full 5 GB.

## What the app does now

| Piece | Where | Effect |
|---|---|---|
| Version-checked snapshot cache | `src/lib/db/snapshot-cache.ts`, `loadSnapshot` in `queries.ts` | Unchanged data costs one ~0.2 KB probe, not ~3 MB |
| `merchants.data_version` | `schema.ts` | Bumped once per request that wrote anything, so every Vercel instance sees changes |
| Write watcher | `src/lib/db/client.ts` (`watchWrites`) | Sees every statement drizzle sends, so no write path can forget to invalidate |
| Flush after writes | `handle()` in `server/http.ts`, both WhatsApp webhooks, `alerts-hook.ts` | One tiny update per request, never per statement |
| Trimmed columns | `txnCols`, `saleItemCols` in `queries.ts` | Cold load 3.7 MB to 3.0 MB |
| Friendly limit error | `isQuotaError`, `handle()` | 402 becomes a clear 503 message |
| Usage check | `npm run db:usage` | Shows transfer used, exits 1 at 80% |

Measured on the live Neon wire: cold load 3.0 MB, every unchanged load 0.2 KB, reload after a write 3.0 MB.

## Safety rules the cache follows

A cached snapshot is served only if the database version is unchanged, this instance has not written since, and it is under 10 minutes old. The version is read before the data, so a race can only cause one extra reload, never stale data. If the probe fails the app just loads normally.

## When you change code

- A new write path outside `handle()` or `after()` must call `flushWrites()` when it finishes.
- A new table that `loadSnapshot` reads must **not** be in `NOT_IN_SNAPSHOT` (`snapshot-cache.ts`).
- Do not mutate arrays from `loadSnapshot`: the same arrays are shared between callers.
- Loops, load tests and demos that hit the live API still cost transfer. Use mocks.

## If the database is blocked again

1. `npm run db:usage` to confirm.
2. Fastest fix: new Neon project (own 5 GB), `npm run db:push`, `npm run seed`, replace `DATABASE_URL` in `.env.local` and in Vercel (`vercel env add DATABASE_URL production --force`), redeploy.
3. Lasting fix: Neon Launch plan (500 GB transfer per project).
