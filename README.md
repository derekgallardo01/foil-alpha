# Foil Alpha — trading-card marketplace & auction platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)

A trading-card (Pokémon) marketplace with fixed-price sales, live auctions with
proxy bidding, a wallet with real-money deposits, and seller reputation. Built as
a single Next.js app backed by MySQL.

## Stack
- **Next.js 14** (App Router) · **React 18** · **TypeScript**
- **MUI v6** (component kit) + a shared in-house `components/ui/` kit
- **Prisma 6** over **MySQL** (a legacy raw-`mysql2` pool still backs a few older routes)
- **NextAuth v4** (credentials + optional OAuth providers)
- **Stripe** (deposits via Checkout + webhooks; Connect payouts behind a flag)
- Real-time via **Server-Sent Events** + an in-process event bus
- **Vitest** for the pure-logic test suite
- Deployed as a **single service** on Railway

## What's built
- **Collection** — import, browse (search + grid/list), and value tracking with cost-basis P/L and top gainers/losers.
- **Marketplace** — fixed-price and auction listings with filters; per-card detail pages (`/card/[id]`) with price history and sale-history provenance.
- **Auctions** — live bidding with **eBay-style proxy/auto-bid** (set a max, the system bids only as much as needed), escrow holds, reserve prices, and a buyer-side **My Bids** view with live winning/outbid status.
- **Wallet** — Stripe deposits, escrow (`frozen_balance`) for active bids, withdrawals, and Stripe **Connect payouts** to sellers (feature-flagged). See [ARCHITECTURE.md](ARCHITECTURE.md) for the money model.
- **Reputation** — buyers rate sellers after completed purchases; ratings surface on listings and seller profiles (`/seller/[id]`).
- **Notifications** — bids/outbids/wins/sales with a real-time bell and a full history page; ⌘K command palette with card search.
- **Admin** — user/listing/auction/commission management and manual auction control.

> Real-time and the auction-settlement cron currently assume a **single running
> instance** — see [ARCHITECTURE.md](ARCHITECTURE.md#scaling) before adding replicas.

## Getting started
```bash
npm install
cp .env.example .env          # then fill in — see .env.example for what each var does
npx prisma generate
npm run dev                   # http://localhost:3000
```
You need a MySQL database; point both `DATABASE_URL` and the `MYSQL_*` vars at it.
For a fresh database, apply the schema — see **[docs/MIGRATIONS.md](docs/MIGRATIONS.md)**.

## Common scripts
| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest suite (pure `lib/` logic) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run db:migrate:deploy` | Apply pending Prisma migrations (see docs/MIGRATIONS.md) |

## Project layout
```
src/app/
  api/            REST route handlers (Prisma; a few legacy mysql2 routes)
  components/     feature components + the shared ui/ kit
  lib/            domain logic (wallet-settlement, bid-resolution, reviews, events, format, …) + tests
  <route>/        App Router pages (marketplace, collection, wallet, card/[id], seller/[id], admin/…)
  instrumentation.ts   in-app cron that drives auction settlement
prisma/schema.prisma   data model (source of truth)
docs/                  ARCHITECTURE.md, MIGRATIONS.md
```

## Documentation
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — the money/escrow model, the single-instance real-time + cron design, and the dual data layer.
- **[docs/MIGRATIONS.md](docs/MIGRATIONS.md)** — how schema changes are made and applied.
- **[.env.example](.env.example)** — every environment variable, grouped and annotated.

## License
MIT.
