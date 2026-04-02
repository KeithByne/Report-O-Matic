/** VAT estimate on platform revenue for SaaS-owner dashboard (informational only, not tax advice). */

import { getSalesTaxRatePercent } from "@/lib/finance/salesTax";

export type VatBasis = "inclusive" | "exclusive";

export type VatEstimateConfig =
  | { enabled: false }
  | { enabled: true; ratePercent: number; basis: VatBasis; displayCurrency: string };

export function parseVatEstimateEnv(): VatEstimateConfig {
  const raw = process.env.ROM_VAT_ESTIMATE?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return { enabled: false };
  }

  const ratePercent = getSalesTaxRatePercent();

  const basisRaw = (process.env.ROM_VAT_BASIS ?? "inclusive").trim().toLowerCase();
  const basis: VatBasis = basisRaw === "exclusive" ? "exclusive" : "inclusive";

  const displayCurrency = (process.env.ROM_VAT_DISPLAY_CURRENCY ?? "GBP").trim().toUpperCase() || "GBP";

  return { enabled: true, ratePercent, basis, displayCurrency };
}

/** `grossCents` = VAT-inclusive turnover in smallest currency unit. */
export function vatFromInclusiveGrossCents(grossCents: number, ratePercent: number): number {
  if (grossCents <= 0 || ratePercent <= 0) return 0;
  return Math.round((grossCents * ratePercent) / (100 + ratePercent));
}

/** `netCents` = amount before VAT; VAT = net * rate/100. */
export function vatOnExclusiveNetCents(netCents: number, ratePercent: number): number {
  if (netCents <= 0 || ratePercent <= 0) return 0;
  return Math.round((netCents * ratePercent) / 100);
}

export function vatOnPaymentsCents(grossOrNetCents: number, ratePercent: number, basis: VatBasis): number {
  return basis === "inclusive"
    ? vatFromInclusiveGrossCents(grossOrNetCents, ratePercent)
    : vatOnExclusiveNetCents(grossOrNetCents, ratePercent);
}
