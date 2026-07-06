import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { forecastPrices, PricePoint } from "../../lib/forecast";

// Reads request params at runtime; never statically generate.
export const dynamic = "force-dynamic";

/**
 * GET /api/forecast?card_id=1&days=90&history_days=180
 * Returns the card's recent price history plus a forecast + confidence band.
 * This is the stable contract; the dedicated Python ML service will later serve
 * the same shape with richer models.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cardId = parseInt(searchParams.get("card_id") || "", 10);
    if (!cardId || Number.isNaN(cardId)) {
      return NextResponse.json({ error: "card_id is required" }, { status: 400 });
    }

    const horizon = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "90", 10)));
    const lookbackDays = Math.min(1095, Math.max(7, parseInt(searchParams.get("history_days") || "180", 10)));
    const since = new Date(Date.now() - lookbackDays * 86_400_000);

    const rows = await prisma.price_history.findMany({
      where: { card_id: cardId, recorded_at: { gte: since } },
      orderBy: { recorded_at: "asc" },
      select: { price: true, recorded_at: true },
    });

    const history: PricePoint[] = rows.map((r) => ({
      date: r.recorded_at.toISOString(),
      price: Number(r.price),
    }));

    const result = forecastPrices(history, horizon);

    return NextResponse.json({
      card_id: cardId,
      horizon_days: horizon,
      points: history.length,
      history: history.map((h) => ({ date: h.date.slice(0, 10), price: h.price })),
      ...result,
    });
  } catch (err) {
    console.error("Forecast error:", err);
    return NextResponse.json({ error: "Failed to generate forecast" }, { status: 500 });
  }
}
