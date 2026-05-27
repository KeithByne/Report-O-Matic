/**
 * Credit pack list prices (GBP pence stored in `credit_packs.price_cents`).
 *
 * GBP uses the same numeric amounts as the legacy EUR list in migration 0019
 * (e.g. €25.00 → £25.00, stored as 2500 pence).
 */

export const PACK_LIST_PRICE_CENTS: Record<string, number> = {
  tester: 500,
  economy: 2500,
  school: 5000,
  large_school: 10000,
  universal_school: 50000,
};

/** GBP pence for a pack id (parity with legacy EUR euro amounts). */
export function gbpPackPriceCents(packId: string, listCents?: number): number {
  const cents = listCents ?? PACK_LIST_PRICE_CENTS[packId] ?? 0;
  return Math.max(0, Math.trunc(cents));
}

/** @deprecated Use gbpPackPriceCents — kept for any stale imports. */
export const PACK_EUR_CENTS = PACK_LIST_PRICE_CENTS;

/** @deprecated Use gbpPackPriceCents. */
export function gbpPackPriceCentsFromEur(packId: string, eurCents?: number): number {
  return gbpPackPriceCents(packId, eurCents);
}

export const DEFAULT_GBP_PACK_PRICE_CENTS: Record<string, number> = { ...PACK_LIST_PRICE_CENTS };
