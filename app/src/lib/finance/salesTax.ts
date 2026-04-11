/**
 * Sales tax / VAT / IVA for retail pack display and checkout totals (when card payments are enabled).
 * Configure with env vars.
 */

export type PackPriceTaxBasis = "inclusive" | "exclusive";

/** Default 21% = Spain general IVA; override with ROM_VAT_RATE_PERCENT or ROM_TAX_RATE_PERCENT. */
export function getSalesTaxRatePercent(): number {
  const raw = (process.env.ROM_VAT_RATE_PERCENT ?? process.env.ROM_TAX_RATE_PERCENT ?? "21").trim();
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 21;
}

/**
 * How `credit_packs.price_cents` is stored:
 * - exclusive (default): pack price is before tax; IVA/VAT is added for display: gross = round(net * (100 + rate) / 100).
 * - inclusive: amount already includes tax (customer pays price_cents). Set ROM_PACK_PRICE_TAX_BASIS=inclusive if needed.
 */
export function getPackPriceTaxBasis(): PackPriceTaxBasis {
  const r = (process.env.ROM_PACK_PRICE_TAX_BASIS ?? "exclusive").trim().toLowerCase();
  return r === "inclusive" ? "inclusive" : "exclusive";
}

/** Short label for customer-facing copy (e.g. IVA, VAT, TVA). */
export function getSalesTaxLabelForCustomers(): string {
  const s = (process.env.ROM_SALES_TAX_LABEL ?? "IVA").trim();
  return s || "IVA";
}

/** Cents to charge at checkout / show as total purchase price. */
export function packGrossChargeCents(storedPriceCents: number, ratePercent: number, basis: PackPriceTaxBasis): number {
  const n = Math.max(0, Math.trunc(storedPriceCents));
  if (basis === "inclusive") return n;
  if (ratePercent <= 0) return n;
  return Math.round((n * (100 + ratePercent)) / 100);
}

/** Total price shown on pack cards (same arithmetic as checkout when enabled). */
export function packCustomerDisplayCents(
  storedPriceCents: number,
  ratePercent: number,
  basis: PackPriceTaxBasis
): number {
  return packGrossChargeCents(storedPriceCents, ratePercent, basis);
}
