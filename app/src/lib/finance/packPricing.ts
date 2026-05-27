/**
 * Credit pack list prices (GBP pence stored in `credit_packs.price_cents`).
 *
 * Formula: round(EUR_cents × ROM_EUR_TO_GBP_RATE) × ROM_PADDLE_FEE_MULTIPLIER
 * — EUR list prices are the legacy pack amounts in migration 0019.
 * — 10% margin covers Paddle Merchant-of-Record fees (configure ROM_PADDLE_FEE_MULTIPLIER).
 */

export const PACK_EUR_CENTS: Record<string, number> = {
  tester: 500,
  economy: 2500,
  school: 5000,
  large_school: 10000,
  universal_school: 50000,
};

/** HMRC-friendly static rate; override with ROM_EUR_TO_GBP_RATE. */
export function getEurToGbpRate(): number {
  const raw = (process.env.ROM_EUR_TO_GBP_RATE ?? "0.86").trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0.86;
}

/** Paddle MoR fee margin baked into list price (default 10%). */
export function getPaddleFeeMultiplier(): number {
  const raw = (process.env.ROM_PADDLE_FEE_MULTIPLIER ?? "1.10").trim();
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? n : 1.1;
}

/** GBP pence for a pack id from EUR list + conversion + Paddle margin. */
export function gbpPackPriceCentsFromEur(packId: string, eurCents?: number): number {
  const eur = eurCents ?? PACK_EUR_CENTS[packId] ?? 0;
  const gbpBase = Math.round(Math.max(0, eur) * getEurToGbpRate());
  return Math.round(gbpBase * getPaddleFeeMultiplier());
}

/** Precomputed GBP pence for all default packs (migration / docs). */
export const DEFAULT_GBP_PACK_PRICE_CENTS: Record<string, number> = Object.fromEntries(
  Object.keys(PACK_EUR_CENTS).map((id) => [id, gbpPackPriceCentsFromEur(id)]),
);
