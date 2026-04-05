"use client";

import Link from "next/link";
import { GlobeLanguageSwitcher } from "@/components/i18n/GlobeLanguageSwitcher";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { AppHeaderLeftCluster } from "@/components/layout/AppHeaderLeftCluster";
import type { RomRole } from "@/lib/data/memberships";
import { packCustomerDisplayCents, type PackPriceTaxBasis } from "@/lib/finance/salesTax";

type Pack = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  report_credits: number;
};

type PackTaxDisplay = {
  taxRatePercent: number;
  packTaxBasis: PackPriceTaxBasis;
  salesTaxLabel: string;
};

type TestAccessBanner = {
  isTestAccess: boolean;
  testCreditsRemaining: number;
  testTrialExhausted: boolean;
};

function billingRoleLabel(role: RomRole, t: (k: string) => string): string {
  switch (role) {
    case "owner":
      return t("dash.role.owner");
    case "department_head":
      return t("dash.role.department_head");
    case "teacher":
      return t("dash.role.teacher");
    default:
      return role;
  }
}

export function TenantBillingView({
  tenantId,
  schoolName,
  role,
  userDisplayName,
  accountCreditsRemaining,
  packs,
  packTaxDisplay,
  testAccess,
}: {
  tenantId: string;
  schoolName: string;
  role: RomRole;
  userDisplayName: string;
  accountCreditsRemaining: number;
  packs: Pack[];
  packTaxDisplay: PackTaxDisplay;
  testAccess: TestAccessBanner;
}) {
  const { t } = useUiLanguage();

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950">
      <header className="border-b border-emerald-200/80 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
          <AppHeaderLeftCluster
            roleLabel={billingRoleLabel(role, t)}
            userDisplayName={userDisplayName}
            pageTitle={t("billing.title")}
          />
          <div className="flex w-full min-w-0 flex-1 items-center justify-end gap-2 sm:w-auto sm:flex-none sm:flex-nowrap">
            <GlobeLanguageSwitcher />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-600">
            {role === "owner" ? (
              <>
                {t("billing.leadOwnerLine1")} <strong>{t("billing.leadOwnerAccount")}</strong>{" "}
                {t("billing.leadOwnerLine2", { school: schoolName })}
              </>
            ) : (
              <>{t("billing.leadNonOwner", { school: schoolName })}</>
            )}
          </p>
          <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
            <span className="font-semibold">{t("billing.currentBalanceLabel")}</span>{" "}
            <span className="tabular-nums font-bold text-zinc-900">
              {t("billing.reportsRemaining", { n: accountCreditsRemaining })}
            </span>
          </p>
          {role === "owner" && testAccess.isTestAccess && testAccess.testCreditsRemaining > 0 ? (
            <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
              {t("billing.testTrialActive", { n: testAccess.testCreditsRemaining })}
            </p>
          ) : null}
          {role === "owner" && testAccess.testTrialExhausted ? (
            <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
              {t("billing.testConvertLead")}
            </p>
          ) : null}
          {role !== "owner" ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t("billing.ownerOnly")}
            </p>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {packs.map((p) => {
              const storedCents = Number(p.price_cents);
              const displayCents = packCustomerDisplayCents(
                Number.isFinite(storedCents) ? storedCents : 0,
                packTaxDisplay.taxRatePercent,
                packTaxDisplay.packTaxBasis
              );
              const currencyUpper = String(p.currency).toUpperCase();
              const taxDetail =
                packTaxDisplay.taxRatePercent > 0
                  ? `${packTaxDisplay.taxRatePercent}% ${packTaxDisplay.salesTaxLabel}`
                  : packTaxDisplay.salesTaxLabel;
              return (
              <form
                key={p.id}
                action={`/api/tenants/${encodeURIComponent(tenantId)}/billing/checkout`}
                method="post"
                className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4"
              >
                <input type="hidden" name="pack_id" value={String(p.id)} />
                <div className="text-sm font-semibold text-zinc-900">{String(p.name)}</div>
                {packTaxDisplay.packTaxBasis === "exclusive" && packTaxDisplay.taxRatePercent > 0 ? (
                  <p className="mt-1 text-xs text-zinc-600">
                    {t("billing.packNetBeforeTax", {
                      tax: packTaxDisplay.salesTaxLabel,
                      price: (Math.max(0, Math.trunc(storedCents)) / 100).toFixed(2),
                      currency: currencyUpper,
                    })}
                  </p>
                ) : null}
                <div className={`mt-1 text-sm tabular-nums ${packTaxDisplay.taxRatePercent > 0 ? "font-semibold text-zinc-900" : "text-xs text-zinc-600"}`}>
                  {t("billing.packLine", {
                    credits: Number(p.report_credits),
                    price: (displayCents / 100).toFixed(2),
                    currency: currencyUpper,
                  })}
                </div>
                {packTaxDisplay.taxRatePercent > 0 ? (
                  <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                    {packTaxDisplay.packTaxBasis === "exclusive"
                      ? t("billing.packTaxAddedToBase", { taxDetail })
                      : t("billing.packTaxIncluded", { taxDetail })}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={role !== "owner"}
                  className="mt-3 w-full rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {t("billing.continuePayment")}
                </button>
              </form>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <Link href={`/reports/${tenantId}`} className="text-sm font-semibold text-emerald-800 hover:underline">
              {t("billing.backReports")}
            </Link>
            <Link href="/dashboard" className="text-sm text-zinc-600 hover:underline">
              {t("nav.dashboard")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
