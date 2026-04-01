"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { canRemoveMember } from "@/lib/auth/memberDeletePolicy";
import type { RomRole, TenantMemberRow } from "@/lib/data/memberships";
import type { TeacherStats } from "@/lib/data/tenantDashboardStats";

type Props = {
  tenantId: string;
  viewerRole: RomRole;
  viewerEmail: string;
  roster: TenantMemberRow[];
  teacherStats: TeacherStats[];
};

function fullName(row: TenantMemberRow): string {
  const fn = (row.first_name ?? "").trim();
  const ln = (row.last_name ?? "").trim();
  const both = `${fn} ${ln}`.trim();
  return both || row.user_email;
}

export function DashboardRosterTable({ tenantId, viewerRole, viewerEmail, roster, teacherStats }: Props) {
  const { t } = useUiLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const statsByTeacher = new Map(teacherStats.map((s) => [s.email.trim().toLowerCase(), s] as const));

  function memberRoleLabel(role: RomRole): string {
    switch (role) {
      case "owner":
        return t("roster.roleOwner");
      case "department_head":
        return t("roster.roleDeptShort");
      case "teacher":
        return t("roster.roleTeacher");
      default:
        return role;
    }
  }

  async function removeMember(email: string) {
    if (!confirm(t("roster.confirmRemove", { email }))) return;
    setBusy(email);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/members`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_email: email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <table className="w-full min-w-[320px] text-left text-sm">
      <thead>
        <tr className="border-b border-emerald-100 text-xs text-zinc-500">
          <th className="py-1.5 pr-3 font-medium">{t("roster.thEmail")}</th>
          <th className="py-1.5 pr-3 font-medium">{t("roster.thRole")}</th>
          <th className="py-1.5 pr-3 font-medium">{t("roster.thClasses")}</th>
          <th className="py-1.5 pr-3 font-medium">{t("roster.thStudents")}</th>
          <th className="py-1.5 pr-3 font-medium">{t("roster.thReportsTerms")}</th>
          <th className="py-1.5 pr-3 font-medium">{t("roster.thStudentsMove")}</th>
          <th className="py-1.5 w-24 font-medium">{t("roster.thActions")}</th>
        </tr>
      </thead>
      <tbody>
        {roster.map((row) => {
          const canRemove =
            canRemoveMember(viewerRole, row.role) && row.user_email.trim().toLowerCase() !== viewerEmail.trim().toLowerCase();
          const email = row.user_email.trim().toLowerCase();
          const stats = row.role === "teacher" ? statsByTeacher.get(email) : undefined;
          return (
            <tr key={`${row.user_email}-${row.role}`} className="border-b border-emerald-50">
              <td className="py-1.5 pr-3 text-xs text-zinc-800">
                <div className="font-medium">{fullName(row)}</div>
                <div className="break-all font-mono text-[11px] text-zinc-500">{row.user_email}</div>
              </td>
              <td className="py-1.5 pr-3 text-xs text-zinc-700">{memberRoleLabel(row.role)}</td>
              <td className="py-1.5 pr-3 text-xs text-zinc-700">{stats ? stats.classes : "—"}</td>
              <td className="py-1.5 pr-3 text-xs text-zinc-700">{stats ? stats.students : "—"}</td>
              <td className="py-1.5 pr-3 text-xs text-zinc-700">
                {stats ? `${stats.reportsByTerm.first}/${stats.reportsByTerm.second}/${stats.reportsByTerm.third}` : "—"}
              </td>
              <td className="py-1.5 pr-3 text-xs text-zinc-700">
                {stats ? `${stats.studentEvents.added}/${stats.studentEvents.deleted}/${stats.studentEvents.moved}` : "—"}
              </td>
              <td className="py-1.5">
                {canRemove ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void removeMember(row.user_email)}
                    className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                  >
                    {busy === row.user_email ? t("roster.removing") : t("roster.remove")}
                  </button>
                ) : (
                  <span className="text-xs text-zinc-400">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
