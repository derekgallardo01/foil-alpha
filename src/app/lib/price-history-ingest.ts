/**
 * Shared ingestion of the V2 API's per-card price *time series* into the
 * `price_history` table.
 *
 * The daily sync historically persisted only the single latest market price,
 * throwing away the `priceHistory.conditions[*].history[]` array the API returns.
 * This module flattens that array (date, market, volume) and inserts every point
 * idempotently, so both the one-time backfill and the ongoing daily sync build
 * the deep, feature-rich series the Phase 2 forecasting model needs.
 */

import { prisma } from "./prisma";

/** Rows written from the V2 history array carry this data_source tag. */
export const V2_HISTORY_SOURCE = "v2_price_history";

export interface V2PriceHistory {
  conditions?: Record<
    string,
    { history?: Array<{ date?: string; market?: number; volume?: number }> } | null
  >;
  totalDataPoints?: number;
  earliestDate?: string;
  latestDate?: string;
}

export interface IngestResult {
  totalDataPoints: number | null;
  earliestDate: string | null;
  latestDate: string | null;
  pointsFound: number;
  inserted: number;
  skippedExisting: number;
}

const dayKey = (d: Date, condition: string) => `${d.toISOString().slice(0, 10)}|${condition}`;

/**
 * Insert every point of a card's V2 price history, skipping any (day, condition)
 * this ingest already wrote. Safe to call repeatedly and from multiple callers.
 */
export async function ingestCardPriceHistory(
  cardId: number,
  priceHistory: V2PriceHistory | null | undefined,
  opts: { dryRun?: boolean } = {}
): Promise<IngestResult> {
  const result: IngestResult = {
    totalDataPoints: priceHistory?.totalDataPoints ?? null,
    earliestDate: priceHistory?.earliestDate ?? null,
    latestDate: priceHistory?.latestDate ?? null,
    pointsFound: 0,
    inserted: 0,
    skippedExisting: 0,
  };

  const conditions = priceHistory?.conditions ?? {};
  const flat: Array<{ date: Date; market: number; volume: number | null; condition: string }> = [];
  for (const [condName, cond] of Object.entries(conditions)) {
    for (const pt of cond?.history ?? []) {
      const market = Number(pt?.market);
      const date = new Date(pt?.date ?? "");
      if (!Number.isFinite(market) || market <= 0 || Number.isNaN(date.getTime())) continue;
      const vol = Number(pt?.volume);
      flat.push({
        date,
        market: Math.round(market * 100) / 100,
        volume: Number.isFinite(vol) ? Math.round(vol) : null,
        condition: condName,
      });
    }
  }

  // De-dupe within the payload by day+condition.
  const seen = new Set<string>();
  const deduped = flat.filter((p) => {
    const k = dayKey(p.date, p.condition);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  result.pointsFound = deduped.length;
  if (deduped.length === 0) return result;

  // Skip points already persisted for this card by this ingest.
  const existing = await prisma.price_history.findMany({
    where: { card_id: cardId, data_source: V2_HISTORY_SOURCE },
    select: { recorded_at: true, condition: true },
  });
  const existingKeys = new Set(existing.map((e) => dayKey(e.recorded_at, e.condition ?? "")));
  const toInsert = deduped.filter((p) => !existingKeys.has(dayKey(p.date, p.condition)));
  result.skippedExisting = deduped.length - toInsert.length;

  if (!opts.dryRun && toInsert.length > 0) {
    await prisma.price_history.createMany({
      data: toInsert.map((p) => ({
        card_id: cardId,
        price: p.market,
        volume: p.volume,
        recorded_at: p.date,
        condition: p.condition,
        source: "pokemon_price_tracker",
        price_type: "market",
        data_source: V2_HISTORY_SOURCE,
        metadata: { ingested_from: "v2_price_history" },
      })),
    });
    result.inserted = toInsert.length;
  }

  return result;
}
