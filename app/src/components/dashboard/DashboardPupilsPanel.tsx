"use client";

import { Loader2, RotateCcw, Search, Trash2, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import type { SchoolStudentWithClasses } from "@/lib/data/schoolStudents";

type StatusFilter = "all" | "active" | "inactive";

type Props = {
  tenantId: string;
  onRosterChanged?: () => void;
  /** When set, Place enrolls into this class only (class workspace). */
  placeIntoClassId?: string;
  placeIntoClassName?: string;
  /** Hide pupils already enrolled in placeIntoClassId. */
  excludeClassId?: string;
  /** Called after a successful place into placeIntoClassId. */
  onPlacedIntoClass?: (studentId: string | null) => void;
  compact?: boolean;
};

export function DashboardPupilsPanel({
  tenantId,
  onRosterChanged,
  placeIntoClassId,
  placeIntoClassName,
  excludeClassId,
  onPlacedIntoClass,
  compact = false,
}: Props) {
  const { t } = useUiLanguage();
  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<SchoolStudentWithClasses[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [locateClassByStudent, setLocateClassByStudent] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  const classScoped = Boolean(placeIntoClassId);

  useEffect(() => {
    if (classScoped) return;
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
  }, [base, classScoped]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${base}/school-students?status=all`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setRows((data.students ?? []) as SchoolStudentWithClasses[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.failed"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [base, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const exclude = excludeClassId?.trim() || placeIntoClassId?.trim() || "";
    return rows
      .filter((row) => {
        if (statusFilter !== "all" && row.status !== statusFilter) return false;
        if (exclude && row.class_ids.includes(exclude)) return false;
        if (!q) return true;
        const hay =
          `${row.display_name} ${row.first_name} ${row.last_name} ${row.class_names.join(" ")} ${row.last_class_name ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 80);
  }, [rows, query, statusFilter, excludeClassId, placeIntoClassId]);

  async function addToRoster(e: React.FormEvent) {
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
      const created = data.student as SchoolStudentWithClasses | undefined;
      if (created?.display_name) {
        setQuery(created.display_name);
        setStatusFilter("active");
      }
      await refresh();
      onRosterChanged?.();
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
      onRosterChanged?.();
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
      const res = await fetch(`${base}/school-students/${encodeURIComponent(id)}/reactivate`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      await refresh();
      onRosterChanged?.();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function placeInClass(
    schoolStudentId: string,
    opts?: { classIdOverride?: string; studentId?: string | null },
  ) {
    const classId = (opts?.classIdOverride || locateClassByStudent[schoolStudentId] || placeIntoClassId || "").trim();
    if (!classId) return;
    setBusy(`loc-${schoolStudentId}`);
    setErr(null);
    try {
      if (classScoped && placeIntoClassId) {
        const studentId = opts?.studentId?.trim() || "";
        if (studentId) {
          const who = rows.find((r) => r.id === schoolStudentId)?.display_name ?? "";
          if (
            !confirm(
              t("class.placePupilConfirmMove", {
                who,
                to: placeIntoClassName?.trim() || "—",
              }),
            )
          ) {
            setBusy(null);
            return;
          }
        }
        const res = await fetch(`${base}/students/import`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            class_id: placeIntoClassId,
            ...(studentId
              ? { student_id: studentId }
              : { school_student_id: schoolStudentId }),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || t("common.failed"));
        const placedId = typeof data.student?.id === "string" ? data.student.id : null;
        await refresh();
        onRosterChanged?.();
        onPlacedIntoClass?.(placedId);
        return;
      }

      const res = await fetch(`${base}/school-students/${encodeURIComponent(schoolStudentId)}/enrollments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ class_id: classId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      await refresh();
      onRosterChanged?.();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  const filterChip = (id: StatusFilter, label: string) => {
    const active = statusFilter === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={active}
        onClick={() => setStatusFilter(id)}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
          active
            ? "border-emerald-600 bg-emerald-100 text-emerald-950"
            : "border-emerald-200 bg-white text-zinc-700 hover:bg-emerald-50"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <section
      id={compact ? undefined : "dash-workspace-panel-pupils"}
      className={
        compact
          ? "rounded-xl border border-emerald-100 bg-white p-4"
          : "rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"
      }
      aria-labelledby="dash-pupils-title"
    >
      <h2 id="dash-pupils-title" className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <Users className={ICON_INLINE} aria-hidden />
        {classScoped ? t("class.studentsActionPlace") : t("dash.panelPupils")}
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        {classScoped
          ? t("class.placePupilHint", { className: placeIntoClassName?.trim() || "—" })
          : t("dash.pupilsHint")}
      </p>

      {err ? (
        <p className="mt-3 text-sm text-red-800" role="alert">
          {err}
        </p>
      ) : null}

      {!classScoped ? (
        <form onSubmit={addToRoster} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
              {busy === "add" ? (
                <Loader2 className={`${ICON_INLINE} animate-spin`} aria-hidden />
              ) : (
                <UserPlus className={ICON_INLINE} aria-hidden />
              )}
              {t("dash.activeStudentsAdd")}
            </button>
          </div>
        </form>
      ) : null}

      <div className={`flex flex-wrap items-center gap-2 ${classScoped ? "mt-4" : "mt-4"}`}>
        {filterChip("all", t("dash.pupilsFilterAll"))}
        {filterChip("active", t("dash.findStudentStatusActive"))}
        {filterChip("inactive", t("dash.findStudentStatusInactive"))}
      </div>

      <label className="mt-3 block min-w-0 text-sm">
        <span className="mb-1 block text-zinc-600">{t("dash.findStudentSearchLabel")}</span>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="block w-full rounded-lg border border-emerald-200 bg-white py-2 pl-9 pr-3 text-sm"
            placeholder={t("dash.findStudentSearchPlaceholder")}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </label>

      {loading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className={`${ICON_INLINE} animate-spin`} aria-hidden />
          …
        </p>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">
          {query.trim() ? t("dash.findStudentEmpty") : t("dash.pupilsEmptyFilter")}
        </p>
      ) : (
        <div className="mt-4 max-h-[min(70vh,42rem)] overflow-y-auto overscroll-y-contain rounded-xl border border-emerald-100">
          <ul className="divide-y divide-emerald-100">
            {visible.map((row) => {
              const isInactive = row.status === "inactive";
              const classLine =
                row.class_names.length > 0
                  ? t("dash.findStudentClasses", { classes: row.class_names.join(", ") })
                  : isInactive && row.last_class_name
                    ? t("dash.findStudentLastClass", { className: row.last_class_name })
                    : isInactive
                      ? t("dash.findStudentNoLastClass")
                      : t("dash.activeStudentsNoClasses");
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-zinc-900">{row.display_name}</p>
                      {isInactive ? (
                        <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                          {t("dash.findStudentStatusInactive")}
                        </span>
                      ) : (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
                          {t("dash.findStudentStatusActive")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">{classLine}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!classScoped && row.class_ids.length > 0
                      ? row.class_ids.map((classId, i) => (
                          <Link
                            key={`${row.id}-${classId}`}
                            href={`/reports/${encodeURIComponent(tenantId)}/classes/${encodeURIComponent(classId)}?panel=students`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-100"
                          >
                            <Users className="h-3.5 w-3.5" aria-hidden />
                            {row.class_names[i] || t("dash.findStudentOpenClass")}
                          </Link>
                        ))
                      : null}
                    {classScoped && placeIntoClassId ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          void placeInClass(row.id, {
                            classIdOverride: placeIntoClassId,
                            studentId: row.enrollment_ids[0] ?? null,
                          })
                        }
                        className="rounded-lg border border-emerald-300 bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                      >
                        {t("class.placePupilButton")}
                      </button>
                    ) : !isInactive ? (
                      <>
                        <select
                          value={locateClassByStudent[row.id] ?? ""}
                          onChange={(e) =>
                            setLocateClassByStudent((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                          className="max-w-[12rem] rounded-lg border border-emerald-200 px-2 py-1.5 text-xs"
                          aria-label={t("dash.pupilsPlaceClass")}
                        >
                          <option value="">{t("dash.pupilsPlaceClass")}</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy !== null || !locateClassByStudent[row.id]}
                          onClick={() => void placeInClass(row.id)}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {t("dash.pupilsPlaceButton")}
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
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/** @deprecated Prefer {@link DashboardPupilsPanel} */
export { DashboardPupilsPanel as DashboardFindStudentPanel };
