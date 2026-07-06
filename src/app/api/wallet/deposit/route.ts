import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth";
import { stripe, isStripeConfigured } from "../../../lib/stripe";

export const dynamic = "force-dynamic";

/**
 * POST /api/wallet/deposit  { amount: number (USD) }
 * Creates a Stripe Checkout Session to add real funds to the user's wallet and
 * returns { url } for the client to redirect to. The wallet is credited later
 * by the webhook once payment completes.
 */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });
  }

  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const user = auth.user;
  if (user.role === "admin") {
    return NextResponse.json({ error: "Admin accounts do not have a wallet." }, { status: 403 });
  }

  let amount: unknown;
  try {
    ({ amount } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const dollars = Number(amount);
  if (!Number.isFinite(dollars) || dollars < 1 || dollars > 10000) {
    return NextResponse.json({ error: "Enter an amount between $1 and $10,000." }, { status: 400 });
  }

  const base = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Foil Alpha wallet deposit" },
            unit_amount: Math.round(dollars * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { userId: String(user.id), type: "wallet_deposit" },
      success_url: `${base}/wallet?deposit=success`,
      cancel_url: `${base}/wallet?deposit=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
