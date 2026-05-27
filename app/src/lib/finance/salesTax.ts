/**
 * Sales tax / VAT display for credit packs.
 * With Paddle (Merchant of Record), tax is calculated at checkout — do not add a second layer here.
 */

import { isCardPaymentsEnabled } from "@/lib/payments/enabled";

export type PackPriceTaxBasis = "inclusive" | "exclusive";

/** Default 0% when Paddle MoR is on (VAT at checkout). Otherwise 20% UK VAT or ROM_VAT_RATE_PERCENT. */
export function getSalesTaxRatePercent(): number {
  const defaultRate = isCardPaymentsEnabled() ? "0" : "20";
  const raw = (process.env.ROM_VAT_RATE_PERCENT ?? process.env.ROM_TAX_RATE_PERCENT ?? defaultRate).trim();
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : isCardPaymentsEnabled() ? 0 : 20;
}

/**
 * How `credit_packs.price_cents` is stored:
 * - exclusive (default): pack price is before tax; IVA/VAT is added for display: gross = round(net * (100 + rate) / 100).
 * - inclusive: amount already includes tax (customer pays price_cents). Set ROM_PACK_PRICE_TAX_BASIS=inclusive if needed.
 */
export function getPackPriceTaxBasis(): PackPriceTaxBasis {
  const fallback = isCardPaymentsEnabled() ? "inclusive" : "exclusive";
  const r = (process.env.ROM_PACK_PRICE_TAX_BASIS ?? fallback).trim().toLowerCase();
  return r === "inclusive" ? "inclusive" : "exclusive";
}

/** Short label for customer-facing copy (e.g. VAT). */
export function getSalesTaxLabelForCustomers(): string {
  const fallback = isCardPaymentsEnabled() ? "VAT" : "VAT";
  const s = (process.env.ROM_SALES_TAX_LABEL ?? fallback).trim();
  return s || "VAT";
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
