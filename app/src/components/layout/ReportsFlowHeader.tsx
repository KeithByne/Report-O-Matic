"use client";

import Link from "next/link";
import { GlobeLanguageSwitcher } from "@/components/i18n/GlobeLanguageSwitcher";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { AppHeaderLogo, AppHeaderWordmark } from "@/components/layout/AppHeaderBrand";

type Mode = "index" | "tenant" | "class" | "report";

type Props = {
  mode: Mode;
  /** Shown under brand; usually school name or reports hub title */
  title: string;
  tenantId?: string;
  classId?: string;
};

export function ReportsFlowHeader({ mode, title, tenantId, classId }: Props) {
  const { t } = useUiLanguage();

  const links: { href: string; label: string }[] = [];
  if (mode === "index") {
    links.push({ href: "/dashboard", label: t("nav.backDashboard") });
  }
  if (mode === "tenant") {
    links.push({ href: "/reports", label: t("nav.allSchools") });
    links.push({ href: "/dashboard", label: t("nav.dashboard") });
  }
  if (mode === "class" && tenantId) {
    links.push({ href: `/reports/${tenantId}`, label: t("nav.classesLanguage") });
    links.push({ href: "/reports", label: t("nav.allSchools") });
    links.push({ href: "/dashboard", label: t("nav.dashboard") });
  }
  if (mode === "report" && tenantId && classId) {
    links.push({
      href: `/reports/${tenantId}/classes/${classId}`,
      label: t("nav.class"),
    });
    links.push({
      href: `/reports/${tenantId}`,
      label: t("nav.classesLanguage"),
    });
    links.push({ href: "/reports", label: t("nav.allSchools") });
    links.push({ href: "/dashboard", label: t("nav.dashboard") });
  }

  return (
    <header className="border-b border-emerald-200/80 bg-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-start gap-3">
          <AppHeaderLogo />
          <div>
            <AppHeaderWordmark />
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{t("brand.subtitle")}</p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">{title}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GlobeLanguageSwitcher />
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-emerald-800 hover:text-emerald-950 hover:underline">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
