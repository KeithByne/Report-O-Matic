import Stripe from "stripe";
import { isStripePaymentsEnabled } from "@/lib/stripe/enabled";

let cached: Stripe | null = null;

function getStripeSingleton(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  }
  return cached;
}

/**
 * Live Stripe API for Checkout and similar. Returns null if ROM_STRIPE_ENABLED is not "true" or the secret key is missing.
 * See {@link isStripePaymentsEnabled} in `./enabled.ts` for how to turn payments back on.
 */
export function getStripe(): Stripe | null {
  if (!isStripePaymentsEnabled()) return null;
  return getStripeSingleton();
}

/**
 * For webhook signature verification only. Still requires STRIPE_SECRET_KEY.
 * The webhook handler must skip side effects when {@link isStripePaymentsEnabled} is false.
 */
export function getStripeForWebhook(): Stripe | null {
  return getStripeSingleton();
}
