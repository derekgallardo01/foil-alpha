import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/watch              → the user's watched listings (with details), for the Watching page.
 * GET /api/watch?user_card_id=X → { watching: boolean } for a single listing.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const user = auth.user;

  const single = new URL(request.url).searchParams.get("user_card_id");
  if (single) {
    const id = Number(single);
    const row = Number.isInteger(id)
      ? await prisma.watchedListing.findUnique({ where: { user_id_user_card_id: { user_id: user.id, user_card_id: id } } })
      : null;
    return NextResponse.json({ watching: !!row });
  }

  try {
    const watched = await prisma.watchedListing.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: "desc" },
      take: 100,
    });
    if (watched.length === 0) return NextResponse.json({ success: true, data: [] });

    const ucIds = [...new Set(watched.map((w) => w.user_card_id))];
    const userCards = await prisma.userCard.findMany({ where: { id: { in: ucIds } } });
    const ucById = new Map(userCards.map((uc) => [uc.id, uc]));

    const cardIds = [...new Set(userCards.map((uc) => uc.card_id))];
    const sellerIds = [...new Set(userCards.map((uc) => uc.owner_id))];
    const [cards, sellers, activeBids] = await Promise.all([
      cardIds.length
        ? prisma.card.findMany({ where: { id: { in: cardIds } }, select: { id: true, name: true, set_name: true, image_url: true } })
        : [],
      sellerIds.length
        ? prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true } })
        : [],
      ucIds.length
        ? prisma.bid.findMany({ where: { userCardId: { in: ucIds }, is_active: true }, select: { userCardId: true, amount: true } })
        : [],
    ]);
    const cardById = new Map(cards.map((c) => [c.id, c]));
    const sellerById = new Map(sellers.map((s) => [s.id, s]));
    const highest = new Map<number, number>();
    for (const b of activeBids) highest.set(b.userCardId, Math.max(highest.get(b.userCardId) ?? 0, Number(b.amount)));

    const now = Date.now();
    const data = watched
      .map((w) => {
        const uc = ucById.get(w.user_card_id);
        if (!uc) return null;
        const card = cardById.get(uc.card_id) ?? null;
        const isAuction = uc.sale_type === "AUCTION";
        const ended = uc.is_sold || (uc.auction_end ? new Date(uc.auction_end).getTime() <= now : false);
        return {
          user_card_id: w.user_card_id,
          card: card ? { id: card.id, name: card.name, set_name: card.set_name, image_url: card.image_url } : null,
          seller: sellerById.get(uc.owner_id)?.name ?? "Unknown",
          sale_type: uc.sale_type,
          price: isAuction ? highest.get(w.user_card_id) ?? (uc.reserve_price != null ? Number(uc.reserve_price) : null) : uc.fixed_price != null ? Number(uc.fixed_price) : null,
          auction_end: uc.auction_end,
          is_for_sale: uc.is_for_sale,
          status: !uc.is_for_sale || ended ? "ended" : "live",
        };
      })
      .filter((x) => x !== null);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching watched listings:", error);
    return NextResponse.json({ success: false, error: "Failed to load your watchlist" }, { status: 500 });
  }
}

/** POST /api/watch { user_card_id } — start watching a listing (idempotent). */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const user = auth.user;

  const body = await request.json().catch(() => ({}));
  const userCardId = Number(body.user_card_id);
  if (!Number.isInteger(userCardId)) {
    return NextResponse.json({ error: "user_card_id is required." }, { status: 400 });
  }

  const uc = await prisma.userCard.findUnique({ where: { id: userCardId }, select: { id: true } });
  if (!uc) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  try {
    await prisma.watchedListing.create({ data: { user_id: user.id, user_card_id: userCardId } });
  } catch (e) {
    // Already watching — idempotent success.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) {
      console.error("Error adding watch:", e);
      return NextResponse.json({ error: "Failed to watch listing." }, { status: 500 });
    }
  }
  return NextResponse.json({ success: true, watching: true });
}

/** DELETE /api/watch?user_card_id=X — stop watching. */
export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const user = auth.user;

  const userCardId = Number(new URL(request.url).searchParams.get("user_card_id"));
  if (!Number.isInteger(userCardId)) {
    return NextResponse.json({ error: "user_card_id is required." }, { status: 400 });
  }

  await prisma.watchedListing.deleteMany({ where: { user_id: user.id, user_card_id: userCardId } });
  return NextResponse.json({ success: true, watching: false });
}
