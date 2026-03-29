"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AddSchoolForm } from "@/components/dashboard/AddSchoolForm";
import { DashboardRosterTable } from "@/components/dashboard/DashboardRosterTable";
import { DashboardTenantLanguage } from "@/components/dashboard/DashboardTenantLanguage";
import { DashboardTenantPdfLetterhead } from "@/components/dashboard/DashboardTenantPdfLetterhead";
import { DeleteSchoolButton } from "@/components/dashboard/DeleteSchoolButton";
import { InviteTeamForm } from "@/components/dashboard/InviteTeamForm";
import { GlobeLanguageSwitcher } from "@/components/i18n/GlobeLanguageSwitcher";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import type { MembershipWithTenant, RomRole, TenantMemberRow } from "@/lib/data/memberships";
import { isReportLanguageCode, UI_LOCALE_BCP47, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";

export type DashboardClientViewProps = {
  email: string;
  sessionExpMs: number;
  loadError: string | null;
  memberships: MembershipWithTenant[];
  rosterByTenant: Record<string, TenantMemberRow[]>;
};

function formatSessionEnds(expMs: number, locale: string): string {
  return new Date(expMs).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function DashboardClientView({
  email,
  sessionExpMs,
  loadError,
  memberships,
  rosterByTenant,
}: DashboardClientViewProps) {
  const { lang, t } = useUiLanguage();
  const locale = UI_LOCALE_BCP47[lang];

  const [reportLangByTenant, setReportLangByTenant] = useState<Record<string, ReportLanguageCode>>({});

  const refreshReportLangs = useCallback(async () => {
    if (memberships.length === 0) {
      setReportLangByTenant({});
      return;
    }
    const next: Record<string, ReportLanguageCode> = {};
    await Promise.all(
      memberships.map(async (m) => {
        const res = await fetch(`/api/tenants/${encodeURIComponent(m.tenantId)}/settings`);
        const data = await res.json().catch(() => ({}));
        const raw = typeof data.default_report_language === "string" ? data.default_report_language.trim() : "";
        next[m.tenantId] = res.ok && isReportLanguageCode(raw) ? raw : "en";
      }),
    );
    setReportLangByTenant(next);
  }, [memberships]);

  useEffect(() => {
    void refreshReportLangs();
  }, [refreshReportLangs]);

  const hoursLabel = useMemo(() => {
    const h = Math.floor((sessionExpMs - Date.now()) / (60 * 60 * 1000));
    if (h <= 0) return t("dash.lessThanHour");
    if (h === 1) return t("dash.aboutOneHour");
    return t("dash.aboutHours", { n: h });
  }, [sessionExpMs, t]);

  const hasOwner = memberships.some((m) => m.role === "owner");
  const hasDeptHead = memberships.some((m) => m.role === "department_head");
  const hasTeacherOnly = memberships.length > 0 && memberships.every((m) => m.role === "teacher");

  function roleLabel(role: RomRole): string {
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

  function roleDescription(role: RomRole): string {
    switch (role) {
      case "owner":
        return t("dash.roleDesc.owner");
      case "department_head":
        return t("dash.roleDesc.department_head");
      case "teacher":
        return t("dash.roleDesc.teacher");
      default:
        return "";
    }
  }

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950">
      <header className="border-b border-emerald-200/80 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("brand.subtitle")}</p>
            <h1 className="text-lg font-semibold tracking-tight">{t("dash.title")}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GlobeLanguageSwitcher />
            <Link
              href="/reports"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
            >
              {t("nav.reports")}
            </Link>
            <form action="/api/auth/sign-out" method="post">
              <button
                type="submit"
                className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-emerald-50/60"
              >
                {t("nav.signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-5 py-8">
        <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-500">{t("dash.signedInAs")}</h2>
          <p className="mt-1 break-all font-mono text-sm text-zinc-900">{email}</p>
          <p className="mt-3 text-sm text-zinc-600">
            {t("dash.sessionEnds")}{" "}
            <span className="font-medium text-zinc-800">{formatSessionEnds(sessionExpMs, locale)}</span>
            <span className="text-zinc-500">
              {" "}
              ({hoursLabel} {t("dash.left")})
            </span>
          </p>
        </section>

        {loadError ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            <p className="font-medium">{t("dash.loadOrgsError")}</p>
            <p className="mt-2 font-mono text-xs">{loadError}</p>
          </section>
        ) : memberships.length === 0 ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-sm text-emerald-950">
            <p className="font-medium">{t("dash.noSchoolTitle")}</p>
            <p className="mt-2 text-emerald-900/90">{t("dash.noSchoolBody")}</p>
          </section>
        ) : (
          <>
            {hasOwner ? (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-emerald-950">{t("dash.ownerBlurbTitle")}</h2>
                <p className="mt-2 text-sm text-emerald-900/90">{t("dash.ownerBlurbBody")}</p>
              </section>
            ) : null}
            {hasDeptHead && !hasOwner ? (
              <section className="rounded-2xl border border-teal-200 bg-teal-50/80 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-teal-950">{t("dash.dhBlurbTitle")}</h2>
                <p className="mt-2 text-sm text-teal-900/90">{t("dash.dhBlurbBody")}</p>
              </section>
            ) : null}
            {hasTeacherOnly ? (
              <section className="rounded-2xl border border-green-200 bg-green-50/80 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-green-950">{t("dash.teacherBlurbTitle")}</h2>
                <p className="mt-2 text-sm text-green-900/90">{t("dash.teacherBlurbBody")}</p>
              </section>
            ) : null}

            {hasOwner ? <AddSchoolForm /> : null}

            <DashboardTenantLanguage
              tenants={memberships.map((m) => ({
                tenantId: m.tenantId,
                tenantName: m.tenantName,
                canEditSettings: m.role === "owner" || m.role === "department_head",
              }))}
              langs={reportLangByTenant}
              onLanguageSaved={(tenantId, code) =>
                setReportLangByTenant((prev) => ({ ...prev, [tenantId]: code }))
              }
            />

            {hasOwner ? (
              <DashboardTenantPdfLetterhead
                tenants={memberships.filter((m) => m.role === "owner").map((m) => ({ tenantId: m.tenantId, tenantName: m.tenantName }))}
                reportLangByTenant={reportLangByTenant}
              />
            ) : null}

            <section>
              <h2 className="text-sm font-semibold text-zinc-900">{t("dash.yourSchools")}</h2>
              <p className="mt-1 text-sm text-zinc-600">{t("dash.yourSchoolsHint")}</p>
              <ul className="mt-4 space-y-3">
                {memberships.map((m) => {
                  const roster = rosterByTenant[m.tenantId] ?? [];
                  const showRoster = m.role === "owner" || m.role === "department_head";
                  return (
                    <li key={m.membershipId} className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-semibold text-zinc-900">{m.tenantName}</div>
                          <div className="mt-0.5 text-xs text-zinc-500">{roleDescription(m.role)}</div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1 text-xs font-semibold text-zinc-800">
                            {roleLabel(m.role)}
                          </span>
                          <Link
                            href={`/reports/${m.tenantId}`}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                          >
                            {t("dash.reportsClasses")}
                          </Link>
                        </div>
                      </div>
                      {showRoster && roster.length > 0 ? (
                        <div className="mt-4 border-t border-emerald-100 pt-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            {t("dash.teamRoster")}
                          </h3>
                          <div className="mt-2 overflow-x-auto">
                            <DashboardRosterTable
                              tenantId={m.tenantId}
                              viewerRole={m.role}
                              viewerEmail={email}
                              roster={roster}
                            />
                          </div>
                        </div>
                      ) : null}
                      {m.role === "owner" ? <DeleteSchoolButton tenantId={m.tenantId} schoolName={m.tenantName} /> : null}
                    </li>
                  );
                })}
              </ul>
            </section>

            {memberships.some((m) => m.role === "owner" || m.role === "department_head") ? (
              <section className="space-y-4">
                <h2 className="text-sm font-semibold text-zinc-900">{t("dash.inviteTeam")}</h2>
                <p className="text-sm text-zinc-600">{t("dash.inviteTeamHint")}</p>
                {memberships
                  .filter((m) => m.role === "owner")
                  .map((m) => (
                    <InviteTeamForm
                      key={`owner-${m.tenantId}`}
                      variant="owner"
                      tenantId={m.tenantId}
                      schoolName={m.tenantName}
                    />
                  ))}
                {memberships
                  .filter((m) => m.role === "department_head")
                  .map((m) => (
                    <InviteTeamForm
                      key={`dh-${m.tenantId}`}
                      variant="department_head"
                      tenantId={m.tenantId}
                      schoolName={m.tenantName}
                    />
                  ))}
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
