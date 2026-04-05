"use client";

import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { AppHeaderLogo } from "@/components/layout/AppHeaderBrand";

type Props = {
  roleLabel: string;
  /** Display name from profile (not email). */
  userDisplayName: string;
  /** Optional context line below the user name (e.g. school name, “Reports”, “Dashboard”). */
  pageTitle?: string;
};

export function AppHeaderLeftCluster({ roleLabel, userDisplayName, pageTitle }: Props) {
  const { t } = useUiLanguage();
  const name = userDisplayName.trim();
  return (
    <div className="flex min-w-0 items-start gap-3">
      <AppHeaderLogo />
      <div className="min-w-0 flex flex-col items-start text-left">
        <span className="text-lg font-semibold leading-tight tracking-tight text-zinc-900">{t("brand.saasName")}</span>
        {roleLabel.trim() ? <span className="mt-1 text-sm text-zinc-600">{roleLabel.trim()}</span> : null}
        <span className="mt-1 text-sm font-medium text-zinc-900">
          {name || t("header.nameNotSet")}
        </span>
        {pageTitle?.trim() ? (
          <h1 className="mt-2 text-lg font-semibold tracking-tight text-zinc-900">{pageTitle.trim()}</h1>
        ) : null}
      </div>
    </div>
  );
}
