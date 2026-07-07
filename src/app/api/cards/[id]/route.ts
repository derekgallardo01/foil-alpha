import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

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

    const sellerIds = [...new Set(listings.map((l) => l.owner_id))];
    const listingIds = listings.map((l) => l.id);
    const [sellers, activeBids] = await Promise.all([
      sellerIds.length
        ? prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true } })
        : [],
      listingIds.length
        ? prisma.bid.findMany({
            where: { userCardId: { in: listingIds }, is_active: true },
            select: { userCardId: true, amount: true },
          })
        : [],
    ]);
    const sellerById = new Map(sellers.map((s) => [s.id, s]));
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
        seller: sellerById.get(l.owner_id)?.name ?? "Unknown",
        current_bid: highest.get(l.id) ?? null,
        bid_count: counts.get(l.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching card:", error);
    return NextResponse.json({ success: false, error: "Failed to load card" }, { status: 500 });
  }
}
