# Database migrations

Schema changes go through **tracked Prisma migrations**. The migration history in
`prisma/migrations/` is the source of truth; `prisma/schema.prisma` describes the
current shape. Never hand-apply SQL to the database.

> History: this project used to apply schema changes with hand-run `manual_*.sql`
> files (now archived in `prisma/legacy-manual-sql/`, for reference only). The
> history was **baselined** from the live database into `0_init` — see below.

## Making a schema change (local dev)
1. Edit `prisma/schema.prisma`.
2. Create + apply the migration and regenerate the client:
   ```bash
   npm run db:migrate -- --name short_description   # prisma migrate dev
   ```
   This writes a new folder under `prisma/migrations/`, applies it to your dev DB,
   and updates the Prisma client.
3. Commit the new `prisma/migrations/<timestamp>_short_description/` folder **with**
   the schema change.
4. If the change adds/renames an env var, update `.env.example`. If it touches the
   money tables, update `ARCHITECTURE.md` and follow the money-verify ritual
   (`.claude/commands/money-verify.md`).

## Deploying to production
```bash
npm run db:migrate:deploy    # prisma migrate deploy — applies pending migrations only
```
`migrate deploy` never generates or resets; it just applies committed migrations in
order. Run it as part of the deploy (before the app boots against the new schema).

## Checking status
```bash
npm run db:migrate:status    # prisma migrate status
```

## One-time baseline (already done — for the record)
The existing database predates the migration history, so it was baselined rather
than rebuilt:
```bash
# 1. Baseline migration generated from the current schema (no DB writes):
mkdir -p prisma/migrations/0_init
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 2. Confirmed the live DB already matches the schema (empty diff):
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --script     # → "This is an empty migration."

# 3. Marked the baseline as already-applied on each existing database WITHOUT
#    re-running it (this only writes the _prisma_migrations bookkeeping row —
#    it does NOT execute the DDL, so no table is recreated and no data is touched):
npx prisma migrate resolve --applied 0_init
```
After step 3, `prisma migrate status` reports the database is up to date, and all
future changes flow through `migrate dev` / `migrate deploy`.

> ⚠️ Step 3 writes to the target database's `_prisma_migrations` table. Run it
> against a non-prod database first if one exists, verify `migrate status`, then
> run it against production.
