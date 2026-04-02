"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import type { RomRole } from "@/lib/data/memberships";
import { teacherHexColor } from "@/lib/timetable/teacherColor";

type Settings = { room_count: number; periods_am: number; periods_pm: number };

type SlotApi = {
  id: string;
  day_of_week: number;
  period_index: number;
  room_index: number;
  class_id: string;
  teacher_email: string;
  class_name: string | null;
};

type TeacherOpt = { email: string; label: string };

type ClassOpt = { id: string; name: string; assigned_teacher_email: string | null };

type Props = { tenantId: string; schoolName: string; viewerRole: RomRole };

const DAY_INDEXES = [0, 1, 2, 3, 4] as const;
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri"] as const;

export function TimetablePageClient({ tenantId, schoolName, viewerRole }: Props) {
  const { t, lang } = useUiLanguage();
  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;

  const [settings, setSettings] = useState<Settings | null>(null);
  const [slots, setSlots] = useState<SlotApi[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [ownerRooms, setOwnerRooms] = useState("");
  const [ownerAm, setOwnerAm] = useState("");
  const [ownerPm, setOwnerPm] = useState("");

  const [modal, setModal] = useState<{
    day: number;
    periodIndex: number;
    roomIndex: number;
    slot: SlotApi | null;
  } | null>(null);
  const [formClassId, setFormClassId] = useState("");
  const [formTeacher, setFormTeacher] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const canEditGrid = viewerRole === "owner" || viewerRole === "department_head";
  const canEditLayout = viewerRole === "owner";

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`${base}/timetable`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || t("timetable.loadError"));
      const s = data.settings as Settings | undefined;
      if (!s) throw new Error(t("timetable.loadError"));
      setSettings(s);
      setOwnerRooms(String(s.room_count));
      setOwnerAm(String(s.periods_am));
      setOwnerPm(String(s.periods_pm));
      setSlots((data.slots as SlotApi[]) ?? []);
      setClasses((data.classes as ClassOpt[]) ?? []);
      setTeachers((data.teachers as TeacherOpt[]) ?? []);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : t("timetable.loadError"));
    }
  }, [base, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const periodTotal = settings ? settings.periods_am + settings.periods_pm : 0;

  const slotMap = useMemo(() => {
    const m = new Map<string, SlotApi>();
    for (const s of slots) {
      m.set(`${s.day_of_week}-${s.period_index}-${s.room_index}`, s);
    }
    return m;
  }, [slots]);

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  function teacherEmailForDisplay(slot: SlotApi): string {
    const c = classById.get(slot.class_id);
    const fromClass = c?.assigned_teacher_email?.trim().toLowerCase() ?? "";
    return fromClass || slot.teacher_email.trim().toLowerCase();
  }

  function teacherLabelForEmail(email: string): string {
    const e = email.trim().toLowerCase();
    return teachers.find((x) => x.email === e)?.label ?? email;
  }

  async function saveLayout() {
    if (!canEditLayout) return;
    const rc = Number.parseInt(ownerRooms, 10);
    const am = Number.parseInt(ownerAm, 10);
    const pm = Number.parseInt(ownerPm, 10);
    setBusy(true);
    try {
      const res = await fetch(`${base}/timetable`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ room_count: rc, periods_am: am, periods_pm: pm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed");
      const next = data.settings as Settings;
      setSettings(next);
      alert(t("dash.timetableLayoutSaved"));
      void refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function openModal(day: number, periodIndex: number, roomIndex: number) {
    if (!canEditGrid) return;
    const key = `${day}-${periodIndex}-${roomIndex}`;
    const slot = slotMap.get(key) ?? null;
    setFormClassId(slot?.class_id ?? "");
    setFormError(null);
    setModal({ day, periodIndex, roomIndex, slot });
  }

  async function saveModal() {
    if (!modal || !settings) return;
    const classId = formClassId.trim();
    if (!classId) {
      setFormError(t("timetable.pickClass"));
      return;
    }
    const klass = classById.get(classId);
    const assigned = klass?.assigned_teacher_email?.trim().toLowerCase() ?? "";
    if (!assigned) {
      setFormError(t("timetable.assignTeacherOnClass"));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (modal.slot) {
        const res = await fetch(`${base}/timetable/slots/${encodeURIComponent(modal.slot.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            class_id: classId,
            day_of_week: modal.day,
            period_index: modal.periodIndex,
            room_index: modal.roomIndex,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error || "Failed");
      } else {
        const res = await fetch(`${base}/timetable/slots`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            day_of_week: modal.day,
            period_index: modal.periodIndex,
            room_index: modal.roomIndex,
            class_id: classId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error || "Failed");
      }
      setModal(null);
      void refresh();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearModalSlot() {
    if (!modal?.slot) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`${base}/timetable/slots/${encodeURIComponent(modal.slot.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed");
      setModal(null);
      void refresh();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const pdfHref = `${base}/timetable-pdf?lang=${encodeURIComponent(lang)}&inline=1`;

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {loadError}{" "}
        <button type="button" className="font-semibold underline" onClick={() => void refresh()}>
          Retry
        </button>
      </div>
    );
  }

  if (!settings) {
    return <div className="text-sm text-zinc-600">…</div>;
  }

  const gridCols = settings.periods_am + 1 + settings.periods_pm;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">{t("timetable.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {canEditGrid ? t("timetable.leadIntro") : t("timetable.teacherIntro")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/reports/${tenantId}`}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
          >
            ← {t("nav.classesLanguage")}
          </Link>
          <a
            href={pdfHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          >
            {viewerRole === "teacher" ? t("dash.myTimetablePrint") : t("dash.timetablePrint")}
          </a>
        </div>
      </div>

      {canEditLayout ? (
        <section className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">{schoolName}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {t("dash.timetableRoomsLabel")} · {t("dash.timetablePeriodsAmLabel")} · {t("dash.timetablePeriodsPmLabel")} (1–6 each)
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs font-medium text-zinc-700">
              {t("dash.timetableRoomsLabel")}
              <input
                type="number"
                min={1}
                max={50}
                className="mt-1 w-24 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                value={ownerRooms}
                onChange={(e) => setOwnerRooms(e.target.value)}
              />
            </label>
            <label className="flex flex-col text-xs font-medium text-zinc-700">
              {t("dash.timetablePeriodsAmLabel")}
              <select
                className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                value={ownerAm}
                onChange={(e) => setOwnerAm(e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs font-medium text-zinc-700">
              {t("dash.timetablePeriodsPmLabel")}
              <select
                className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                value={ownerPm}
                onChange={(e) => setOwnerPm(e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveLayout()}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? t("dash.timetableSavingLayout") : t("dash.timetableSaveLayout")}
            </button>
          </div>
        </section>
      ) : null}

      {canEditGrid && classes.length === 0 ? (
        <p className="text-sm text-amber-800">{t("timetable.noClasses")}</p>
      ) : null}
      {canEditGrid && teachers.length === 0 ? (
        <p className="text-sm text-amber-800">{t("timetable.noTeachers")}</p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-emerald-200 bg-white shadow-sm">
        <table className="min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 bg-emerald-50/60">
              <th className="sticky left-0 z-[1] border-r border-zinc-200 bg-emerald-50/90 px-2 py-2 font-semibold text-zinc-800">
                Day
              </th>
              {Array.from({ length: gridCols }, (_, gc) => {
                const isLunch = gc === settings.periods_am;
                if (isLunch) {
                  return (
                    <th key={`lunch-${gc}`} className="border-r border-zinc-200 px-1 py-2 text-center font-semibold text-zinc-500">
                      {t("timetable.lunch")}
                    </th>
                  );
                }
                const isAm = gc < settings.periods_am;
                const periodIndex = isAm ? gc : gc - 1;
                const label = isAm ? `AM ${periodIndex + 1}` : `PM ${periodIndex - settings.periods_am + 1}`;
                return (
                  <th key={`p-${gc}`} className="border-r border-zinc-200 px-1 py-2 text-center font-semibold text-zinc-800">
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {DAY_INDEXES.map((d) => (
              <tr key={d} className="border-b border-zinc-100">
                <th className="sticky left-0 z-[1] border-r border-zinc-200 bg-white px-2 py-2 font-medium text-zinc-700">
                  {t(`weekday.${WEEKDAY_KEYS[d]}`)}
                </th>
                {Array.from({ length: gridCols }, (_, gc) => {
                  const isLunch = gc === settings.periods_am;
                  if (isLunch) {
                    return (
                      <td key={`l-${d}-${gc}`} className="border-r border-zinc-100 bg-zinc-50/80 align-top">
                        <div className="flex min-h-[120px] items-center justify-center text-zinc-400">—</div>
                      </td>
                    );
                  }
                  const periodIndex = gc < settings.periods_am ? gc : gc - 1;
                  return (
                    <td key={`c-${d}-${gc}`} className="border-r border-zinc-100 align-top p-0">
                      <div className="flex flex-col">
                        {Array.from({ length: settings.room_count }, (_, r) => {
                          const slot = slotMap.get(`${d}-${periodIndex}-${r}`);
                          const emailForColor = slot ? teacherEmailForDisplay(slot) : "";
                          const bg = emailForColor ? teacherHexColor(emailForColor) : "#f8fafc";
                          const interactive = canEditGrid;
                          return (
                            <button
                              key={r}
                              type="button"
                              disabled={!interactive}
                              onClick={() => openModal(d, periodIndex, r)}
                              className={`border-b border-zinc-100 px-1.5 py-1.5 text-left last:border-b-0 ${
                                interactive ? "cursor-pointer hover:brightness-95" : "cursor-default"
                              }`}
                              style={{ backgroundColor: bg }}
                            >
                              <div className="text-[10px] font-semibold text-zinc-600">Room {r + 1}</div>
                              {slot ? (
                                <div className="mt-0.5 text-[11px] font-medium leading-tight text-zinc-900">
                                  {(slot.class_name ?? "").trim() || "—"}
                                </div>
                              ) : (
                                <div className="mt-0.5 text-[11px] text-zinc-500">{t("timetable.emptyCell")}</div>
                              )}
                              {slot ? (
                                <div className="mt-0.5 text-[10px] text-zinc-700">
                                  {teachers.find((x) => x.email === slot.teacher_email)?.label ?? slot.teacher_email}
                                </div>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-zinc-900">{t("timetable.editCell")}</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {t(`weekday.${WEEKDAY_KEYS[modal.day]}`)} · period {modal.periodIndex + 1} of {periodTotal} · room row{" "}
              {modal.roomIndex + 1}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-zinc-700">
                {t("timetable.class")}
                <select
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-2 text-sm"
                  value={formClassId}
                  onChange={(e) => setFormClassId(e.target.value)}
                >
                  <option value="">—</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-zinc-600">{t("timetable.teacherFromClassHint")}</p>
              {formClassId ? (
                <p className="text-xs font-medium text-zinc-800">
                  {t("timetable.teacher")}:{" "}
                  {(() => {
                    const e = classById.get(formClassId)?.assigned_teacher_email?.trim().toLowerCase() ?? "";
                    return e ? teacherLabelForEmail(e) : `— (${t("timetable.assignTeacherOnClass")})`;
                  })()}
                </p>
              ) : null}
            </div>
            {formError ? <p className="mt-3 text-sm text-red-700">{formError}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveModal()}
                className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("timetable.saveSlot")}
              </button>
              {modal.slot ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void clearModalSlot()}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
                >
                  {t("timetable.clearSlot")}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => setModal(null)}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              >
                {t("timetable.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
