import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth";

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
      const ph = apiCard?.priceHistory;

      rec.totalDataPoints = ph?.totalDataPoints ?? null;
      rec.earliestDate = ph?.earliestDate ?? null;
      rec.latestDate = ph?.latestDate ?? null;

      // Flatten every condition's history into (date, market, volume, condition).
      const conditions: Record<string, any> = ph?.conditions ?? {};
      const flat: Array<{ date: Date; market: number; volume: number | null; condition: string }> = [];
      for (const [condName, cond] of Object.entries(conditions)) {
        for (const pt of (cond as any)?.history ?? []) {
          const market = Number(pt?.market);
          const date = new Date(pt?.date);
          if (!Number.isFinite(market) || market <= 0 || Number.isNaN(date.getTime())) continue;
          const vol = pt?.volume;
          flat.push({
            date,
            market: Math.round(market * 100) / 100,
            volume: Number.isFinite(Number(vol)) ? Math.round(Number(vol)) : null,
            condition: condName,
          });
        }
      }

      // De-dupe within the payload by day+condition (keep the first seen).
      const dayKey = (d: Date, c: string) => `${d.toISOString().slice(0, 10)}|${c}`;
      const seenInPayload = new Set<string>();
      const deduped = flat.filter((p) => {
        const k = dayKey(p.date, p.condition);
        if (seenInPayload.has(k)) return false;
        seenInPayload.add(k);
        return true;
      });
      rec.pointsFound = deduped.length;
      if (deduped.length > 0) summary.cardsWithHistory++;

      // Skip points we already have (idempotent re-runs) — match on day+condition
      // among rows this backfill wrote for the card.
      const existing = await prisma.price_history.findMany({
        where: { card_id: card.id, data_source: "backfill_v2_history" },
        select: { recorded_at: true, condition: true },
      });
      const existingKeys = new Set(
        existing.map((e) => dayKey(e.recorded_at, e.condition ?? ""))
      );
      const toInsert = deduped.filter((p) => !existingKeys.has(dayKey(p.date, p.condition)));
      rec.skippedExisting = deduped.length - toInsert.length;
      summary.pointsSkippedExisting += rec.skippedExisting;

      if (!dryRun && toInsert.length > 0) {
        await prisma.price_history.createMany({
          data: toInsert.map((p) => ({
            card_id: card.id,
            price: p.market,
            volume: p.volume,
            recorded_at: p.date,
            condition: p.condition,
            source: "pokemon_price_tracker",
            price_type: "market",
            data_source: "backfill_v2_history",
            metadata: { backfilled: true },
          })),
        });
        rec.inserted = toInsert.length;
      }
      summary.pointsInserted += rec.inserted;
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
