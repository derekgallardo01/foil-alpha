import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth";
import { createNotification } from "../../../lib/notification";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/withdrawals?status=PENDING — list withdrawal requests with the
 * requesting user's name/email (batched, no N+1).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const status = new URL(req.url).searchParams.get("status") || undefined;

  const withdrawals = await prisma.walletWithdrawal.findMany({
    where: status ? { status } : {},
    orderBy: [{ status: "asc" }, { requested_at: "desc" }],
    take: 200,
  });

  const userIds = [...new Set(withdrawals.map((w) => w.user_id))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u] as const));

  return NextResponse.json({
    withdrawals: withdrawals.map((w) => ({
      ...w,
      amount: Number(w.amount),
      user: userById.get(w.user_id) ?? null,
    })),
  });
}

/**
 * POST /api/admin/withdrawals  { id, action: "pay" | "reject", note? }
 * Pay:    deduct balance + release the escrow hold, write a ledger row.
 * Reject: release the escrow hold (no balance change).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const admin = auth.user;

  let body: { id?: unknown; action?: unknown; note?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const id = Number(body.id);
  const action = body.action;
  const note = typeof body.note === "string" ? body.note.slice(0, 255) : null;

  if (!Number.isInteger(id) || (action !== "pay" && action !== "reject")) {
    return NextResponse.json({ error: "id and action ('pay'|'reject') are required." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const w = await tx.walletWithdrawal.findUnique({ where: { id } });
      if (!w) throw new Error("Withdrawal not found.");
      if (w.status !== "PENDING") throw new Error(`Request is already ${w.status.toLowerCase()}.`);

      const amount = Number(w.amount);
      const newStatus = action === "pay" ? "PAID" : "REJECTED";

      // Conditional transition is the concurrency gate: only ONE caller wins the
      // PENDING→(PAID|REJECTED) flip, so a request can't be paid twice, or paid
      // AND rejected, or paid while the user cancels — the wallet mutation below
      // runs at most once.
      const transitioned = await tx.walletWithdrawal.updateMany({
        where: { id, status: "PENDING" },
        data: { status: newStatus, admin_id: admin.id, admin_note: note, processed_at: new Date() },
      });
      if (transitioned.count !== 1) throw new Error("Request is no longer pending.");

      const wallet = await tx.userWallet.findUnique({ where: { user_id: w.user_id } });
      if (!wallet) throw new Error("User wallet not found.");

      if (action === "pay") {
        // Deduct the paid amount and release its hold in one step.
        const updated = await tx.userWallet.update({
          where: { user_id: w.user_id },
          data: {
            balance: { decrement: amount },
            frozen_balance: { decrement: amount },
          },
        });
        await tx.walletTransaction.create({
          data: {
            user_id: w.user_id,
            wallet_id: wallet.id,
            transaction_type: "WITHDRAWAL",
            amount: -amount,
            balance_before: Number(wallet.balance),
            balance_after: Number(updated.balance),
            description: `Withdrawal paid out${w.method ? ` to ${w.method}` : ""}`,
            reference_type: "WITHDRAWAL",
            reference_id: w.id,
            admin_id: admin.id,
          },
        });
      } else {
        // reject: release the hold, balance unchanged.
        await tx.userWallet.update({
          where: { user_id: w.user_id },
          data: { frozen_balance: { decrement: amount } },
        });
      }

      return { ...w, status: newStatus };
    });

    // Notify the requester (best-effort).
    try {
      const paid = result.status === "PAID";
      await createNotification({
        user_id: result.user_id,
        type: paid ? "WITHDRAWAL_PAID" : "WITHDRAWAL_REJECTED",
        title: paid ? "Withdrawal paid" : "Withdrawal rejected",
        message: paid
          ? `Your withdrawal of $${Number(result.amount).toFixed(2)} has been paid out.`
          : `Your withdrawal of $${Number(result.amount).toFixed(2)} was rejected${note ? `: ${note}` : "."}`,
      });
    } catch (e) {
      console.error("Withdrawal notification failed:", e);
    }

    return NextResponse.json({ success: true, withdrawal: { ...result, amount: Number(result.amount) } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed." },
      { status: 400 }
    );
  }
}
