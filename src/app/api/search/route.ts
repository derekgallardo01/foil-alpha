import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../lib/auth";

// Reads the query at request time; never statically generate.
export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=<term> — lightweight global card search for the ⌘K palette.
 * Matches card names (and set names), most-viewed first, capped small.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ cards: [] });

  try {
    const cards = await prisma.card.findMany({
      where: {
        OR: [{ name: { contains: q } }, { set_name: { contains: q } }],
      },
      select: {
        id: true,
        name: true,
        set_name: true,
        rarity: true,
        image_url: true,
        market_price: true,
      },
      orderBy: [{ view_count: "desc" }, { name: "asc" }],
      take: 8,
    });

    return NextResponse.json({
      cards: cards.map((c) => ({
        id: c.id,
        name: c.name,
        set_name: c.set_name,
        rarity: c.rarity,
        image_url: c.image_url,
        market_price: c.market_price != null ? Number(c.market_price) : null,
      })),
    });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
