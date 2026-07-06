import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "../../../lib/stripe";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe webhook. Verifies the signature, then on a completed wallet-deposit
 * checkout credits the user's wallet (idempotently). Point your Stripe webhook
 * at /api/webhooks/stripe and set STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "Missing webhook secret or signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.type === "wallet_deposit" && session.payment_status === "paid") {
        const userId = parseInt(session.metadata.userId ?? "", 10);
        const amount = (session.amount_total ?? 0) / 100;
        if (userId && amount > 0) {
          await creditWallet(userId, amount, session.id);
        }
      }
    }
  } catch (err) {
    console.error("Stripe webhook handling error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function creditWallet(userId: number, amount: number, sessionId: string) {
  await prisma.$transaction(async (tx) => {
    // Idempotency: a given Checkout Session credits at most once.
    const already = await tx.walletTransaction.findFirst({
      where: { reference_type: "STRIPE_DEPOSIT", description: sessionId },
    });
    if (already) return;

    let wallet = await tx.userWallet.findUnique({ where: { user_id: userId } });
    if (!wallet) {
      wallet = await tx.userWallet.create({
        data: { user_id: userId, balance: 0, frozen_balance: 0 },
      });
    }

    const before = Number(wallet.balance);
    const after = before + amount;

    await tx.userWallet.update({ where: { user_id: userId }, data: { balance: after } });
    await tx.walletTransaction.create({
      data: {
        user_id: userId,
        wallet_id: wallet.id,
        transaction_type: "DEPOSIT",
        amount,
        balance_before: before,
        balance_after: after,
        description: sessionId,
        reference_type: "STRIPE_DEPOSIT",
      },
    });
  });
}
