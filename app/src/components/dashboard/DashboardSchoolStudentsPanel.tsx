"use client";

import { Loader2, RotateCcw, Trash2, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import type { SchoolStudentStatus, SchoolStudentWithClasses } from "@/lib/data/schoolStudents";

type Props = {
  tenantId: string;
  status: SchoolStudentStatus;
};

export function DashboardSchoolStudentsPanel({ tenantId, status }: Props) {
  const { t } = useUiLanguage();
  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;
  const [rows, setRows] = useState<SchoolStudentWithClasses[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [locateClassByStudent, setLocateClassByStudent] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  const isActive = status === "active";

  useEffect(() => {
    if (!isActive) return;
    void (async () => {
      try {
        const res = await fetch(`${base}/classes`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const list = (data.classes ?? []) as { id: string; name: string }[];
        setClasses(list.map((c) => ({ id: c.id, name: c.name })));
      } catch {
        setClasses([]);
      }
    })();
  }, [base, isActive]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${base}/school-students?status=${status}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setRows((data.students ?? []) as SchoolStudentWithClasses[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.failed"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [base, status, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addToActiveList(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    setErr(null);
    try {
      const res = await fetch(`${base}/school-students`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          gender: gender || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setFirstName("");
      setLastName("");
      setGender("");
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function removeFromActive(id: string, name: string) {
    if (!confirm(t("dash.activeStudentsConfirmRemove", { name }))) return;
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`${base}/school-students/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function reactivate(id: string) {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`${base}/school-students/${encodeURIComponent(id)}/reactivate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function locateInClass(schoolStudentId: string) {
    const classId = locateClassByStudent[schoolStudentId]?.trim();
    if (!classId) return;
    setBusy(`loc-${schoolStudentId}`);
    setErr(null);
    try {
      const res = await fetch(`${base}/school-students/${encodeURIComponent(schoolStudentId)}/enrollments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ class_id: classId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <Users className={ICON_INLINE} aria-hidden />
        {isActive ? t("dash.panelActiveStudents") : t("dash.panelInactiveStudents")}
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        {isActive ? t("dash.activeStudentsHint") : t("dash.inactiveStudentsHint")}
      </p>

      {err ? (
        <p className="mt-3 text-sm text-red-800" role="alert">
          {err}
        </p>
      ) : null}

      {isActive ? (
        <form onSubmit={addToActiveList} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-sm sm:col-span-1">
            <span className="mb-1 block text-zinc-600">{t("class.firstName")}</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="block w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm sm:col-span-1">
            <span className="mb-1 block text-zinc-600">{t("class.lastName")}</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="block w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm sm:col-span-1">
            <span className="mb-1 block text-zinc-600">{t("class.genderOptional")}</span>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="block w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="male">{t("class.genderMale")}</option>
              <option value="female">{t("class.genderFemale")}</option>
              <option value="non_binary">{t("class.genderNonBinaryOpt")}</option>
            </select>
          </label>
          <div className="flex items-end sm:col-span-2">
            <button
              type="submit"
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-50"
            >
              {busy === "add" ? <Loader2 className={`${ICON_INLINE} animate-spin`} aria-hidden /> : <UserPlus className={ICON_INLINE} aria-hidden />}
              {t("dash.activeStudentsAdd")}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-zinc-500">…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">
          {isActive ? t("dash.activeStudentsEmpty") : t("dash.inactiveStudentsEmpty")}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-emerald-100 rounded-xl border border-emerald-100">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-zinc-900">{row.display_name}</p>
                {row.class_names.length > 0 ? (
                  <p className="mt-1 text-xs text-zinc-600">
                    {t("dash.activeStudentsClasses")}: {row.class_names.join(", ")}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-500">{t("dash.activeStudentsNoClasses")}</p>
                )}
                {!isActive && row.inactivated_at ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("dash.inactiveStudentsArchivedAt", {
                      date: new Date(row.inactivated_at).toLocaleDateString(),
                    })}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isActive ? (
                  <>
                    <select
                      value={locateClassByStudent[row.id] ?? ""}
                      onChange={(e) =>
                        setLocateClassByStudent((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                      className="max-w-[12rem] rounded-lg border border-emerald-200 px-2 py-1.5 text-xs"
                      aria-label={t("dash.activeStudentsLocateClass")}
                    >
                      <option value="">{t("dash.activeStudentsLocateClass")}</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy !== null || !locateClassByStudent[row.id]}
                      onClick={() => void locateInClass(row.id)}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {t("dash.activeStudentsLocateButton")}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void removeFromActive(row.id, row.display_name)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className={`${ICON_INLINE} h-3.5 w-3.5`} aria-hidden />
                      {t("dash.activeStudentsRemove")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void reactivate(row.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                  >
                    <RotateCcw className={`${ICON_INLINE} h-3.5 w-3.5`} aria-hidden />
                    {t("dash.inactiveStudentsReactivate")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
