import Stripe from "stripe";

/**
 * Stripe client. Null when STRIPE_SECRET_KEY isn't set so the app builds and
 * runs without payments configured; routes check `isStripeConfigured()` and
 * return 503 when it's absent.
 */
const secretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = secretKey ? new Stripe(secretKey) : null;

export function isStripeConfigured(): boolean {
  return !!stripe;
}

/**
 * Whether real Stripe Connect payouts are enabled. Off by default so the manual
 * admin-payout flow stays the behaviour until Connect is set up on the Stripe
 * account and this flag is turned on.
 */
export function isConnectEnabled(): boolean {
  return isStripeConfigured() && process.env.STRIPE_CONNECT_ENABLED === "true";
}
