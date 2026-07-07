# Legacy manual SQL (historical — do not run)

Before the migration history was baselined, schema changes were applied by hand
with these one-off `manual_*.sql` files. They are kept here **for reference only**.

Every change in these files is already captured in the baseline migration
`prisma/migrations/0_init/migration.sql`, and they have already been applied to
the live database. **Do not run them.**

Schema changes now go through tracked Prisma migrations — see
[../../docs/MIGRATIONS.md](../../docs/MIGRATIONS.md).
