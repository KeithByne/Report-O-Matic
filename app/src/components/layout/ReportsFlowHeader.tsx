"use client";

import { BookMarked, Building2, LayoutDashboard, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { GlobeLanguageSwitcher } from "@/components/i18n/GlobeLanguageSwitcher";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { AppHeaderLogo, AppHeaderWordmark } from "@/components/layout/AppHeaderBrand";
import { ICON_INLINE } from "@/components/ui/iconSizes";

type Mode = "index" | "tenant" | "class" | "report";

type Props = {
  mode: Mode;
  /** Shown under brand; usually school name or reports hub title */
  title: string;
  tenantId?: string;
  classId?: string;
  /** Multi-school hub at /reports — owners only; hide for department heads and teachers. */
  showAllSchoolsLink?: boolean;
};

export function ReportsFlowHeader({ mode, title, tenantId, classId, showAllSchoolsLink }: Props) {
  const { t } = useUiLanguage();

  const links: { href: string; label: string; Icon: LucideIcon }[] = [];
  if (mode === "index") {
    links.push({ href: "/dashboard", label: t("nav.backDashboard"), Icon: LayoutDashboard });
  }
  if (mode === "tenant") {
    if (showAllSchoolsLink) {
      links.push({ href: "/reports", label: t("nav.allSchools"), Icon: Building2 });
    }
    links.push({ href: "/dashboard", label: t("nav.dashboard"), Icon: LayoutDashboard });
  }
  if (mode === "class" && tenantId) {
    if (showAllSchoolsLink) {
      links.push({ href: "/reports", label: t("nav.allSchools"), Icon: Building2 });
    }
    links.push({ href: "/dashboard", label: t("nav.dashboard"), Icon: LayoutDashboard });
  }
  if (mode === "report" && tenantId && classId) {
    links.push({
      href: `/reports/${tenantId}/classes/${classId}`,
      label: t("nav.class"),
      Icon: BookMarked,
    });
    if (showAllSchoolsLink) {
      links.push({ href: "/reports", label: t("nav.allSchools"), Icon: Building2 });
    }
    links.push({ href: "/dashboard", label: t("nav.dashboard"), Icon: LayoutDashboard });
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
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-950 hover:underline"
            >
              <l.Icon className={ICON_INLINE} aria-hidden />
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
