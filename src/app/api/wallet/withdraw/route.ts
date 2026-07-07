import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

const MIN_WITHDRAWAL = 5;
const MAX_WITHDRAWAL = 10000;

/**
 * GET /api/wallet/withdraw — the current user's withdrawal requests.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const withdrawals = await prisma.walletWithdrawal.findMany({
    where: { user_id: auth.user.id },
    orderBy: { requested_at: "desc" },
    take: 50,
  });
  return NextResponse.json({
    withdrawals: withdrawals.map((w) => ({ ...w, amount: Number(w.amount) })),
  });
}

/**
 * POST /api/wallet/withdraw  { amount, method? }
 * Requests a payout. Holds the amount in escrow (frozen_balance) so it can't be
 * spent while pending; an admin later pays or rejects it.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (auth.user.role === "admin") {
    return NextResponse.json({ error: "Admin accounts do not have a wallet." }, { status: 403 });
  }
  const userId = auth.user.id;

  let body: { amount?: unknown; method?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const amount = Math.round(Number(body.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL || amount > MAX_WITHDRAWAL) {
    return NextResponse.json(
      { error: `Enter an amount between $${MIN_WITHDRAWAL} and $${MAX_WITHDRAWAL.toLocaleString()}.` },
      { status: 400 }
    );
  }
  const method = typeof body.method === "string" ? body.method.slice(0, 100) : null;

  try {
    const withdrawal = await prisma.$transaction(async (tx) => {
      // Atomic check-and-freeze: the WHERE clause re-evaluates availability at
      // write time under a row lock, so concurrent requests (or a request racing
      // a bid) can't oversubscribe the balance. A blind read-then-increment would.
      const affected = await tx.$executeRaw`
        UPDATE user_wallets
        SET frozen_balance = frozen_balance + ${amount}
        WHERE user_id = ${userId} AND (balance - frozen_balance) >= ${amount}`;
      if (affected !== 1) {
        throw new Error("Insufficient available balance for this withdrawal.");
      }

      return tx.walletWithdrawal.create({
        data: { user_id: userId, amount, method, status: "PENDING" },
      });
    });

    return NextResponse.json({ success: true, withdrawal: { ...withdrawal, amount: Number(withdrawal.amount) } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Withdrawal request failed." },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/wallet/withdraw?id=123 — cancel one of the user's own PENDING
 * requests, releasing the escrow hold.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;

  const id = parseInt(new URL(req.url).searchParams.get("id") || "", 10);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const w = await tx.walletWithdrawal.findUnique({ where: { id } });
      if (!w || w.user_id !== userId) throw new Error("Withdrawal not found.");

      // Conditional transition is the concurrency gate: only ONE caller can flip
      // PENDING→CANCELLED, so the escrow hold is released exactly once even if two
      // cancels (or a cancel and an admin pay) race.
      const transitioned = await tx.walletWithdrawal.updateMany({
        where: { id, user_id: userId, status: "PENDING" },
        data: { status: "CANCELLED", processed_at: new Date() },
      });
      if (transitioned.count !== 1) throw new Error("Only pending requests can be cancelled.");

      await tx.userWallet.update({
        where: { user_id: userId },
        data: { frozen_balance: { decrement: Number(w.amount) } },
      });
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cancel failed." },
      { status: 400 }
    );
  }
}
