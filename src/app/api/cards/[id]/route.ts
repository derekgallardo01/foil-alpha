import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSellerRatings } from "../../../lib/reviews";
import { getAuthUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function getIdFromRequest(request: NextRequest): number {
  const parts = new URL(request.url).pathname.split("/");
  return parseInt(parts[parts.length - 1] || "", 10);
}

/**
 * GET /api/cards/[id] — public card detail: full metadata plus every active
 * listing for the card (fixed + auction), each with its seller and current
 * highest bid. Bumps the card's view_count (best-effort).
 */
export async function GET(request: NextRequest) {
  const id = getIdFromRequest(request);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid card id" }, { status: 400 });

  try {
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    // Best-effort popularity bump — never block the response on it.
    prisma.card.update({ where: { id }, data: { view_count: { increment: 1 } } }).catch(() => {});

    const listings = await prisma.userCard.findMany({
      where: { card_id: id, is_for_sale: true, is_sold: false },
      orderBy: { created_at: "desc" },
    });

    const listingIds = listings.map((l) => l.id);

    // Every copy of this card (across all owners) — for realized sale history.
    const copyIds = (await prisma.userCard.findMany({ where: { card_id: id }, select: { id: true } })).map((c) => c.id);

    const [activeBids, sales] = await Promise.all([
      listingIds.length
        ? prisma.bid.findMany({
            where: { userCardId: { in: listingIds }, is_active: true },
            select: { userCardId: true, amount: true },
          })
        : [],
      copyIds.length
        ? prisma.transaction.findMany({
            where: { user_card_id: { in: copyIds }, status: "COMPLETED" },
            orderBy: { updated_at: "desc" },
            take: 15,
          })
        : [],
    ]);

    // One user lookup covering listing sellers + both parties of each sale.
    const userIds = [
      ...new Set([...listings.map((l) => l.owner_id), ...sales.flatMap((s) => [s.buyer_id, s.seller_id])]),
    ];
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));
    const nameOf = (uid: number) => userById.get(uid)?.name ?? "Unknown";
    const sellerRatings = await getSellerRatings(listings.map((l) => l.owner_id));

    // Which of these listings the signed-in viewer (if any) is watching.
    const viewer = await getAuthUser();
    const watchedSet =
      viewer && listingIds.length
        ? new Set(
            (
              await prisma.watchedListing.findMany({
                where: { user_id: viewer.id, user_card_id: { in: listingIds } },
                select: { user_card_id: true },
              })
            ).map((w) => w.user_card_id)
          )
        : new Set<number>();

    const highest = new Map<number, number>();
    const counts = new Map<number, number>();
    for (const b of activeBids) {
      highest.set(b.userCardId, Math.max(highest.get(b.userCardId) ?? 0, Number(b.amount)));
      counts.set(b.userCardId, (counts.get(b.userCardId) ?? 0) + 1);
    }

    return NextResponse.json({
      success: true,
      card: {
        id: card.id,
        name: card.name,
        set_name: card.set_name,
        card_number: card.card_number,
        total_set_number: card.total_set_number,
        rarity: card.rarity,
        card_type: card.card_type,
        hp: card.hp,
        stage: card.stage,
        artist: card.artist,
        image_url: card.image_url,
        market_price: card.market_price != null ? Number(card.market_price) : null,
        tcg_player_url: card.tcg_player_url,
        attacks: card.attacks_data ?? null,
        weakness: card.weakness_data ?? null,
      },
      listings: listings.map((l) => ({
        user_card_id: l.id,
        sale_type: l.sale_type,
        condition: l.condition,
        fixed_price: l.fixed_price != null ? Number(l.fixed_price) : null,
        reserve_price: l.reserve_price != null ? Number(l.reserve_price) : null,
        auction_end: l.auction_end,
        seller_id: l.owner_id,
        seller: nameOf(l.owner_id),
        seller_rating: sellerRatings.get(l.owner_id) ?? null,
        watching: watchedSet.has(l.id),
        current_bid: highest.get(l.id) ?? null,
        bid_count: counts.get(l.id) ?? 0,
      })),
      sales: sales.map((s) => ({
        id: s.id,
        amount: Number(s.amount),
        seller: nameOf(s.seller_id),
        buyer: nameOf(s.buyer_id),
        type: s.transaction_type,
        date: s.updated_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching card:", error);
    return NextResponse.json({ success: false, error: "Failed to load card" }, { status: 500 });
  }
}
