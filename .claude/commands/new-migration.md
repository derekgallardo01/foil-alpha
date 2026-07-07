---
description: Make a schema change the tracked way (Prisma migration, never hand-run SQL)
argument-hint: "<schema change, e.g. 'add stripe_transfer_id to withdrawals'>"
---

Make this schema change: **$ARGUMENTS**

Follow the tracked-migration flow (see docs/MIGRATIONS.md). Do NOT hand-write a
`manual_*.sql` or `prisma db execute` — that habit is retired.

1. Edit `prisma/schema.prisma`. For money tables, prefer additive/nullable columns;
   note any escrow-invariant implications in ARCHITECTURE.md.
2. Create + apply the migration and regenerate the client:
   ```
   npm run db:migrate -- --name <short_snake_case_description>
   ```
   (If you only have the shared remote DB and not a throwaway dev DB, generate the
   migration SQL with `prisma migrate diff` and apply via `prisma migrate deploy`
   against it — but a real dev DB is preferred.)
3. Confirm it's tracked: `npm run db:migrate:status` → up to date; the new folder
   exists under `prisma/migrations/` and is committed **with** the schema change.
4. Update `.env.example` if a var was added, and the deploy note in the PR body
   (`npm run db:migrate:deploy` will apply it in prod).
5. If the change touches wallets/settlement, run `/money-verify`.
6. `tsc --noEmit`, `npm test`, `npm run build` green before pushing.
