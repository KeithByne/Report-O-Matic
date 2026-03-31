import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  }
  return cached;
}

