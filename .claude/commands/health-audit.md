---
description: Re-measure codebase-health metrics so debt is tracked, not guessed
---

Produce a short codebase-health report by MEASURING (don't estimate). Run these
and report each number with a one-line trend note vs. the last audit if known.

**Data-layer split** (goal: migrate raw mysql2 → Prisma over time):
```
grep -rl "getDbConnection\|executeQuery" src/app/api | wc -l    # raw mysql2 routes (goal: 0)
grep -rl "from '.*lib/prisma'" src/app/api | wc -l              # prisma routes
```
List the remaining raw-mysql2 route files (auth routes are the priority to migrate).

**Monolith files** (goal: decompose the 800+ line client files):
```
find src/app -name '*.tsx' -o -name '*.ts' | xargs wc -l | sort -rn | head -12
```

**Type safety**: `grep -rcE ': any|as any|<any>|any\[\]' src/app | grep -v ':0' | ...`
(total `any` count + top files); and `grep -rc '@ts-ignore\|@ts-expect-error' src` (goal: 0).

**Logging**: `grep -rc 'console\.' src/app | ...` (total; goal: introduce a logger).

**API envelope consistency**: count routes returning `{ success, ... }` vs bare
`{ error }` — the split should shrink toward one convention once an `ok()`/`fail()`
helper exists.

**Tests**: `ls src/app/lib/**/*.test.ts` and note coverage is pure-lib only
(no API/integration/component tests yet — flag the gap on money paths).

**Migrations**: `npm run db:migrate:status` — confirm the DB is up to date and no
`manual_*.sql` has crept back into `prisma/migrations/`.

End with a 3-line verdict: what improved, what regressed, and the single highest-
leverage next fix. Reference ARCHITECTURE.md for the known-debt baseline.
