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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editGender, setEditGender] = useState("");
  const [relocateClassId, setRelocateClassId] = useState("");
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

  const selected = useMemo(
    () => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null),
    [rows, selectedId],
  );

  useEffect(() => {
    if (!selectedId) return;
    if (!visible.some((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [visible, selectedId]);

  useEffect(() => {
    if (!selected) {
      setEditFirst("");
      setEditLast("");
      setEditGender("");
      setRelocateClassId("");
      return;
    }
    setEditFirst(selected.first_name);
    setEditLast(selected.last_name);
    setEditGender(selected.gender ?? "");
    setRelocateClassId("");
  }, [selected]);

  function selectRow(row: SchoolStudentWithClasses) {
    setSelectedId((cur) => (cur === row.id ? null : row.id));
    setErr(null);
  }

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
      if (created?.id) {
        setQuery(created.display_name);
        setStatusFilter("active");
        setSelectedId(created.id);
      }
      await refresh();
      onRosterChanged?.();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function saveSelectedName(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy("edit");
    setErr(null);
    try {
      const res = await fetch(`${base}/school-students/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: editFirst.trim(),
          last_name: editLast.trim(),
          gender: editGender || null,
        }),
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

  async function removeFromActive(id: string, name: string) {
    if (!confirm(t("dash.activeStudentsConfirmRemove", { name }))) return;
    setBusy("remove");
    setErr(null);
    try {
      const res = await fetch(`${base}/school-students/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setSelectedId(null);
      await refresh();
      onRosterChanged?.();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function reactivate(id: string) {
    setBusy("reactivate");
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

  async function placeSelected() {
    if (!selected) return;
    const classId = (classScoped ? placeIntoClassId : relocateClassId)?.trim() || "";
    if (!classId) return;
    setBusy("place");
    setErr(null);
    try {
      if (classScoped && placeIntoClassId) {
        const studentId = selected.enrollment_ids[0]?.trim() || "";
        if (studentId) {
          if (
            !confirm(
              t("class.placePupilConfirmMove", {
                who: selected.display_name,
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
              : { school_student_id: selected.id }),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || t("common.failed"));
        const placedId = typeof data.student?.id === "string" ? data.student.id : null;
        setSelectedId(null);
        await refresh();
        onRosterChanged?.();
        onPlacedIntoClass?.(placedId);
        return;
      }

      const res = await fetch(
        `${base}/school-students/${encodeURIComponent(selected.id)}/enrollments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ class_id: classId }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setRelocateClassId("");
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

  const selectedActive = selected?.status === "active";
  const selectedInactive = selected?.status === "inactive";

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

      <div className="mt-4 space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {filterChip("all", t("dash.pupilsFilterAll"))}
          {filterChip("active", t("dash.findStudentStatusActive"))}
          {filterChip("inactive", t("dash.findStudentStatusInactive"))}
        </div>

        <label className="block min-w-0 text-sm">
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

        {!classScoped ? (
          <form
            onSubmit={addToRoster}
            className="grid gap-3 border-t border-emerald-100 pt-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600">{t("class.firstName")}</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600">{t("class.lastName")}</span>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600">{t("class.genderOptional")}</span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
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

        {selected ? (
          <div className="space-y-3 border-t border-emerald-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("dash.pupilsSelectedLabel", { name: selected.display_name })}
            </p>

            {!classScoped ? (
              <form
                onSubmit={saveSelectedName}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-600">{t("class.firstName")}</span>
                  <input
                    value={editFirst}
                    onChange={(e) => setEditFirst(e.target.value)}
                    required
                    className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-600">{t("class.lastName")}</span>
                  <input
                    value={editLast}
                    onChange={(e) => setEditLast(e.target.value)}
                    required
                    className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-600">{t("class.genderOptional")}</span>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
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
                    className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {busy === "edit" ? (
                      <Loader2 className={`${ICON_INLINE} animate-spin`} aria-hidden />
                    ) : (
                      t("class.savePupilEdits")
                    )}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="flex flex-wrap items-end gap-2">
              {classScoped && placeIntoClassId ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void placeSelected()}
                  className="rounded-lg border border-emerald-300 bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                >
                  {t("class.placePupilButton")}
                </button>
              ) : selectedActive ? (
                <>
                  <label className="block min-w-[12rem] flex-1 text-sm">
                    <span className="mb-1 block text-zinc-600">{t("dash.pupilsPlaceClass")}</span>
                    <select
                      value={relocateClassId}
                      onChange={(e) => setRelocateClassId(e.target.value)}
                      className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">{t("dash.pupilsPlaceClass")}</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={busy !== null || !relocateClassId}
                    onClick={() => void placeSelected()}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {t("dash.pupilsPlaceButton")}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void removeFromActive(selected.id, selected.display_name)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className={`${ICON_INLINE} h-3.5 w-3.5`} aria-hidden />
                    {t("dash.activeStudentsRemove")}
                  </button>
                </>
              ) : selectedInactive ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void reactivate(selected.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                >
                  <RotateCcw className={`${ICON_INLINE} h-3.5 w-3.5`} aria-hidden />
                  {t("dash.inactiveStudentsReactivate")}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="border-t border-emerald-100 pt-3 text-xs text-zinc-500">
            {t("dash.pupilsSelectHint")}
          </p>
        )}
      </div>

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
          <ul className="divide-y divide-emerald-100" role="listbox" aria-label={t("dash.panelPupils")}>
            {visible.map((row) => {
              const isInactive = row.status === "inactive";
              const isSelected = selectedId === row.id;
              const classLine =
                row.class_names.length > 0
                  ? t("dash.findStudentClasses", { classes: row.class_names.join(", ") })
                  : isInactive && row.last_class_name
                    ? t("dash.findStudentLastClass", { className: row.last_class_name })
                    : isInactive
                      ? t("dash.findStudentNoLastClass")
                      : t("dash.activeStudentsNoClasses");
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectRow(row)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? "bg-emerald-50 ring-2 ring-inset ring-emerald-400/60"
                        : "hover:bg-emerald-50/50"
                    }`}
                  >
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
                    <p className="text-xs text-zinc-600">{classLine}</p>
                    {!classScoped && row.class_ids.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {row.class_ids.map((classId, i) => (
                          <Link
                            key={`${row.id}-${classId}`}
                            href={`/reports/${encodeURIComponent(tenantId)}/classes/${encodeURIComponent(classId)}?panel=students`}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-950 hover:bg-emerald-50"
                          >
                            {row.class_names[i] || t("dash.findStudentOpenClass")}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </button>
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
