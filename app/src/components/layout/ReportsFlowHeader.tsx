"use client";

import { BookMarked, Building2, LayoutDashboard, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { GlobeLanguageSwitcher } from "@/components/i18n/GlobeLanguageSwitcher";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { AppHeaderLogo, AppHeaderWordmark } from "@/components/layout/AppHeaderBrand";
import { AppHeaderUserIdentity } from "@/components/layout/AppHeaderUserIdentity";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import type { RomRole } from "@/lib/data/memberships";

type Mode = "index" | "tenant" | "class" | "report";

type Props = {
  mode: Mode;
  /** Shown under brand; usually school name or reports hub title */
  title: string;
  tenantId?: string;
  classId?: string;
  /** Multi-school hub at /reports — owners only; hide for department heads and teachers. */
  showAllSchoolsLink?: boolean;
  /** Signed-in user (session email). */
  userEmail: string;
  /** Role in the current school context (tenant/class/report flows). */
  viewerRole?: RomRole | null;
  /** On /reports index, summarise roles across all school memberships. */
  membershipRoles?: RomRole[];
};

function roleLabelFor(t: (k: string) => string, role: RomRole): string {
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

export function ReportsFlowHeader({
  mode,
  title,
  tenantId,
  classId,
  showAllSchoolsLink,
  userEmail,
  viewerRole,
  membershipRoles,
}: Props) {
  const { t } = useUiLanguage();

  const roleLine = useMemo(() => {
    if (viewerRole) return roleLabelFor(t, viewerRole);
    const raw = membershipRoles ?? [];
    if (raw.length === 0) return "";
    const uniq = [...new Set(raw)];
    return uniq.map((r) => roleLabelFor(t, r)).join(" · ");
  }, [t, viewerRole, membershipRoles]);

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
      href: `/reports/${encodeURIComponent(tenantId)}/classes/${encodeURIComponent(classId)}?panel=overview`,
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
      <div className="mx-auto flex max-w-4xl flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <AppHeaderLogo />
          <div className="min-w-0">
            <AppHeaderWordmark />
            <h1 className="mt-2 text-lg font-semibold tracking-tight text-zinc-900">{title}</h1>
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:ml-auto sm:w-auto sm:max-w-[min(100%,24rem)] sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2 sm:justify-end">
            <AppHeaderUserIdentity email={userEmail} roleLabel={roleLine} />
            <GlobeLanguageSwitcher />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
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
      </div>
    </header>
  );
}
