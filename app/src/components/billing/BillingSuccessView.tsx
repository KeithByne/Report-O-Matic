"use client";

import Link from "next/link";
import { GlobeLanguageSwitcher } from "@/components/i18n/GlobeLanguageSwitcher";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { AppHeaderLogo, AppHeaderWordmark } from "@/components/layout/AppHeaderBrand";

export function BillingSuccessView({ tenantId, schoolName }: { tenantId: string; schoolName: string }) {
  const { t } = useUiLanguage();

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950">
      <header className="border-b border-emerald-200/80 bg-white">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-start gap-3">
            <AppHeaderLogo />
            <div>
              <AppHeaderWordmark />
            </div>
          </div>
          <GlobeLanguageSwitcher />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-12">
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{t("billing.successTitle")}</h1>
          <p className="mt-2 text-sm text-zinc-600">{t("billing.successBody")}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/reports/${tenantId}`}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white"
            >
              {t("billing.continueToSchool", { school: schoolName })}
            </Link>
            <Link href={`/reports/${tenantId}/billing`} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm">
              {t("billing.backBilling")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
