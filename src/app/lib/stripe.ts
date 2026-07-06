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
