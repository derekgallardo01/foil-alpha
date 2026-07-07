import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

function getIdFromRequest(request: NextRequest): number {
  const parts = new URL(request.url).pathname.split("/");
  return parseInt(parts[parts.length - 1] || "", 10);
}

/**
 * GET /api/sellers/[id] — a public seller profile: name, rating aggregate,
 * recent reviews, and their active listings (fixed + auction). Batched (no N+1).
 */
export async function GET(request: NextRequest) {
  const id = getIdFromRequest(request);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid seller id" }, { status: 400 });

  try {
    const seller = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

    const [agg, reviews, listings] = await Promise.all([
      prisma.review.aggregate({ where: { seller_id: id }, _avg: { rating: true }, _count: { _all: true } }),
      prisma.review.findMany({ where: { seller_id: id }, orderBy: { created_at: "desc" }, take: 20 }),
      prisma.userCard.findMany({
        where: { owner_id: id, is_for_sale: true, is_sold: false },
        orderBy: { created_at: "desc" },
        take: 50,
      }),
    ]);

    // Batch the reviewers + cards + current bids the two lists reference.
    const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
    const cardIds = [...new Set(listings.map((l) => l.card_id))];
    const listingIds = listings.map((l) => l.id);
    const [reviewers, cards, activeBids] = await Promise.all([
      reviewerIds.length
        ? prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true } })
        : [],
      cardIds.length
        ? prisma.card.findMany({
            where: { id: { in: cardIds } },
            select: { id: true, name: true, set_name: true, rarity: true, image_url: true },
          })
        : [],
      listingIds.length
        ? prisma.bid.findMany({
            where: { userCardId: { in: listingIds }, is_active: true },
            select: { userCardId: true, amount: true },
          })
        : [],
    ]);
    const reviewerName = new Map(reviewers.map((u) => [u.id, u.name]));
    const cardById = new Map(cards.map((c) => [c.id, c]));
    const highest = new Map<number, number>();
    for (const b of activeBids) {
      highest.set(b.userCardId, Math.max(highest.get(b.userCardId) ?? 0, Number(b.amount)));
    }

    return NextResponse.json({
      success: true,
      seller: { id: seller.id, name: seller.name },
      rating: { average: Math.round((agg._avg.rating ?? 0) * 10) / 10, count: agg._count._all },
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        reviewer: reviewerName.get(r.reviewer_id) ?? "Anonymous",
        created_at: r.created_at,
      })),
      listings: listings.map((l) => {
        const card = cardById.get(l.card_id) ?? null;
        return {
          user_card_id: l.id,
          card: card ? { id: card.id, name: card.name, set_name: card.set_name, image_url: card.image_url } : null,
          sale_type: l.sale_type,
          condition: l.condition,
          fixed_price: l.fixed_price != null ? Number(l.fixed_price) : null,
          reserve_price: l.reserve_price != null ? Number(l.reserve_price) : null,
          auction_end: l.auction_end,
          current_bid: highest.get(l.id) ?? null,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching seller:", error);
    return NextResponse.json({ success: false, error: "Failed to load seller" }, { status: 500 });
  }
}
