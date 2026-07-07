import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth";
import { ingestCardPriceHistory } from "../../../lib/price-history-ingest";

// Long-running batch job; never statically generate, allow a generous budget.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/cards/backfill-price-history
 *
 * One-time (idempotent) backfill of real price history for Phase 2 forecasting.
 *
 * The daily sync only ever persists the single *latest* market price, discarding
 * the full time series the V2 API returns per card. This route reads each card's
 * `priceHistory.conditions[*].history[]` (date, market, volume) straight from the
 * upstream API and inserts every point into `price_history`, skipping any it
 * already has — so it's safe to re-run and to run in chunks.
 *
 * Body (all optional):
 *   cardIds:  number[]  — restrict to these card ids (else all sync-enabled cards)
 *   limit:    number    — cap how many cards to process this call (for chunking)
 *   dryRun:   boolean   — fetch + report depth, write nothing (use limit:1 to probe)
 *   delayMs:  number    — pause between card fetches (default 150) to respect limits
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const apiKey = process.env.POKEMON_PRICE_TRACKER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "POKEMON_PRICE_TRACKER_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: {
    cardIds?: number[];
    limit?: number;
    dryRun?: boolean;
    delayMs?: number;
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — treat as "all cards, live run"
  }
  const { cardIds, limit, dryRun = false, delayMs = 150 } = body;

  const cards = await prisma.card.findMany({
    where: {
      price_tracker_id: { not: "" },
      ...(cardIds && Array.isArray(cardIds) ? { id: { in: cardIds } } : {}),
    },
    select: { id: true, name: true, price_tracker_id: true },
    orderBy: { id: "asc" },
    ...(limit && limit > 0 ? { take: limit } : {}),
  });

  const summary = {
    dryRun,
    cardsConsidered: cards.length,
    cardsWithHistory: 0,
    cardsFailed: 0,
    pointsInserted: 0,
    pointsSkippedExisting: 0,
    perCard: [] as Array<{
      cardId: number;
      name: string;
      trackerId: string | null;
      totalDataPoints: number | null;
      earliestDate: string | null;
      latestDate: string | null;
      pointsFound: number;
      inserted: number;
      skippedExisting: number;
      error?: string;
    }>,
  };

  const baseUrl = "https://www.pokemonpricetracker.com/api/v2";

  for (const card of cards) {
    const rec = {
      cardId: card.id,
      name: card.name,
      trackerId: card.price_tracker_id,
      totalDataPoints: null as number | null,
      earliestDate: null as string | null,
      latestDate: null as string | null,
      pointsFound: 0,
      inserted: 0,
      skippedExisting: 0,
      error: undefined as string | undefined,
    };

    try {
      const url = `${baseUrl}/cards?tcgPlayerId=${encodeURIComponent(card.price_tracker_id)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);

      const payload = await res.json();
      const apiCard = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;

      const ingest = await ingestCardPriceHistory(card.id, apiCard?.priceHistory, { dryRun });
      rec.totalDataPoints = ingest.totalDataPoints;
      rec.earliestDate = ingest.earliestDate;
      rec.latestDate = ingest.latestDate;
      rec.pointsFound = ingest.pointsFound;
      rec.inserted = ingest.inserted;
      rec.skippedExisting = ingest.skippedExisting;

      if (ingest.pointsFound > 0) summary.cardsWithHistory++;
      summary.pointsSkippedExisting += ingest.skippedExisting;
      summary.pointsInserted += ingest.inserted;
    } catch (err) {
      rec.error = err instanceof Error ? err.message : "Unknown error";
      summary.cardsFailed++;
    }

    summary.perCard.push(rec);
    if (delayMs > 0 && cards.length > 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return NextResponse.json(summary);
}
