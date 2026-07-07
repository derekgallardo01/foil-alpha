import { prisma } from "./prisma";

export interface SellerRating {
  average: number;
  count: number;
}

/**
 * Batch-load seller rating aggregates (avg + count) for a set of seller ids.
 * Returns a Map keyed by seller id; sellers with no reviews are absent.
 */
export async function getSellerRatings(sellerIds: number[]): Promise<Map<number, SellerRating>> {
  const ids = [...new Set(sellerIds)];
  if (ids.length === 0) return new Map();
  const grouped = await prisma.review.groupBy({
    by: ["seller_id"],
    where: { seller_id: { in: ids } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    grouped.map((g) => [
      g.seller_id,
      { average: Math.round((g._avg.rating ?? 0) * 10) / 10, count: g._count._all },
    ])
  );
}
