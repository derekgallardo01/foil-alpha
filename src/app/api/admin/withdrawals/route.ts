import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth";
import { createNotification } from "../../../lib/notification";
import { stripe, isConnectEnabled } from "../../../lib/stripe";

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

type Payout = { method: "stripe" | "manual"; transfer_id?: string; transfer_error?: string };

/**
 * Push the real payout via Stripe Connect if enabled and the seller has onboarded.
 * The SAME idempotency key is used on the initial pay and every retry, so a
 * transfer whose response was lost is deduped by Stripe instead of double-sent.
 * Returns `{method:'manual'}` (no transfer) when Connect is off or the seller
 * isn't connected — the admin then handles the payout manually.
 */
async function runPayout(
  withdrawalId: number,
  userId: number,
  amount: number,
  priorNote: string | null
): Promise<Payout> {
  const payout: Payout = { method: "manual" };
  if (!isConnectEnabled() || !stripe) return payout;

  const seller = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripe_connect_account_id: true },
  });
  const acctId = seller?.stripe_connect_account_id;
  if (!acctId) return payout;

  const note = (extra: string) => [priorNote, extra].filter(Boolean).join(" · ").slice(0, 255);
  try {
    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(amount * 100),
        currency: "usd",
        destination: acctId,
        metadata: { withdrawalId: String(withdrawalId) },
      },
      { idempotencyKey: `withdrawal-${withdrawalId}` }
    );
    payout.method = "stripe";
    payout.transfer_id = transfer.id;
    await prisma.walletWithdrawal.update({
      where: { id: withdrawalId },
      data: { admin_note: note(`Stripe transfer ${transfer.id}`) },
    });
  } catch (e) {
    payout.transfer_error = e instanceof Error ? e.message : "transfer failed";
    console.error("Connect transfer failed:", e);
    await prisma.walletWithdrawal.update({
      where: { id: withdrawalId },
      data: { admin_note: note("Payout not sent — use Retry payout") },
    });
  }
  return payout;
}

/**
 * POST /api/admin/withdrawals  { id, action: "pay" | "reject" | "retry_payout", note? }
 * Pay:    deduct balance + release the escrow hold + ledger row, then push the
 *         Stripe transfer (if Connect is on and the seller onboarded).
 * Reject: release the escrow hold (no balance change).
 * Retry:  idempotently re-attempt the transfer for an already-PAID withdrawal.
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

  if (!Number.isInteger(id) || (action !== "pay" && action !== "reject" && action !== "retry_payout")) {
    return NextResponse.json(
      { error: "id and action ('pay'|'reject'|'retry_payout') are required." },
      { status: 400 }
    );
  }

  // Retry a failed payout on an already-settled (PAID) withdrawal — idempotent,
  // so a transfer whose response was lost is deduped rather than double-sent.
  if (action === "retry_payout") {
    const w = await prisma.walletWithdrawal.findUnique({ where: { id } });
    if (!w) return NextResponse.json({ error: "Withdrawal not found." }, { status: 404 });
    if (w.status !== "PAID") {
      return NextResponse.json({ error: "Only a paid withdrawal can retry its payout." }, { status: 400 });
    }
    const payout = await runPayout(w.id, w.user_id, Number(w.amount), null);
    if (payout.transfer_id) {
      try {
        await createNotification({
          user_id: w.user_id,
          type: "WITHDRAWAL_PAID",
          title: "Withdrawal paid",
          message: `Your withdrawal of $${Number(w.amount).toFixed(2)} has been paid out.`,
        });
      } catch (e) {
        console.error("Notification failed:", e);
      }
    }
    return NextResponse.json({
      success: !payout.transfer_error,
      payout,
      withdrawal: { ...w, amount: Number(w.amount) },
    });
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

    // The internal balance is already settled (above), so a failed transfer is a
    // recoverable "owed" state (retryable), not a double-payout; settling before
    // transferring means a concurrent reject can't win after money has moved.
    const payout: Payout =
      result.status === "PAID"
        ? await runPayout(result.id, result.user_id, Number(result.amount), note)
        : { method: "manual" };

    // Notify the requester (best-effort). Only claim "paid out" if the money
    // actually went (manual payout = admin sends it; stripe = transfer succeeded);
    // if the transfer failed, tell them it's approved and processing, not paid.
    try {
      const paid = result.status === "PAID";
      const payoutSent = payout.method !== "stripe" || !!payout.transfer_id;
      if (paid && payoutSent) {
        await createNotification({
          user_id: result.user_id,
          type: "WITHDRAWAL_PAID",
          title: "Withdrawal paid",
          message: `Your withdrawal of $${Number(result.amount).toFixed(2)} has been paid out.`,
        });
      } else if (paid) {
        await createNotification({
          user_id: result.user_id,
          type: "WITHDRAWAL_PROCESSING",
          title: "Withdrawal approved",
          message: `Your withdrawal of $${Number(result.amount).toFixed(2)} is approved — the payout is processing.`,
        });
      } else {
        await createNotification({
          user_id: result.user_id,
          type: "WITHDRAWAL_REJECTED",
          title: "Withdrawal rejected",
          message: `Your withdrawal of $${Number(result.amount).toFixed(2)} was rejected${note ? `: ${note}` : "."}`,
        });
      }
    } catch (e) {
      console.error("Withdrawal notification failed:", e);
    }

    return NextResponse.json({ success: true, payout, withdrawal: { ...result, amount: Number(result.amount) } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed." },
      { status: 400 }
    );
  }
}
