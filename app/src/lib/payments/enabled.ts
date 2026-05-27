/**
 * Card checkout via Paddle (Merchant of Record) is OFF unless ROM_PADDLE_ENABLED=true.
 *
 * Setup: see docs/PADDLE_SETUP.md
 */
export function isCardPaymentsEnabled(): boolean {
  return process.env.ROM_PADDLE_ENABLED?.trim() === "true";
}
