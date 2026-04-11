/**
 * Card payments / Stripe Checkout are OFF unless you set ROM_STRIPE_ENABLED=true in the environment.
 * This keeps billing UI and webhooks safe while you change Stripe accounts or pause payments.
 *
 * To reconnect:
 * 1. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (and any other Stripe env vars you use).
 * 2. In Stripe Dashboard → Webhooks, send events to https://<your-host>/api/stripe/webhook
 *    (e.g. payment_intent.succeeded, transfer.created as your integration expects).
 * 3. Set ROM_STRIPE_ENABLED=true and redeploy.
 */
export function isStripePaymentsEnabled(): boolean {
  return process.env.ROM_STRIPE_ENABLED?.trim() === "true";
}
