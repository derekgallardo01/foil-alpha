import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireUser } from "../../../lib/auth";
import { stripe, isConnectEnabled } from "../../../lib/stripe";

export const dynamic = "force-dynamic";

/**
 * GET /api/wallet/connect — the user's payout-onboarding status.
 * Returns { enabled, hasAccount, payoutsEnabled, detailsSubmitted }.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const enabled = isConnectEnabled();
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { stripe_connect_account_id: true },
  });
  const acctId = user?.stripe_connect_account_id ?? null;

  let payoutsEnabled = false;
  let detailsSubmitted = false;
  if (enabled && acctId && stripe) {
    try {
      const acct = await stripe.accounts.retrieve(acctId);
      payoutsEnabled = !!acct.payouts_enabled;
      detailsSubmitted = !!acct.details_submitted;
    } catch (e) {
      console.error("Connect account retrieve failed:", e);
    }
  }

  return NextResponse.json({ enabled, hasAccount: !!acctId, payoutsEnabled, detailsSubmitted });
}

/**
 * POST /api/wallet/connect — start (or resume) payout onboarding.
 * Creates an Express account if needed and returns an onboarding { url }.
 */
export async function POST() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (auth.user.role === "admin") {
    return NextResponse.json({ error: "Admin accounts don't receive payouts." }, { status: 403 });
  }
  if (!isConnectEnabled() || !stripe) {
    return NextResponse.json({ error: "Payouts aren't enabled yet." }, { status: 503 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { stripe_connect_account_id: true, email: true },
    });

    let acctId = user?.stripe_connect_account_id ?? null;
    if (!acctId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user?.email ?? undefined,
        capabilities: { transfers: { requested: true } },
        metadata: { userId: String(auth.user.id) },
      });
      acctId = account.id;
      await prisma.user.update({
        where: { id: auth.user.id },
        data: { stripe_connect_account_id: acctId },
      });
    }

    const base = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
    const link = await stripe.accountLinks.create({
      account: acctId,
      refresh_url: `${base}/wallet?payouts=refresh`,
      return_url: `${base}/wallet?payouts=done`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error("Connect onboarding error:", err);
    return NextResponse.json({ error: "Could not start payout onboarding." }, { status: 500 });
  }
}
