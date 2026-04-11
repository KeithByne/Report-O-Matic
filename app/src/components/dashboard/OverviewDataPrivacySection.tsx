"use client";

import Link from "next/link";
import { ChevronDown, Shield } from "lucide-react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";

export function OverviewDataPrivacySection() {
  const { t } = useUiLanguage();
  return (
    <div className="mt-4 text-left">
      <details className="group rounded-lg border border-emerald-200/80 bg-emerald-50/50">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <ChevronDown
            className={`${ICON_INLINE} shrink-0 text-emerald-700 transition-transform group-open:rotate-180`}
            aria-hidden
          />
          <Shield className={`${ICON_INLINE} shrink-0 text-emerald-800`} aria-hidden />
          <span className="text-sm font-semibold text-zinc-900">{t("dash.guide.stepPrivacyTitle")}</span>
        </summary>
        <div className="border-t border-emerald-100 px-3 py-3 text-xs leading-relaxed text-zinc-600">
          <ol className="ml-4 list-decimal space-y-1.5">
            <li>{t("dash.guide.stepPrivacy1")}</li>
            <li>{t("dash.guide.stepPrivacy2")}</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            <Link
              href="/dashboard/profile"
              className="font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-950"
            >
              {t("dash.profileButton")}
            </Link>
            <Link
              href="/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-950"
            >
              {t("dash.overviewPrivacyLinkPrivacy")}
            </Link>
            <Link
              href="/legal/dpa"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-950"
            >
              {t("dash.overviewPrivacyLinkDpa")}
            </Link>
            <Link
              href="/legal/cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-950"
            >
              {t("dash.overviewPrivacyLinkCookies")}
            </Link>
          </div>
        </div>
      </details>
    </div>
  );
}
