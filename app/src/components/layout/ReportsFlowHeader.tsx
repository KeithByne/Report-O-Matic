"use client";

import { Building2, LayoutDashboard, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { AppHeaderLeftCluster } from "@/components/layout/AppHeaderLeftCluster";
import { AppHeaderRightControls } from "@/components/layout/AppHeaderRightControls";
import { HEADER_CONTROL_BLOCK_INTERACTIVE } from "@/components/layout/headerControlStyles";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import type { RomRole } from "@/lib/data/memberships";

type Mode = "index" | "tenant" | "class" | "report";

type Props = {
  mode: Mode;
  /** Shown under brand; usually school name or reports hub title */
  title: string;
  tenantId?: string;
  classId?: string;
  /** Passed to support messenger for school context on messages. */
  supportTenantId?: string;
  /** Multi-school hub at /reports — owners only; hide for department heads and teachers. */
  showAllSchoolsLink?: boolean;
  /** Display name from profile (not email). */
  userDisplayName: string;
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
  supportTenantId,
  showAllSchoolsLink,
  userDisplayName,
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
  if (mode === "report") {
    links.push({ href: "/dashboard", label: t("nav.dashboard"), Icon: LayoutDashboard });
  }

  return (
    <header className="rom-app-shell-header">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
        <AppHeaderLeftCluster roleLabel={roleLine} userDisplayName={userDisplayName} pageTitle={title} />
        <AppHeaderRightControls tenantId={supportTenantId ?? tenantId ?? null}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`${HEADER_CONTROL_BLOCK_INTERACTIVE} !w-auto min-w-[6.5rem] flex-row gap-2 px-3 text-sm font-medium whitespace-nowrap`}
            >
              <l.Icon className={ICON_INLINE} aria-hidden />
              {l.label}
            </Link>
          ))}
        </AppHeaderRightControls>
      </div>
    </header>
  );
}
