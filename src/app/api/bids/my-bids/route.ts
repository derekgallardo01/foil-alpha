import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/bids/my-bids — the auctions the signed-in user is actively bidding
 * on, each annotated with the auction's current highest bid and whether the
 * user is winning or outbid. Returns the standard { success, data } envelope so
 * it drops into useDashboardResource.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const user = auth.user;

  try {
    // One active bid per user per auction — this is the user's current hold.
    const myBids = await prisma.bid.findMany({
      where: { bidderId: user.id, is_active: true },
      orderBy: { createdAt: "desc" },
    });
    if (myBids.length === 0) return NextResponse.json({ success: true, data: [] });

    const userCardIds = [...new Set(myBids.map((b) => b.userCardId))];

    // Batch the related lookups (no N+1).
    const [userCards, allActiveBids] = await Promise.all([
      prisma.userCard.findMany({ where: { id: { in: userCardIds } } }),
      prisma.bid.findMany({
        where: { userCardId: { in: userCardIds }, is_active: true },
        select: { userCardId: true, amount: true },
      }),
    ]);
    const ucById = new Map(userCards.map((uc) => [uc.id, uc]));

    const cardIds = [...new Set(userCards.map((uc) => uc.card_id))];
    const sellerIds = [...new Set(userCards.map((uc) => uc.owner_id))];
    const [cards, sellers] = await Promise.all([
      cardIds.length
        ? prisma.card.findMany({
            where: { id: { in: cardIds } },
            select: { id: true, name: true, set_name: true, image_url: true },
          })
        : [],
      sellerIds.length
        ? prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true } })
        : [],
    ]);
    const cardById = new Map(cards.map((c) => [c.id, c]));
    const sellerById = new Map(sellers.map((s) => [s.id, s]));

    // Highest active bid + active-bid count per auction.
    const highestByAuction = new Map<number, number>();
    const countByAuction = new Map<number, number>();
    for (const b of allActiveBids) {
      const amt = Number(b.amount);
      highestByAuction.set(b.userCardId, Math.max(highestByAuction.get(b.userCardId) ?? 0, amt));
      countByAuction.set(b.userCardId, (countByAuction.get(b.userCardId) ?? 0) + 1);
    }

    const now = Date.now();
    const data = myBids
      .map((b) => {
        const uc = ucById.get(b.userCardId);
        if (!uc) return null;
        const card = cardById.get(uc.card_id) ?? null;
        const myAmount = Number(b.amount);
        const highest = highestByAuction.get(b.userCardId) ?? myAmount;
        const isWinning = myAmount >= highest;
        const reserve = Number(uc.reserve_price) || 0;
        const reserveMet = highest >= reserve;
        const ended = uc.is_sold || (uc.auction_end ? new Date(uc.auction_end).getTime() <= now : false);

        const status: "winning" | "outbid" | "won" | "ended" = ended
          ? isWinning && reserveMet
            ? "won"
            : "ended"
          : isWinning
            ? "winning"
            : "outbid";

        return {
          user_card_id: b.userCardId,
          card: card
            ? { id: card.id, name: card.name, set_name: card.set_name, image_url: card.image_url }
            : null,
          seller: sellerById.get(uc.owner_id)?.name ?? "Unknown",
          my_bid: myAmount,
          current_highest: highest,
          is_winning: isWinning,
          bid_count: countByAuction.get(b.userCardId) ?? 1,
          auction_end: uc.auction_end,
          reserve_price: reserve || null,
          reserve_met: reserveMet,
          status,
          created_at: b.createdAt,
        };
      })
      .filter((x) => x !== null && x.card !== null);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching my bids:", error);
    return NextResponse.json({ success: false, error: "Failed to load your bids" }, { status: 500 });
  }
}
