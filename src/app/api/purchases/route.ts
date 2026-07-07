import { NextResponse } from "next/server";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/purchases — the signed-in user's buyer-side transaction history
 * (every status), newest first, with card + seller details. Batched (no N+1);
 * returns the standard { success, data } envelope.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const user = auth.user;

  try {
    const transactions = await prisma.transaction.findMany({
      where: { buyer_id: user.id },
      orderBy: { created_at: "desc" },
      take: 100,
    });
    if (transactions.length === 0) return NextResponse.json({ success: true, data: [] });

    const userCardIds = [...new Set(transactions.map((t) => t.user_card_id))];
    const userCards = await prisma.userCard.findMany({ where: { id: { in: userCardIds } } });
    const ucById = new Map(userCards.map((uc) => [uc.id, uc]));

    const cardIds = [...new Set(userCards.map((uc) => uc.card_id))];
    const sellerIds = [...new Set(transactions.map((t) => t.seller_id))];
    const [cards, sellers] = await Promise.all([
      cardIds.length
        ? prisma.card.findMany({
            where: { id: { in: cardIds } },
            select: { id: true, name: true, set_name: true, rarity: true, image_url: true },
          })
        : [],
      sellerIds.length
        ? prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true } })
        : [],
    ]);
    const cardById = new Map(cards.map((c) => [c.id, c]));
    const sellerById = new Map(sellers.map((s) => [s.id, s]));

    // Which of these purchases the buyer has already reviewed.
    const reviewed = new Set(
      (
        await prisma.review.findMany({
          where: { transaction_id: { in: transactions.map((t) => t.id) } },
          select: { transaction_id: true },
        })
      ).map((r) => r.transaction_id)
    );

    const data = transactions.map((t) => {
      const uc = ucById.get(t.user_card_id);
      const card = uc ? cardById.get(uc.card_id) ?? null : null;
      return {
        id: t.id,
        card: card
          ? { id: card.id, name: card.name, set_name: card.set_name, rarity: card.rarity, image_url: card.image_url }
          : null,
        condition: uc?.condition ?? null,
        amount: Number(t.amount),
        seller: sellerById.get(t.seller_id)?.name ?? "Unknown",
        status: t.status,
        type: t.transaction_type,
        purchased_at: t.updated_at,
        created_at: t.created_at,
        notes: t.notes,
        reviewed: reviewed.has(t.id),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching purchases:", error);
    return NextResponse.json({ success: false, error: "Failed to load your purchases" }, { status: 500 });
  }
}
