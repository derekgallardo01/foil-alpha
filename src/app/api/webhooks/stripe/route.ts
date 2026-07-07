import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "../../../lib/stripe";
import { prisma } from "../../../lib/prisma";
import { createNotification } from "../../../lib/notification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe webhook. Verifies the signature, then:
 *  - completed wallet-deposit checkout  -> credit the wallet (idempotent),
 *  - charge.refunded                    -> reverse the credited amount,
 *  - charge.dispute.created (chargeback)-> claw back the disputed amount.
 * Point your Stripe webhook at /api/webhooks/stripe and set STRIPE_WEBHOOK_SECRET.
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
    } else if (event.type === "charge.refunded") {
      await handleRefund(event.data.object as Stripe.Charge);
    } else if (event.type === "charge.dispute.created") {
      await handleDispute(event.data.object as Stripe.Dispute);
    }
  } catch (err) {
    console.error("Stripe webhook handling error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** The user id behind a deposit charge, via the PaymentIntent metadata we stamp. */
async function depositUserId(charge: Stripe.Charge): Promise<number | null> {
  if (!stripe) return null;
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return null;
  const pi = await stripe.paymentIntents.retrieve(piId);
  if (pi.metadata?.type !== "wallet_deposit") return null;
  const uid = parseInt(pi.metadata?.userId ?? "", 10);
  return uid || null;
}

/** Reverse each refund on a deposit charge (handles partial + multiple refunds). */
async function handleRefund(charge: Stripe.Charge) {
  const userId = await depositUserId(charge);
  if (!userId) return;

  let refunds = charge.refunds?.data ?? [];
  if (refunds.length === 0 && (charge.amount_refunded ?? 0) > 0 && stripe) {
    const full = await stripe.charges.retrieve(charge.id, { expand: ["refunds"] });
    refunds = full.refunds?.data ?? [];
  }

  for (const r of refunds) {
    await debitWallet(userId, r.amount / 100, "STRIPE_REFUND", r.id, "Deposit refunded");
  }
}

/** A chargeback claws back the disputed amount (once, keyed by dispute id). */
async function handleDispute(dispute: Stripe.Dispute) {
  if (!stripe) return;
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return;
  const charge = await stripe.charges.retrieve(chargeId);
  const userId = await depositUserId(charge);
  if (!userId) return;
  await debitWallet(userId, dispute.amount / 100, "STRIPE_DISPUTE", dispute.id, "Deposit disputed (chargeback)");
}

/**
 * Reverse `amount` from the wallet, idempotently (keyed by refKey). Balance may
 * go negative — a refund/chargeback of already-spent funds is a genuine debt.
 */
async function debitWallet(userId: number, amount: number, refType: string, refKey: string, label: string) {
  if (amount <= 0) return;
  const applied = await prisma.$transaction(async (tx) => {
    // A given refund/dispute reverses at most once.
    const already = await tx.walletTransaction.findFirst({
      where: { reference_type: refType, description: refKey },
    });
    if (already) return false;

    const wallet = await tx.userWallet.findUnique({ where: { user_id: userId } });
    if (!wallet) return false;

    const before = Number(wallet.balance);
    const after = before - amount;
    await tx.userWallet.update({ where: { user_id: userId }, data: { balance: after } });
    await tx.walletTransaction.create({
      data: {
        user_id: userId,
        wallet_id: wallet.id,
        transaction_type: refType,
        amount: -amount,
        balance_before: before,
        balance_after: after,
        description: refKey,
        reference_type: refType,
      },
    });
    return true;
  });

  if (applied) {
    try {
      await createNotification({
        user_id: userId,
        type: refType,
        title: `${label} — $${amount.toFixed(2)}`,
        message: `$${amount.toFixed(2)} was reversed from your wallet (${label.toLowerCase()}).`,
      });
    } catch (e) {
      console.error("Reversal notification failed:", e);
    }
  }
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
