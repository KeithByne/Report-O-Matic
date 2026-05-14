/**
 * Card payments / Stripe Checkout are OFF unless you set ROM_STRIPE_ENABLED=true in the environment.
 * This keeps billing UI and webhooks safe while you change Stripe accounts or pause payments.
 *
 * To reconnect:
 * 1. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (and any other Stripe env vars you use).
 * 2. In Stripe Dashboard → Webhooks, send events to https://<your-host>/api/stripe/webhook
 *    (e.g. payment_intent.succeeded, transfer.created as your integration expects).
 * 3. Set ROM_STRIPE_ENABLED=true and redeploy.
 *
 * While Stripe is off in production, self-serve “new school” signup on the landing page is
 * also disabled by default (see `ROM_PUBLIC_SCHOOL_SIGNUP` in `lib/auth/publicSignupPolicy.ts`).
 */
export function isStripePaymentsEnabled(): boolean {
  return process.env.ROM_STRIPE_ENABLED?.trim() === "true";
}
