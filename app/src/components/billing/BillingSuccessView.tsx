"use client";

import Link from "next/link";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { AppHeaderLeftCluster } from "@/components/layout/AppHeaderLeftCluster";
import { AppHeaderRightControls } from "@/components/layout/AppHeaderRightControls";
import type { RomRole } from "@/lib/data/memberships";

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

export function BillingSuccessView({
  tenantId,
  schoolName,
  userDisplayName,
  viewerRole,
}: {
  tenantId: string;
  schoolName: string;
  userDisplayName: string;
  viewerRole: RomRole;
}) {
  const { t } = useUiLanguage();

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950">
      <header className="rom-app-shell-header">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
          <AppHeaderLeftCluster
            roleLabel={roleLabel(viewerRole, t)}
            userDisplayName={userDisplayName}
            pageTitle={t("billing.successTitle")}
          />
          <AppHeaderRightControls tenantId={tenantId} />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-12">
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-600">{t("billing.successBody")}</p>
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
