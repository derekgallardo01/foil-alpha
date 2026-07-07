---
description: Ship a change on a branch with the standard verify→PR flow used across the repo
argument-hint: "<feature/fix, e.g. 'add saved searches'>"
---

Ship this on its own branch with the project's standard flow: **$ARGUMENTS**

1. **Branch** off an up-to-date `main` (never commit to `main` directly). Use a
   plain descriptive name (no `claude/` prefix). Follow existing patterns — reuse
   the shared `components/ui/` kit, `lib/` helpers (`format`, `useDashboardResource`,
   etc.), and the `{ success, data }` envelope for new dashboard-style endpoints.
2. **Build it**, matching the surrounding code's style and modularity.
3. **Verify** before every push: `tsc --noEmit`, `npm test`, `npm run build` — all
   green. For DB features, live-check the queries; for money features, run
   `/money-verify`; for schema changes, use `/new-migration`.
4. **Commit** with the user's git identity only (no AI attribution/co-author/footer,
   per repo convention). Then push and open a PR with `gh`, including: what/why, a
   verification line, and any **deploy note** (migrations to run, env vars to set).
5. Report the PR URL and what was verified. Don't merge unless asked.
