"use client";

import { Building2, GraduationCap, Library } from "lucide-react";
import Link from "next/link";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_SECTION } from "@/components/ui/iconSizes";
import { ReportsFlowHeader } from "@/components/layout/ReportsFlowHeader";
import type { MembershipWithTenant, RomRole } from "@/lib/data/memberships";

type Props = {
  memberships: MembershipWithTenant[];
  loadError: string | null;
};

function roleLabel(role: RomRole, t: (k: string) => string): string {
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

export function ReportsIndexView({ memberships, loadError }: Props) {
  const { t } = useUiLanguage();

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950">
      <ReportsFlowHeader mode="index" title={t("reports.title")} />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <p className="flex items-center gap-2 text-sm text-zinc-600">
          <GraduationCap className={ICON_SECTION} aria-hidden />
          {t("reports.hint")}
        </p>
        {loadError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{loadError}</p>
        ) : null}
        <ul className="mt-4 space-y-2">
          {memberships.map((m) => (
            <li key={m.tenantId}>
              <Link
                href={`/reports/${m.tenantId}`}
                className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-sm hover:border-emerald-400"
              >
                <Building2 className={`${ICON_SECTION} text-emerald-800`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900">{m.tenantName}</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50/80 px-2 py-0.5 text-xs text-zinc-600">
                      <Library className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {t("nav.classesLanguage")}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">{roleLabel(m.role, t)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {memberships.length === 0 ? <p className="mt-4 text-sm text-amber-800">{t("reports.notLinked")}</p> : null}
      </main>
    </div>
  );
}
