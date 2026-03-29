"use client";

import Link from "next/link";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
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
        <p className="text-sm text-zinc-600">{t("reports.hint")}</p>
        {loadError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{loadError}</p>
        ) : null}
        <ul className="mt-4 space-y-2">
          {memberships.map((m) => (
            <li key={m.tenantId}>
              <Link
                href={`/reports/${m.tenantId}`}
                className="block rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-sm hover:border-emerald-400"
              >
                <span className="font-medium text-zinc-900">{m.tenantName}</span>
                <span className="ml-2 text-xs text-zinc-500">{roleLabel(m.role, t)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {memberships.length === 0 ? <p className="mt-4 text-sm text-amber-800">{t("reports.notLinked")}</p> : null}
      </main>
    </div>
  );
}
