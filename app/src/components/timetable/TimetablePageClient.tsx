"use client";

import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Building2,
  CalendarDays,
  Library,
  PencilLine,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE, ICON_SECTION } from "@/components/ui/iconSizes";
import type { RomRole } from "@/lib/data/memberships";
import { classesListHref } from "@/lib/app/classesNavigation";
import { openPdfForPrint } from "@/lib/app/openPdfForPrint";
import { CLASS_SETTINGS_SAVED_EVENT, type ClassSettingsSavedDetail } from "@/lib/appEvents";
import { teacherHexColor } from "@/lib/timetable/teacherColor";
import { visibleMonFriDayIndexesFromClasses } from "@/lib/timetable/visibleTimetableDays";

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

type ClassOpt = {
  id: string;
  name: string;
  assigned_teacher_email: string | null;
  active_weekdays?: string[];
  student_count?: number;
};

type Props = {
  tenantId: string;
  schoolName: string;
  viewerRole: RomRole;
  embedded?: boolean;
  /** Owner on dashboard: open Classes and Reports panel under the menu (same as menu button). */
  onOpenClassesAndReports?: () => void;
};

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const ROOM_ROW_HEIGHT_PX = 56;

export function TimetablePageClient({
  tenantId,
  schoolName,
  viewerRole,
  embedded = false,
  onOpenClassesAndReports,
}: Props) {
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
  const [viewMode, setViewMode] = useState<"overview" | "by_teacher" | "by_room">("overview");
  const [selectedTeacherEmail, setSelectedTeacherEmail] = useState("");
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0);
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

  useEffect(() => {
    const onClassSettingsSaved = (ev: Event) => {
      const ce = ev as CustomEvent<ClassSettingsSavedDetail>;
      const id = ce.detail?.tenantId?.trim();
      if (id && id === tenantId) void refresh();
    };
    window.addEventListener(CLASS_SETTINGS_SAVED_EVENT, onClassSettingsSaved);
    return () => window.removeEventListener(CLASS_SETTINGS_SAVED_EVENT, onClassSettingsSaved);
  }, [tenantId, refresh]);

  const periodTotal = settings ? settings.periods_am + settings.periods_pm : 0;

  const slotMap = useMemo(() => {
    const m = new Map<string, SlotApi>();
    for (const s of slots) {
      m.set(`${s.day_of_week}-${s.period_index}-${s.room_index}`, s);
    }
    return m;
  }, [slots]);

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const orderedTeacherEmails = useMemo(
    () => teachers.map((t) => t.email).filter(Boolean),
    [teachers],
  );

  const defaultVisibleDayIndexes = useMemo(() => visibleMonFriDayIndexesFromClasses(classes), [classes]);
  const effectiveViewMode = viewerRole === "teacher" ? "by_teacher" : viewMode;
  const filteredSlotsForView = useMemo(() => {
    if (effectiveViewMode === "by_teacher") {
      const email = selectedTeacherEmail.trim().toLowerCase();
      if (viewerRole !== "teacher" && email) {
        return slots.filter((s) => teacherEmailForDisplay(s) === email);
      }
      return slots;
    }
    if (effectiveViewMode === "by_room") {
      return slots.filter((s) => s.room_index === selectedRoomIndex);
    }
    return slots;
  }, [effectiveViewMode, selectedRoomIndex, selectedTeacherEmail, slots, viewerRole]);
  const visibleDayIndexes = useMemo(() => {
    const days = [...new Set(filteredSlotsForView.map((s) => s.day_of_week).filter((d) => d >= 0 && d <= 6))].sort(
      (a, b) => a - b,
    );
    return days.length > 0 ? days : defaultVisibleDayIndexes;
  }, [defaultVisibleDayIndexes, filteredSlotsForView]);

  const slotMapForView = useMemo(() => {
    const m = new Map<string, SlotApi>();
    for (const s of filteredSlotsForView) {
      m.set(`${s.day_of_week}-${s.period_index}-${s.room_index}`, s);
    }
    return m;
  }, [filteredSlotsForView]);

  /** At most one lesson per day/period for a teacher; room row comes from the slot. */
  const teacherSlotByDayPeriod = useMemo(() => {
    const m = new Map<string, SlotApi>();
    if (effectiveViewMode !== "by_teacher") return m;
    for (const s of filteredSlotsForView) {
      const k = `${s.day_of_week}-${s.period_index}`;
      if (!m.has(k)) m.set(k, s);
    }
    return m;
  }, [effectiveViewMode, filteredSlotsForView]);

  function teacherEmailForDisplay(slot: SlotApi): string {
    const c = classById.get(slot.class_id);
    const fromClass = c?.assigned_teacher_email?.trim().toLowerCase() ?? "";
    return fromClass || slot.teacher_email.trim().toLowerCase();
  }

  function teacherLabelForEmail(email: string): string {
    const e = email.trim().toLowerCase();
    const lab = teachers.find((x) => x.email === e)?.label?.trim();
    if (lab) return lab;
    return t("class.teacherNameNotSet");
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
      if (!res.ok) throw new Error((data as { error?: string }).error || t("common.failed"));
      const next = data.settings as Settings;
      setSettings(next);
      alert(t("dash.timetableLayoutSaved"));
      void refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
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
        if (!res.ok) throw new Error((data as { error?: string }).error || t("common.failed"));
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
        if (!res.ok) throw new Error((data as { error?: string }).error || t("common.failed"));
      }
      setModal(null);
      void refresh();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : t("common.failed"));
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
      if (!res.ok) throw new Error((data as { error?: string }).error || t("common.failed"));
      setModal(null);
      void refresh();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(false);
    }
  }

  const pdfHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("lang", lang);
    params.set("mode", effectiveViewMode);
    if (effectiveViewMode === "by_teacher" && selectedTeacherEmail.trim()) {
      params.set("teacher_email", selectedTeacherEmail.trim().toLowerCase());
    }
    if (effectiveViewMode === "by_room") {
      params.set("room_index", String(selectedRoomIndex));
    }
    return `${base}/timetable-pdf?${params.toString()}`;
  }, [base, effectiveViewMode, lang, selectedRoomIndex, selectedTeacherEmail]);

  useEffect(() => {
    if (viewerRole === "teacher") return;
    if (!selectedTeacherEmail && teachers.length > 0) {
      setSelectedTeacherEmail(teachers[0]!.email);
    }
  }, [selectedTeacherEmail, teachers, viewerRole]);

  useEffect(() => {
    if (settings && selectedRoomIndex >= settings.room_count) setSelectedRoomIndex(0);
  }, [selectedRoomIndex, settings]);

  const canStepTeacher =
    viewerRole !== "teacher" && effectiveViewMode === "by_teacher" && orderedTeacherEmails.length > 1;
  const canStepRoom = viewerRole !== "teacher" && effectiveViewMode === "by_room" && (settings?.room_count ?? 0) > 1;

  function stepTeacher(dir: -1 | 1) {
    if (!canStepTeacher) return;
    const cur = Math.max(0, orderedTeacherEmails.indexOf(selectedTeacherEmail));
    const next = (cur + dir + orderedTeacherEmails.length) % orderedTeacherEmails.length;
    setSelectedTeacherEmail(orderedTeacherEmails[next] ?? selectedTeacherEmail);
  }

  function stepRoom(dir: -1 | 1) {
    if (!canStepRoom || !settings) return;
    const n = settings.room_count;
    const next = (selectedRoomIndex + dir + n) % n;
    setSelectedRoomIndex(next);
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {loadError}{" "}
        <button
          type="button"
          className="inline-flex items-center gap-1 font-semibold underline"
          onClick={() => void refresh()}
        >
          <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("common.retry")}
        </button>
      </div>
    );
  }

  if (!settings) {
    return <div className="text-sm text-zinc-600">{t("report.loading")}</div>;
  }

  const gridCols = settings.periods_am + 1 + settings.periods_pm;

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {viewerRole === "owner" && onOpenClassesAndReports ? (
              <button
                type="button"
                onClick={onOpenClassesAndReports}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
              >
                <BookOpen className={ICON_INLINE} aria-hidden />
                {t("dash.ownerMenuClassesAndReports")}
              </button>
            ) : viewerRole === "owner" || viewerRole === "department_head" ? (
              <Link
                href={classesListHref(tenantId, viewerRole)}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
              >
                <BookOpen className={ICON_INLINE} aria-hidden />
                {t("dash.ownerMenuClassesAndReports")}
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => openPdfForPrint(pdfHref)}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          >
            <Printer className={ICON_INLINE} aria-hidden />
            {viewerRole === "teacher" ? t("dash.myTimetablePrint") : t("dash.timetablePrint")}
          </button>
          {viewerRole === "owner" || viewerRole === "department_head" ? (
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as typeof viewMode)}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm"
              aria-label={t("timetable.viewModeLabel")}
            >
              <option value="overview">{t("timetable.printModeOverview")}</option>
              <option value="by_teacher">{t("timetable.printModeByTeacher")}</option>
              <option value="by_room">{t("timetable.printModeByRoom")}</option>
            </select>
          ) : null}
        </div>
      ) : (
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
            <CalendarDays className={ICON_SECTION} aria-hidden />
            {t("timetable.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {canEditGrid ? t("timetable.leadIntro") : t("timetable.teacherIntro")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <Link
                href={classesListHref(tenantId, viewerRole)}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
              >
                <BookOpen className={ICON_INLINE} aria-hidden />
                {t("dash.ownerMenuClassesAndReports")}
              </Link>
            ) : (
              <Link
                href={`/reports/${encodeURIComponent(tenantId)}`}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
              >
                <Library className={ICON_INLINE} aria-hidden />
                {t("nav.classesLanguage")}
              </Link>
            )}
            <button
              type="button"
              onClick={() => openPdfForPrint(pdfHref)}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
            >
              <Printer className={ICON_INLINE} aria-hidden />
              {viewerRole === "teacher" ? t("dash.myTimetablePrint") : t("dash.timetablePrint")}
            </button>
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as typeof viewMode)}
                className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm"
                aria-label={t("timetable.viewModeLabel")}
              >
                <option value="overview">{t("timetable.printModeOverview")}</option>
                <option value="by_teacher">{t("timetable.printModeByTeacher")}</option>
                <option value="by_room">{t("timetable.printModeByRoom")}</option>
              </select>
            ) : null}
            {viewerRole !== "teacher" && effectiveViewMode === "by_teacher" ? (
              <select
                value={selectedTeacherEmail}
                onChange={(e) => setSelectedTeacherEmail(e.target.value)}
                className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm"
                aria-label={t("timetable.teacher")}
              >
                {teachers.map((te) => (
                  <option key={te.email} value={te.email}>
                    {te.label || te.email}
                  </option>
                ))}
              </select>
            ) : null}
            {viewerRole !== "teacher" && effectiveViewMode === "by_room" ? (
              <select
                value={String(selectedRoomIndex)}
                onChange={(e) => setSelectedRoomIndex(Number.parseInt(e.target.value, 10) || 0)}
                className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm"
                aria-label={t("dash.timetableRoomsLabel")}
              >
                {Array.from({ length: settings.room_count }, (_, i) => (
                  <option key={i} value={String(i)}>
                    {t("pdf.timetableRoomN", { n: i + 1 })}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      )}

      {canEditLayout ? (
        <section className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Building2 className={ICON_SECTION} aria-hidden />
            {schoolName}
          </h2>
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
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Save className={ICON_INLINE} aria-hidden />
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

      <div className="rom-timetable-grid overflow-x-auto rounded-xl border border-emerald-200 bg-white shadow-sm">
        <table className="min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 bg-emerald-50/60">
              <th className="sticky left-0 z-[1] border-r border-zinc-200 bg-emerald-50/90 px-2 py-2 font-semibold text-zinc-800">
                {t("timetable.dayColumn")}
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
                const label = isAm
                  ? t("pdf.timetablePeriodAm", { n: periodIndex + 1 })
                  : t("pdf.timetablePeriodPm", { n: periodIndex - settings.periods_am + 1 });
                return (
                  <th key={`p-${gc}`} className="border-r border-zinc-200 px-1 py-2 text-center font-semibold text-zinc-800">
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleDayIndexes.map((d) => (
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
                  if (effectiveViewMode === "by_teacher") {
                    const slot = teacherSlotByDayPeriod.get(`${d}-${periodIndex}`);
                    const emailForColor = slot ? teacherEmailForDisplay(slot) : "";
                    const bg = emailForColor ? teacherHexColor(emailForColor) : "#f8fafc";
                    return (
                      <td key={`c-${d}-${gc}`} className="border-r border-zinc-100 align-top p-0">
                        <div
                          className="flex min-h-[120px] flex-col px-1.5 py-1.5 text-left"
                          style={{ backgroundColor: bg }}
                        >
                          {slot ? (
                            <>
                              <div className="text-[10px] font-semibold text-zinc-600">
                                {t("pdf.timetableRoomN", { n: slot.room_index + 1 })}
                              </div>
                              <div className="mt-0.5 text-[11px] font-medium leading-tight text-zinc-900">
                                {`${(slot.class_name ?? "").trim() || "—"} (${classById.get(slot.class_id)?.student_count ?? 0})`}
                              </div>
                              <div className="mt-0.5 text-[10px] leading-tight text-zinc-700">
                                {teacherLabelForEmail(teacherEmailForDisplay(slot))}
                              </div>
                            </>
                          ) : (
                            <div className="flex min-h-[100px] items-center justify-center text-[11px] text-zinc-500">
                              {t("timetable.emptyCell")}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={`c-${d}-${gc}`} className="border-r border-zinc-100 align-top p-0">
                      <div className="flex flex-col">
                        {Array.from({ length: effectiveViewMode === "by_room" ? 1 : settings.room_count }, (_, r) => {
                          const roomRowIndex = effectiveViewMode === "by_room" ? selectedRoomIndex : r;
                          const slot = slotMapForView.get(`${d}-${periodIndex}-${roomRowIndex}`);
                          const emailForColor = slot ? teacherEmailForDisplay(slot) : "";
                          const bg = emailForColor ? teacherHexColor(emailForColor) : "#f8fafc";
                          const interactive = canEditGrid;
                          return (
                            <button
                              key={r}
                              type="button"
                              disabled={!interactive}
                              onClick={() => openModal(d, periodIndex, roomRowIndex)}
                              className={`border-b border-zinc-100 px-1.5 py-1.5 text-left last:border-b-0 ${
                                interactive ? "cursor-pointer hover:brightness-95" : "cursor-default"
                              }`}
                              style={{ backgroundColor: bg, height: `${ROOM_ROW_HEIGHT_PX}px` }}
                            >
                              <div className="text-[10px] font-semibold text-zinc-600">
                                {t("pdf.timetablePageRoom", { n: roomRowIndex + 1 })}
                              </div>
                              {slot ? (
                                <div className="mt-0.5 text-[11px] font-medium leading-tight text-zinc-900">
                                  {`${(slot.class_name ?? "").trim() || "—"} (${classById.get(slot.class_id)?.student_count ?? 0})`}
                                </div>
                              ) : (
                                <div className="mt-0.5 truncate text-[11px] text-zinc-500">{t("timetable.emptyCell")}</div>
                              )}
                              {slot ? (
                                <div className="mt-0.5 text-[10px] leading-tight text-zinc-700">
                                  {teacherLabelForEmail(teacherEmailForDisplay(slot))}
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
      {canStepTeacher || canStepRoom ? (
        <div className="sticky bottom-3 z-20 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-900 bg-zinc-950 px-3 py-2 text-white shadow-md dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950">
            <button
              type="button"
              onClick={() => {
                if (canStepTeacher) {
                  stepTeacher(-1);
                  return;
                }
                if (canStepRoom) stepRoom(-1);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500"
              aria-label={t("timetable.prevInstance")}
            >
              <ChevronLeft className={ICON_INLINE} aria-hidden />
              {t("timetable.prevInstance")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (canStepTeacher) {
                  stepTeacher(1);
                  return;
                }
                if (canStepRoom) stepRoom(1);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500"
              aria-label={t("timetable.nextInstance")}
            >
              {t("timetable.nextInstance")}
              <ChevronRight className={ICON_INLINE} aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <PencilLine className={ICON_SECTION} aria-hidden />
              {t("timetable.editCell")}
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              {t("timetable.slotMetaLine", {
                weekday: t(`weekday.${WEEKDAY_KEYS[modal.day]}`),
                period: modal.periodIndex + 1,
                total: periodTotal,
                room: modal.roomIndex + 1,
              })}
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
              {(() => {
                const classIdForLink = formClassId.trim() || modal.slot?.class_id || "";
                if (!classIdForLink) return null;
                return (
                  <Link
                    href={`/reports/${encodeURIComponent(tenantId)}/classes/${encodeURIComponent(classIdForLink)}?panel=overview`}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                  >
                    <BookOpen className={ICON_INLINE} aria-hidden />
                    {t("timetable.goToClass")}
                  </Link>
                );
              })()}
            </div>
            {formError ? <p className="mt-3 text-sm text-red-700">{formError}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveModal()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Save className={ICON_INLINE} aria-hidden />
                {t("timetable.saveSlot")}
              </button>
              {modal.slot ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void clearModalSlot()}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className={ICON_INLINE} aria-hidden />
                  {t("timetable.clearSlot")}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => setModal(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              >
                <X className={ICON_INLINE} aria-hidden />
                {t("timetable.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
