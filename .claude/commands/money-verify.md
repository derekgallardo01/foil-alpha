---
description: Scaffold + run a live-DB seed→assert→teardown harness to verify a wallet/settlement change
argument-hint: "<what changed, e.g. 'proxy bid escrow' or 'withdrawal payout'>"
---

You are verifying a change to money code (anything touching `balance`,
`frozen_balance`, `WalletTransaction`, `admin_wallet`, settlement, or payouts).
Per the money-code discipline (see ARCHITECTURE.md), such changes MUST be
verified against the live DB with a net-zero harness before pushing — pure unit
tests are not enough because the risk lives in the transactional/concurrent path.

Change under test: **$ARGUMENTS**

Write and run a throwaway `tsx` harness (in the scratchpad, delete after) that:

1. **Snapshots** the real rows it will touch so it can restore them exactly
   (e.g. each involved `userWallet`'s `balance` + `frozen_balance`; any auction
   rows created). Use existing users/cards; create temp `userCard`/`bid`/
   `transaction` rows you will delete.
2. **Exercises the real logic** — ideally by importing the same pure helpers
   (`lib/bid-resolution`, `lib/wallet-settlement`) and replicating the endpoint's
   transaction, or by calling the code path directly. For concurrency, fire the
   contended operations with `Promise.allSettled`.
3. **Asserts the invariants**, printing PASS/FAIL for each:
   - **`frozen == amount`**: every active bid's frozen escrow equals its `amount`.
   - **No oversubscribe**: `balance - frozen_balance >= 0` for every wallet.
   - **Net-zero platform**: `admin_wallet` gains exactly the expected commission.
   - Plus whatever is specific to this change (e.g. loser holds released to 0;
     winner charged exactly once; idempotency: a duplicate call is a no-op / P2002).
4. **Tears down** — delete all temp rows and restore snapshotted wallets to their
   original values. Re-read and confirm net-zero.

Run it with the DB URL:
```
DATABASE_URL="<the Railway MySQL proxy url>" npx tsx scratch_<name>.ts ; rm -f scratch_<name>.ts
```

Also run `tsc --noEmit`, `npm test`, and `npm run build`. Report each PASS/FAIL
plainly. If any invariant fails, do NOT push — fix the root cause first. For
high-risk changes, additionally spawn an adversarial reviewer subagent to try to
construct a failing sequence before you trust the result.
