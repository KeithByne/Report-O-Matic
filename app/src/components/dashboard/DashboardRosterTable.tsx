"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { canEditMemberDisplayName, canRemoveMember } from "@/lib/auth/memberDeletePolicy";
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
  /** Optimistic DH / teacher role while PATCH is in flight; cleared when roster list changes. */
  const [roleEdits, setRoleEdits] = useState<Record<string, "department_head" | "teacher">>({});
  const [editingNameForEmail, setEditingNameForEmail] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState<{ first: string; last: string }>({ first: "", last: "" });
  const rosterVersion = useMemo(
    () => roster.map((r) => `${r.user_email}:${r.role}:${r.first_name ?? ""}:${r.last_name ?? ""}`).join("|"),
    [roster],
  );
  useEffect(() => {
    setRoleEdits({});
    setEditingNameForEmail(null);
  }, [rosterVersion]);

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
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  function startEditName(row: TenantMemberRow) {
    const em = row.user_email.trim().toLowerCase();
    setEditingNameForEmail(em);
    setNameDraft({
      first: (row.first_name ?? "").trim(),
      last: (row.last_name ?? "").trim(),
    });
  }

  async function saveMemberName(rawEmail: string) {
    setBusy(rawEmail);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/members`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_email: rawEmail,
          first_name: nameDraft.first,
          last_name: nameDraft.last,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setEditingNameForEmail(null);
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function updateMemberRole(email: string, nextRole: "department_head" | "teacher") {
    const norm = email.trim().toLowerCase();
    setRoleEdits((prev) => ({ ...prev, [norm]: nextRole }));
    setBusy(email);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/members`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_email: email, role: nextRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      router.refresh();
    } catch (e: unknown) {
      setRoleEdits((prev) => {
        const next = { ...prev };
        delete next[norm];
        return next;
      });
      alert(e instanceof Error ? e.message : t("common.failed"));
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
          const targetIsViewer = email === viewerEmail.trim().toLowerCase();
          const canEditName = canEditMemberDisplayName(viewerRole, row.role, targetIsViewer);
          const isEditingName = editingNameForEmail === email;
          const displayDhTeacherRole = roleEdits[email] ?? row.role;
          const stats =
            displayDhTeacherRole === "teacher" ? statsByTeacher.get(email) : undefined;
          return (
            <tr key={`${row.user_email}-${row.role}`} className="border-b border-emerald-50">
              <td className="py-1.5 pr-3 text-xs text-zinc-800">
                {isEditingName ? (
                  <div className="flex max-w-[14rem] flex-col gap-1.5">
                    <input
                      type="text"
                      value={nameDraft.first}
                      onChange={(e) => setNameDraft((d) => ({ ...d, first: e.target.value }))}
                      className="w-full rounded-md border border-emerald-200 px-2 py-1 text-xs text-zinc-900 shadow-sm"
                      placeholder={t("invite.firstNamePlaceholder")}
                      aria-label={t("invite.firstName")}
                    />
                    <input
                      type="text"
                      value={nameDraft.last}
                      onChange={(e) => setNameDraft((d) => ({ ...d, last: e.target.value }))}
                      className="w-full rounded-md border border-emerald-200 px-2 py-1 text-xs text-zinc-900 shadow-sm"
                      placeholder={t("invite.lastNamePlaceholder")}
                      aria-label={t("invite.lastName")}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void saveMemberName(row.user_email)}
                        className="rounded-md bg-emerald-800 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-900 disabled:opacity-50"
                      >
                        {t("roster.saveDisplayName")}
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => setEditingNameForEmail(null)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {t("roster.cancelNameEdit")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="font-medium">{fullName(row)}</div>
                    <div className="break-all font-mono text-[11px] text-zinc-500">{row.user_email}</div>
                    {canEditName ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => startEditName(row)}
                        className="mt-1 text-[11px] font-medium text-emerald-800 hover:underline disabled:opacity-50"
                      >
                        {t("roster.editDisplayName")}
                      </button>
                    ) : null}
                  </>
                )}
              </td>
              <td className="py-1.5 pr-3 text-xs text-zinc-700">
                {viewerRole === "owner" && (row.role === "department_head" || row.role === "teacher") ? (
                  <select
                    className="max-w-[13rem] rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-zinc-800 shadow-sm disabled:opacity-60"
                    value={displayDhTeacherRole === "teacher" ? "teacher" : "department_head"}
                    disabled={busy !== null}
                    aria-label={t("roster.roleSelectAria", { name: fullName(row) })}
                    onChange={(e) => {
                      const v = e.target.value;
                      if ((v === "department_head" || v === "teacher") && v !== (roleEdits[email] ?? row.role))
                        void updateMemberRole(row.user_email, v);
                    }}
                  >
                    <option value="department_head">{t("dash.role.department_head")}</option>
                    <option value="teacher">{t("dash.role.teacher")}</option>
                  </select>
                ) : (
                  memberRoleLabel(row.role)
                )}
              </td>
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
