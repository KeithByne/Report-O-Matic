"use client";

import Link from "next/link";
import { CreditCard } from "lucide-react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import type { RomRole } from "@/lib/data/memberships";

type Props = {
  creditBalance: number | null;
  billingTenantId?: string | null;
  viewerRole?: RomRole | null;
};

/** Persistent lower-screen reminder when export credits are low or zero. */
export function ReportCreditsFloatingBanner({ creditBalance, billingTenantId, viewerRole }: Props) {
  const { t } = useUiLanguage();

  if (creditBalance === null || creditBalance > 25) return null;

  const isOwner = viewerRole === "owner";
  const billingHref =
    billingTenantId && isOwner ? `/reports/${encodeURIComponent(billingTenantId)}/billing` : null;

  const title =
    creditBalance <= 0
      ? isOwner
        ? t("credits.bannerZeroOwnerTitle")
        : t("credits.bannerZeroStaffTitle")
      : t("credits.bannerLowTitle");

  const body =
    creditBalance <= 0
      ? isOwner
        ? t("credits.bannerZeroOwnerBody")
        : t("credits.bannerZeroStaffBody")
      : t("credits.bannerLowBody", { n: creditBalance });

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 sm:p-4"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex max-w-3xl flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg sm:flex-row sm:items-center sm:justify-between dark:border-amber-600 dark:bg-[#1a3558] dark:text-[#fef9c3]">
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed opacity-90">{body}</p>
        </div>
        {billingHref ? (
          <Link
            href={billingHref}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900"
          >
            <CreditCard className={ICON_INLINE} aria-hidden />
            {t("credits.bannerBuyCredits")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
