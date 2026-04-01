"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeaderLogo, AppHeaderWordmark } from "@/components/layout/AppHeaderBrand";
import { GlobeLanguageSwitcher } from "@/components/i18n/GlobeLanguageSwitcher";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";

type TenantDetails = {
  tenant: { id: string; name: string; referral_code: string | null; referred_by_email: string | null; created_at: string };
  memberships: { user_email: string; role: string; first_name?: string | null; last_name?: string | null }[];
  counts: { classes: number; students: number; reports: number };
  classes: { id: string; name: string; assigned_teacher_email: string | null; scholastic_year: string | null; cefr_level: string | null; created_at: string }[];
  students: { id: string; display_name: string; class_id: string; created_at: string }[];
  reports: { id: string; student_id: string; author_email: string; status: string; title: string | null; updated_at: string; created_at: string }[];
};

function fullName(row: { user_email: string; first_name?: string | null; last_name?: string | null }): string {
  const fn = String(row.first_name ?? "").trim();
  const ln = String(row.last_name ?? "").trim();
  const both = `${fn} ${ln}`.trim();
  return both || row.user_email;
}

function groupByRole(rows: { user_email: string; role: string; first_name?: string | null; last_name?: string | null }[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of rows) {
    const role = String(r.role || "unknown");
    if (!out[role]) out[role] = [];
    out[role].push(fullName(r));
  }
  return out;
}

function memberRoleHeading(role: string, t: (key: string) => string): string {
  switch (role) {
    case "owner":
      return t("saas.roleOwner");
    case "department_head":
      return t("saas.roleDeptHead");
    case "teacher":
      return t("saas.roleTeacher");
    default:
      return role.replaceAll("_", " ");
  }
}

export function SaasOwnerTenantView({ tenantId, viewerEmail }: { tenantId: string; viewerEmail: string }) {
  const { t } = useUiLanguage();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<TenantDetails | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBusy(true);
      setErr(null);
      try {
        const res = await fetch(`/api/saas-owner/tenants/${encodeURIComponent(tenantId)}/details`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Failed");
        if (!cancelled) setData(json as TenantDetails);
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const byRole = useMemo(() => groupByRole(data?.memberships ?? []), [data?.memberships]);
  const memberLabelByEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of data?.memberships ?? []) {
      m.set(String(row.user_email || "").trim().toLowerCase(), fullName(row));
    }
    return m;
  }, [data?.memberships]);

  return (
    <div className="min-h-screen bg-emerald-100/80 text-zinc-950">
      <header className="border-b border-emerald-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-start gap-3">
            <AppHeaderLogo />
            <div>
              <AppHeaderWordmark />
              <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("saas.platformBadge")}</div>
              <div className="mt-1 text-lg font-semibold tracking-tight">{t("saas.schoolDetailsTitle")}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <GlobeLanguageSwitcher />
            <div className="text-xs text-zinc-500">
              {t("dash.signedInAs")} <span className="font-mono text-zinc-800">{viewerEmail}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-5 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/saas-owner" className="text-sm font-semibold text-emerald-800 hover:underline">
            {t("saas.backToOwner")}
          </Link>
          <div className="text-xs text-zinc-600 font-mono">{tenantId}</div>
        </div>

        {err ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{err}</div> : null}
        {busy && !data ? <div className="text-sm text-zinc-600">{t("dash.agentLoading")}</div> : null}

        {data ? (
          <>
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{data.tenant.name}</div>
                  <div className="mt-1 text-xs text-zinc-500">Created {new Date(data.tenant.created_at).toLocaleString()}</div>
                  <div className="mt-2 text-xs text-zinc-600">
                    Referral code: <span className="font-mono">{data.tenant.referral_code ?? "—"}</span> • Referred by:{" "}
                    <span className="font-mono">{data.tenant.referred_by_email ?? "—"}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t("roster.thClasses")}</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900">{data.counts.classes}</div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t("roster.thStudents")}</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900">{data.counts.students}</div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t("saas.thReports")}</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900">{data.counts.reports}</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`/api/tenants/${encodeURIComponent(tenantId)}/export`}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                >
                  {t("saas.exportExcel")}
                </a>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">{t("saas.membersTitle")}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {["owner", "department_head", "teacher"].map((role) => (
                  <div key={role} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{memberRoleHeading(role, t)}</div>
                    <div className="mt-2 space-y-1 text-xs text-zinc-800">
                      {(byRole[role] ?? []).length ? (
                        (byRole[role] ?? []).map((em) => (
                          <div key={em} className="font-mono">
                            {em}
                          </div>
                        ))
                      ) : (
                        <div className="text-zinc-500">—</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">{t("saas.classesFirst500")}</div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                      <th className="py-2 pr-3 font-medium">{t("saas.thName")}</th>
                      <th className="py-2 pr-3 font-medium">{t("saas.thTeacher")}</th>
                      <th className="py-2 pr-3 font-medium">{t("saas.thYear")}</th>
                      <th className="py-2 pr-3 font-medium">{t("saas.thCefr")}</th>
                      <th className="py-2 pr-3 font-medium">{t("saas.thId")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.classes.map((c) => (
                      <tr key={c.id} className="border-b border-zinc-100">
                        <td className="py-2 pr-3 font-medium text-zinc-900">{c.name}</td>
                        <td className="py-2 pr-3 text-xs">
                          {c.assigned_teacher_email ? (
                            <div className="space-y-0.5">
                              <div className="font-medium text-zinc-800">
                                {memberLabelByEmail.get(c.assigned_teacher_email.trim().toLowerCase()) ?? c.assigned_teacher_email}
                              </div>
                              <div className="font-mono text-[11px] text-zinc-500">{c.assigned_teacher_email}</div>
                            </div>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs">{c.scholastic_year ?? "—"}</td>
                        <td className="py-2 pr-3 text-xs">{c.cefr_level ?? "—"}</td>
                        <td className="py-2 pr-3 text-xs font-mono">{c.id}</td>
                      </tr>
                    ))}
                    {data.classes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-sm text-zinc-500">
                          —
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">{t("saas.studentsFirst200")}</div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                      <th className="py-2 pr-3 font-medium">{t("saas.thName")}</th>
                      <th className="py-2 pr-3 font-medium">{t("saas.thClassId")}</th>
                      <th className="py-2 pr-3 font-medium">{t("saas.thId")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s) => (
                      <tr key={s.id} className="border-b border-zinc-100">
                        <td className="py-2 pr-3 font-medium text-zinc-900">{s.display_name}</td>
                        <td className="py-2 pr-3 text-xs font-mono">{s.class_id}</td>
                        <td className="py-2 pr-3 text-xs font-mono">{s.id}</td>
                      </tr>
                    ))}
                    {data.students.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-sm text-zinc-500">
                          —
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">{t("saas.reportsRecent50")}</div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                      <th className="py-2 pr-3 font-medium">{t("saas.thUpdated")}</th>
                      <th className="py-2 pr-3 font-medium">{t("saas.statusLabel")}</th>
                      <th className="py-2 pr-3 font-medium">{t("saas.thReportAuthor")}</th>
                      <th className="py-2 pr-3 font-medium">{t("saas.thTitle")}</th>
                      <th className="py-2 pr-3 font-medium">{t("saas.thReportId")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reports.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-100">
                        <td className="py-2 pr-3 text-xs">{new Date(r.updated_at).toLocaleString()}</td>
                        <td className="py-2 pr-3 text-xs">{r.status}</td>
                        <td className="py-2 pr-3 text-xs font-mono">{r.author_email}</td>
                        <td className="py-2 pr-3 text-xs">{r.title ?? "—"}</td>
                        <td className="py-2 pr-3 text-xs font-mono">{r.id}</td>
                      </tr>
                    ))}
                    {data.reports.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-sm text-zinc-500">
                          —
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

