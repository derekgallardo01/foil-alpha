# Architecture

The durable design decisions behind Foil Alpha — especially the money layer and
the single-instance assumptions — that aren't obvious from the code alone.

## Shape
A single Next.js 14 (App Router) application. API route handlers live under
`src/app/api`, pages under `src/app/<route>`, domain logic under `src/app/lib`.
Data is MySQL via Prisma. There is no separate backend service (the ML price
forecaster is an optional external FastAPI service behind a URL). The app is
deployed as **one** Railway service, and several subsystems assume exactly that
(see [Scaling](#scaling)).

## Data layers (there are two)
- **Prisma** (`src/app/lib/prisma.ts`) is the primary and preferred layer — ~60 of
  the API routes use it.
- **Raw `mysql2` pool** (`src/app/lib/db.ts`, `getDbConnection`/`executeQuery`) is
  a legacy layer still used by ~8 older routes, including parts of the auth surface
  (`[...nextauth]`, `forgot-password`, `reset-password`) and `users`/`products`.

  ⚠️ The raw pool is a **singleton** (`connectionLimit: 5`). Do **not** call
  `connection.end()` in a route — it destroys the shared pool for the whole
  process. This mistake has caused outages twice (fixed in the watchlist and
  verify-email routes). New routes should use Prisma; the legacy routes are being
  migrated off `mysql2` over time.

## The money model
The wallet/marketplace money layer is the most safety-critical part of the app.

### Ledger
- `UserWallet` holds `balance` and `frozen_balance`. **Available = `balance − frozen_balance`.**
- `WalletTransaction` is an **append-only** ledger of every balance movement, with
  `balance_before`/`balance_after`. Externally-triggered credits (Stripe deposits,
  refunds, disputes) carry a unique `idempotency_key` so a duplicate webhook can't
  double-credit.
- `admin_wallet` + `admin_wallet_transactions` hold platform commission. Commission
  is **seller-funded** (the buyer pays their bid; the platform fee comes out of the
  seller's proceeds) via `lib/commission-utils`.

### Escrow (the core invariant)
When a bid is placed, the bidder's stake is moved from available to
`frozen_balance` (held in escrow) until the auction resolves. The system keeps
**one active bid per bidder per auction**, and:

> **INVARIANT: a bidder's frozen escrow for an auction == their active bid's `amount`.**

Everything downstream depends on this. `amount` is the bid's *current effective*
price; the proxy `max_amount` is only a ceiling and is **never** what's frozen.
Settlement reads `amount`, so as long as `frozen == amount` holds, the whole
settlement chain stays correct. `lib/wallet-settlement.releaseBidHolds(tx, …)` is
the shared helper that releases losing bidders' holds by decrementing
`frozen_balance` by each active bid's `amount`.

### Settlement state machine
Auction end (natural via cron, or manual via admin) creates a
`Transaction` in `PENDING_BUYER_CONFIRMATION`; the winner confirms
(`bids/confirm-purchase`) → `COMPLETED`, or declines/expires → the auction
continues or cancels. On completion the winner is charged their `amount`
(frozen → balance deduction), losers' holds are released, and commission is
recorded.

### Concurrency patterns (money code — follow these)
1. **Atomic conditional writes, never read-then-write.** Freeze funds with a
   locking conditional update and assert exactly one row changed:
   ```sql
   UPDATE user_wallets SET frozen_balance = frozen_balance + ?
   WHERE user_id = ? AND (balance - frozen_balance) >= ?
   ```
   (MySQL REPEATABLE READ uses non-locking snapshot reads, but `UPDATE … WHERE`
   is a locking current read — so this can't oversubscribe under concurrency.)
2. **Per-auction serialization.** Bid placement and auction settlement take a
   `SELECT id FROM user_cards WHERE id = ? FOR UPDATE` row lock so concurrent
   bids / a bid racing a settlement are serialized. State transitions also gate on
   an atomic claim (`updateMany({ where: { id, status: PENDING }, … })` asserting
   `count === 1`) so a card can't be sold or settled twice.
3. **Idempotency keys** for anything a third party can retry (Stripe events;
   payout transfers use `withdrawal-<id>` plus a DB `stripe_transfer_id` as the
   source of truth).

**Rule:** any change touching `balance`/`frozen_balance`/settlement must be
adversarially reviewed and verified with a live seed→assert→teardown harness
(snapshot wallets, run the transaction under concurrency, assert the invariant +
no oversubscribe, restore net-zero). See `.claude/commands/money-verify.md`.

### Proxy / auto-bid
`lib/bid-resolution.ts` (`resolveProxyBid`, pure + unit-tested) resolves an
eBay-style second-price war between the challenger and the standing top bid: the
higher `max_amount` wins at just over the runner-up, floored at the entered
amount and capped at the winner's max. The endpoint applies the resulting
effective amounts under the per-auction lock, freezing exactly the delta; if a
standing bidder can't afford to defend, it degrades all-or-nothing (they don't
escalate, the challenger wins cheaply) — never a partial/oversubscribed freeze.

## Real-time (SSE)  — single instance
`lib/events.ts` is a process-local `EventEmitter` on `globalThis`. Write paths call
`emitAppEvent({ type, … })`; `api/events/stream` subscribes each SSE client to that
emitter. Clients (My Bids, live-auction table, notification bell) refetch on
relevant events, with a slow (~60s) fallback poll for resilience.

**This only fans out within one process.** With more than one replica, a bid
handled by instance A never reaches SSE clients connected to instance B — they
fall back to the poll. Real-time correctness is lost at replica #2.

## Auction cron — single instance
`src/instrumentation.ts` runs an in-app `setInterval` (every ~2 min, gated by
`ENABLE_IN_APP_CRON` + `NEXT_RUNTIME === "nodejs"`) that calls
`/api/process-auctions` to settle ended auctions. `CRON_SECRET` gates access, not
concurrency. **Enable it on exactly one instance** — if every replica runs the
loop, settlement fires concurrently N times, and correctness then rests entirely
on the per-auction lock + atomic claims (safe, but not something to lean on
deliberately).

## Scaling
The app is intentionally pinned to one instance and runs fine **vertically**
(bigger box) into the low thousands of concurrent users. The ceiling is **hard,
not gradual**: the moment a second replica is added, SSE real-time fractures and
the cron duplicates. To scale horizontally you must:
1. Put a broker (e.g. Redis pub/sub) behind `emitAppEvent`/the SSE stream so events
   fan out across instances.
2. Move settlement to a single external scheduler / queue (or leader-elect the
   in-app cron) so it runs once.
3. Add composite indexes for the hot boolean-filtered queries
   (`bids(userCardId, is_active)`, `user_cards(is_for_sale, is_sold)`,
   `transactions(seller_id, status)`).

Until that traffic arrives, single-instance is a reasonable, documented trade-off.

## Migrations
Schema changes go through tracked Prisma migrations — see
[docs/MIGRATIONS.md](docs/MIGRATIONS.md). (Historically they were applied by
hand-run `manual_*.sql`; that has been replaced by a baselined migration history.)
