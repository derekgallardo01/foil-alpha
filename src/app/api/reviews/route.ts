import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/reviews?seller_id=123 — a seller's rating aggregate + recent reviews.
 */
export async function GET(request: NextRequest) {
  const sellerId = Number(new URL(request.url).searchParams.get("seller_id"));
  if (!Number.isInteger(sellerId)) {
    return NextResponse.json({ error: "seller_id is required" }, { status: 400 });
  }

  try {
    const [agg, reviews] = await Promise.all([
      prisma.review.aggregate({
        where: { seller_id: sellerId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.review.findMany({
        where: { seller_id: sellerId },
        orderBy: { created_at: "desc" },
        take: 20,
      }),
    ]);

    const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
    const reviewers = reviewerIds.length
      ? await prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(reviewers.map((u) => [u.id, u.name]));

    return NextResponse.json({
      success: true,
      average: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      count: agg._count._all,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        reviewer: nameById.get(r.reviewer_id) ?? "Anonymous",
        created_at: r.created_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ success: false, error: "Failed to load reviews" }, { status: 500 });
  }
}

/**
 * POST /api/reviews  { transaction_id, rating, comment? }
 * The buyer of a COMPLETED transaction rates its seller. One review per
 * transaction (enforced by a unique constraint).
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const user = auth.user;

  let body: { transaction_id?: unknown; rating?: unknown; comment?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const transactionId = Number(body.transaction_id);
  const rating = Number(body.rating);
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 500) : null;

  if (!Number.isInteger(transactionId)) {
    return NextResponse.json({ error: "transaction_id is required." }, { status: 400 });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be an integer 1–5." }, { status: 400 });
  }

  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction) return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  if (transaction.buyer_id !== user.id) {
    return NextResponse.json({ error: "You can only review your own purchases." }, { status: 403 });
  }
  if (transaction.status !== "COMPLETED") {
    return NextResponse.json({ error: "Only completed purchases can be reviewed." }, { status: 400 });
  }

  try {
    const review = await prisma.review.create({
      data: {
        transaction_id: transactionId,
        reviewer_id: user.id,
        seller_id: transaction.seller_id,
        rating,
        comment: comment || null,
      },
    });
    return NextResponse.json({ success: true, review }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "You've already reviewed this purchase." }, { status: 409 });
    }
    console.error("Error creating review:", e);
    return NextResponse.json({ error: "Failed to submit review." }, { status: 500 });
  }
}
