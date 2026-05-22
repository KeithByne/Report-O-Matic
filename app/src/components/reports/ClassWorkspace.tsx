"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ClipboardList,
  FolderKanban,
  Printer,
  Settings2,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { allowedClassLevelsForRubric } from "@/lib/classLevel";
import {
  classDefaultSubjectUiLine,
  formatClassLevelOptionLabel,
  reportLanguageOptionLabel,
} from "@/lib/i18n/uiStrings";
import { REPORT_LANGUAGES, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import {
  type ReportKind,
  type ReportPeriod,
  findConflictingReportIdForNewReport,
  isShortCourseReport,
  parseReportInputs,
  reportPeriodTermNumber,
} from "@/lib/reportInputs";
import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import { parseGradeRubricProfile } from "@/lib/gradeRubricProfile";
import { REPORT_SUBJECTS } from "@/lib/subjects";
import { subjectSuggestionLabelsByRubric } from "@/lib/subjectOptionsByEducationType";
import { resolveDefaultSubjectInputToStorage, subjectFieldDisplayValueFromStored } from "@/lib/subjectFormResolve";
import { WEEKDAY_KEYS, type WeekdayKey, isWeekdayKey } from "@/lib/activeWeekdays";
import { labelForLessonPeriodIndex } from "@/lib/timetable/lessonPeriodLabels";
import { classesListHref } from "@/lib/app/classesNavigation";
import { InlinePdfPreviewCard } from "@/components/dashboard/InlinePdfPreviewCard";
import { ClassWorkspaceGuide } from "@/components/reports/ClassWorkspaceGuide";
import { ICON_INLINE, ICON_SECTION } from "@/components/ui/iconSizes";
import type { RomRole } from "@/lib/data/memberships";
import { CLASS_SETTINGS_SAVED_EVENT, type ClassSettingsSavedDetail } from "@/lib/appEvents";
import { scrollPanelContentTopIntoView } from "@/lib/ui/scrollPanelContentIntoView";

type ClassWorkspacePanelId =
  | "settings"
  | "students"
  | "bulkDownload"
  | "movePupil"
  | "locateFromActive"
  | "registerPreview";

const CLASS_PANEL_ICON: Record<ClassWorkspacePanelId, LucideIcon> = {
  settings: Settings2,
  students: Users,
  bulkDownload: Printer,
  movePupil: ArrowLeftRight,
  locateFromActive: UserPlus,
  registerPreview: ClipboardList,
};

const CLASS_PANEL_GUIDE_KEY: Record<ClassWorkspacePanelId, string> = {
  settings: "class_settings",
  students: "class_students",
  bulkDownload: "class_bulk",
  movePupil: "class_move",
  locateFromActive: "class_locate_active",
  registerPreview: "class_register",
};

const CLASS_BULK_PDF_ID = "class-bulk-reports";

function normalizeScholasticYearLabel(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

type StudentGender = "male" | "female" | "non_binary" | null;

type Student = {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  gender?: StudentGender;
  class_id: string;
  class_name: string;
};

type Report = {
  id: string;
  student_id: string;
  title: string | null;
  status: "draft" | "final";
  body?: string;
  inputs?: unknown;
  updated_at: string;
};

type ClassDetail = {
  id: string;
  name: string;
  scholastic_year: string | null;
  cefr_level: string | null;
  default_subject: string;
  /** Stored on the class: drives class level options and default report rubric. */
  grade_rubric_profile?: GradeRubricProfile;
  default_output_language: string;
  default_new_report_kind?: ReportKind;
  default_new_report_period?: ReportPeriod;
  assigned_teacher_email: string | null;
  /** From membership; used for display (never show raw email in class settings). */
  assigned_teacher_first_name?: string | null;
  assigned_teacher_last_name?: string | null;
  /** Teaching-period index from school timetable (AM then PM). */
  preferred_lesson_period_index?: number | null;
  /** Timetable room row (0-based), persisted on the class. */
  preferred_room_index?: number | null;
  active_weekdays: WeekdayKey[];
};

type ClassListRow = { id: string; name: string };
type TimetableSlotLite = { class_id: string; room_index: number };

type ViewerRole = "owner" | "department_head" | "teacher";

type TeacherOption = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  role?: RomRole;
};

type Props = {
  tenantId: string;
  classId: string;
  schoolName: string;
  className: string;
  viewerRole: ViewerRole;
  /** From URL: `?panel=students` opens that section; `?panel=overview` or omitted = class overview (no section expanded). */
  initialOpenPanel?: ClassWorkspacePanelId;
  /** From URL `?student=uuid` (e.g. back from a report): scroll to and highlight that pupil in the list. */
  initialFocusStudentId?: string | null;
};

function formatTeacherNameParts(first: string | null | undefined, last: string | null | undefined): string | null {
  const fn = (first ?? "").trim();
  const ln = (last ?? "").trim();
  const full = `${fn} ${ln}`.trim();
  if (full) return full;
  if (fn) return fn;
  if (ln) return ln;
  return null;
}

function trimDisplayLabel(s: string, maxChars: number): string {
  const v = s.trim();
  if (v.length <= maxChars) return v;
  return `${v.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function ClassWorkspace({
  tenantId,
  classId,
  schoolName,
  className: initialClassName,
  viewerRole,
  initialOpenPanel,
  initialFocusStudentId,
}: Props) {
  const { t, lang: uiLang } = useUiLanguage();
  const router = useRouter();
  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;
  const canManageClassSettings = viewerRole === "owner" || viewerRole === "department_head";

  const batchBase = `${base}/classes/${encodeURIComponent(classId)}/pdf-batch`;
  const [batchTermFilter, setBatchTermFilter] = useState<ReportPeriod>("first");

  const [detail, setDetail] = useState<ClassDetail | null>(null);
  /** From the class record only (chosen upstream on the classes card); not editable in this form. */
  const classGradeRubric = useMemo(
    () => parseGradeRubricProfile(detail?.grade_rubric_profile, "language"),
    [detail?.grade_rubric_profile],
  );
  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [activeRoster, setActiveRoster] = useState<{ id: string; display_name: string; class_ids: string[] }[]>([]);
  const [locateSchoolStudentId, setLocateSchoolStudentId] = useState("");

  const classBulkPdfGate = useMemo(() => {
    if (students.length === 0) {
      return { canDownload: false as const, message: t("class.bulkPdfNeedStudents") };
    }
    // Server enforces exact readiness rules (including edge cases like legacy rows and multiple reports per pupil).
    // Client-side gating here is intentionally minimal so we don't incorrectly block valid downloads.
    return { canDownload: true as const, message: null as string | null };
  }, [students.length, t]);

  const batchHref = useMemo(() => {
    const qp = new URLSearchParams();
    qp.set("term", batchTermFilter);
    return `${batchBase}?${qp.toString()}`;
  }, [batchBase, batchTermFilter]);

  const registerPdfHref = useMemo(() => {
    const qp = new URLSearchParams();
    qp.set("lang", uiLang);
    return `${base}/classes/${encodeURIComponent(classId)}/register-pdf?${qp.toString()}`;
  }, [base, classId, uiLang]);

  const registerPdfGate = useMemo(() => {
    if (students.length === 0) {
      return { canPrint: false as const, message: t("class.printRegisterNeedStudents") };
    }
    const days = detail?.active_weekdays ?? [];
    if (days.length === 0) {
      return { canPrint: false as const, message: t("class.printRegisterNeedDays") };
    }
    return { canPrint: true as const, message: null as string | null };
  }, [students.length, detail?.active_weekdays, t]);

  const [cName, setCName] = useState(initialClassName);
  const [scholasticYear, setScholasticYear] = useState("");
  const [cefr, setCefr] = useState("");
  const [defLang, setDefLang] = useState<ReportLanguageCode>("en");
  const [defNewReportKind, setDefNewReportKind] = useState<ReportKind>("standard");
  const [defNewReportPeriod, setDefNewReportPeriod] = useState<ReportPeriod>("first");
  const [assignTeacher, setAssignTeacher] = useState("");
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [allClasses, setAllClasses] = useState<ClassListRow[]>([]);
  const [timetableRoomCount, setTimetableRoomCount] = useState<number>(1);
  const [timetablePeriodsAm, setTimetablePeriodsAm] = useState(4);
  const [timetablePeriodsPm, setTimetablePeriodsPm] = useState(4);
  const [lessonPeriodSelect, setLessonPeriodSelect] = useState("");
  const [defSubject, setDefSubject] = useState("");
  const [customSubjectRows, setCustomSubjectRows] = useState<
    { name: string; rubric_profile: GradeRubricProfile }[]
  >([]);
  const [subjectListBusy, setSubjectListBusy] = useState(false);
  const [preferredRoomNumber, setPreferredRoomNumber] = useState("");
  const [moveStudentId, setMoveStudentId] = useState("");
  const [moveToClassId, setMoveToClassId] = useState("");

  /** Mon→Sun order; avoids Set + ensures PATCH/GET stay aligned. */
  const [activeDays, setActiveDays] = useState<WeekdayKey[]>([]);

  const loadClassRequestId = useRef(0);
  const didScrollToFocusStudent = useRef(false);

  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newGender, setNewGender] = useState<"" | "male" | "female" | "non_binary">("");
  /** All pupils visible to this user in the organisation (any class), for duplicate-name warnings when adding. */
  const [orgStudents, setOrgStudents] = useState<Student[]>([]);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editGender, setEditGender] = useState<"" | "male" | "female" | "non_binary">("");

  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openClassPanel, setOpenClassPanel] = useState<ClassWorkspacePanelId | null>(() => initialOpenPanel ?? null);
  const [classPdfPreview, setClassPdfPreview] = useState<{
    id: string;
    url: string;
    title: string;
    key: number;
  } | null>(null);
  const [classGuideHoverKey, setClassGuideHoverKey] = useState<string | null>(null);
  const [registerPreviewKey, setRegisterPreviewKey] = useState(0);
  const [duplicateReportDialog, setDuplicateReportDialog] = useState<{
    studentName: string;
    existingReportId: string;
    termLabel: string;
  } | null>(null);
  const [timetableConflictDialog, setTimetableConflictDialog] = useState<"room" | "teacher" | "generic" | null>(null);

  const classLevelOptions = useMemo(() => [...allowedClassLevelsForRubric(classGradeRubric)], [classGradeRubric]);

  const classLevelFieldLabel = useMemo(() => {
    if (classGradeRubric === "language") return t("class.classLevelForLanguage");
    if (classGradeRubric === "primary") return t("class.classLevelForPrimary");
    return t("class.classLevelForSecondary");
  }, [classGradeRubric, t]);

  const lessonPeriodOptions = useMemo(() => {
    const total = timetablePeriodsAm + timetablePeriodsPm;
    return Array.from({ length: total }, (_, i) => ({
      value: String(i),
      label: labelForLessonPeriodIndex(timetablePeriodsAm, timetablePeriodsPm, i, t),
    }));
  }, [timetablePeriodsAm, timetablePeriodsPm, t]);

  const classWorkspaceSubjectSuggestionsByRubric = useMemo(
    () => subjectSuggestionLabelsByRubric(customSubjectRows, uiLang),
    [customSubjectRows, uiLang],
  );
  const classWorkspaceAllSubjectSuggestions = useMemo(
    () => [...new Set(Object.values(classWorkspaceSubjectSuggestionsByRubric).flat())],
    [classWorkspaceSubjectSuggestionsByRubric],
  );

  const classSubjectListId = `class-workspace-subject-${tenantId}-${classId}-${classGradeRubric}`;

  const loadSubjectAccountOptions = useCallback(async () => {
    if (!canManageClassSettings) return;
    setSubjectListBusy(true);
    try {
      const res = await fetch(`${base}/subject-options`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const custRaw = data.custom;
      const rows: { name: string; rubric_profile: GradeRubricProfile }[] = [];
      const subjectToBeDefinedLower = t("class.subjectToBeDefinedLabel").trim().toLowerCase();
      if (Array.isArray(custRaw)) {
        for (const item of custRaw) {
          if (typeof item === "string") {
            const n = item.trim();
            const lower = n.toLowerCase();
            if (n && lower !== "subject to be defined" && lower !== subjectToBeDefinedLower) {
              rows.push({ name: n, rubric_profile: "secondary" });
            }
          } else if (item && typeof item === "object") {
            const o = item as Record<string, unknown>;
            const n = typeof o.name === "string" ? o.name.trim() : "";
            const lower = n.toLowerCase();
            if (n && lower !== "subject to be defined" && lower !== subjectToBeDefinedLower)
              rows.push({
                name: n,
                rubric_profile: parseGradeRubricProfile(o.rubric_profile, "secondary"),
              });
          }
        }
      }
      setCustomSubjectRows(rows);
    } catch {
      setCustomSubjectRows([]);
    } finally {
      setSubjectListBusy(false);
    }
  }, [base, canManageClassSettings, t]);

  useEffect(() => {
    if (!canManageClassSettings) return;
    void loadSubjectAccountOptions();
  }, [canManageClassSettings, loadSubjectAccountOptions]);

  useEffect(() => {
    if (!cefr.trim()) return;
    if (!classLevelOptions.includes(cefr)) setCefr("");
  }, [cefr, classLevelOptions]);

  useEffect(() => {
    setOpenClassPanel(initialOpenPanel ?? null);
  }, [tenantId, classId, initialOpenPanel]);

  useEffect(() => {
    didScrollToFocusStudent.current = false;
  }, [tenantId, classId, initialFocusStudentId]);

  useEffect(() => {
    const sid = initialFocusStudentId?.trim();
    if (!sid || didScrollToFocusStudent.current) return;
    if (!students.some((s) => s.id === sid)) return;
    didScrollToFocusStudent.current = true;
    const t = window.setTimeout(() => {
      document.getElementById(`class-student-row-${sid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [students, initialFocusStudentId]);

  const toggleClassPanel = useCallback((id: ClassWorkspacePanelId) => {
    setClassPdfPreview(null);
    setOpenClassPanel((current) => (current === id ? null : id));
  }, []);

  const previewClassPdf = useCallback((id: string, url: string, title: string) => {
    setOpenClassPanel(null);
    setClassPdfPreview((cur) =>
      cur?.id === id ? null : { id, url, title, key: Date.now() },
    );
  }, []);

  useEffect(() => {
    if (openClassPanel === "registerPreview") {
      setRegisterPreviewKey((k) => k + 1);
    }
  }, [openClassPanel]);

  useEffect(() => {
    if (!openClassPanel) return;
    const el = document.getElementById(`class-workspace-panel-${openClassPanel}`);
    scrollPanelContentTopIntoView(el);
  }, [openClassPanel]);

  useEffect(() => {
    if (!classPdfPreview) return;
    scrollPanelContentTopIntoView(document.getElementById("dash-teacher-panel-pdf-preview"));
  }, [classPdfPreview]);

  const classPanelButtonClass = useCallback(
    (id: ClassWorkspacePanelId) =>
      openClassPanel === id
        ? "border-emerald-600 bg-emerald-100 text-emerald-950"
        : "border-emerald-200 bg-white text-zinc-700 hover:bg-emerald-50/80",
    [openClassPanel],
  );

  const classPanelMenuItems = useMemo(() => {
    const items: { id: ClassWorkspacePanelId; label: string; Icon: LucideIcon }[] = [
      { id: "settings", label: t("class.settingsTitle"), Icon: CLASS_PANEL_ICON.settings },
    ];
    items.push(
      { id: "students", label: t("class.studentsTitle"), Icon: CLASS_PANEL_ICON.students },
      { id: "bulkDownload", label: t("class.printClassReports"), Icon: CLASS_PANEL_ICON.bulkDownload },
    );
    if (viewerRole === "owner" || viewerRole === "department_head") {
      items.push({
        id: "locateFromActive",
        label: t("class.panelLocateFromActive"),
        Icon: CLASS_PANEL_ICON.locateFromActive,
      });
      items.push({
        id: "movePupil",
        label: t("class.panelMovePupil"),
        Icon: CLASS_PANEL_ICON.movePupil,
      });
    }
    items.push({
      id: "registerPreview",
      label: t("class.registerMenu"),
      Icon: CLASS_PANEL_ICON.registerPreview,
    });
    return items;
  }, [t, viewerRole]);

  const loadClass = useCallback(async () => {
    const reqId = ++loadClassRequestId.current;
    try {
      const res = await fetch(`${base}/classes/${encodeURIComponent(classId)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (reqId !== loadClassRequestId.current) return;
      if (!res.ok) throw new Error(data.error || t("class.errLoadClass"));
      const c = data.class as ClassDetail;
      setDetail(c);
      setCName(c.name);
      setScholasticYear(c.scholastic_year?.trim() ?? "");
      setCefr(c.cefr_level ?? "");
      setDefSubject(subjectFieldDisplayValueFromStored(c.default_subject, uiLang));
      setDefLang((c.default_output_language as ReportLanguageCode) || "en");
      setDefNewReportKind(c.default_new_report_kind === "short_course" ? "short_course" : "standard");
      setDefNewReportPeriod(
        c.default_new_report_period === "second" || c.default_new_report_period === "third"
          ? c.default_new_report_period
          : "first",
      );
      setAssignTeacher(c.assigned_teacher_email?.trim() ?? "");
      const aw = Array.isArray(c.active_weekdays) ? c.active_weekdays : [];
      const keySet = new Set(
        aw.map((x) => (typeof x === "string" ? x.trim().toLowerCase() : "")).filter(isWeekdayKey),
      );
      setActiveDays(WEEKDAY_KEYS.filter((k) => keySet.has(k)));

      let periodsAm = 4;
      let periodsPm = 4;
      try {
        const ttRes = await fetch(`${base}/timetable`, { cache: "no-store" });
        const ttData = await ttRes.json().catch(() => ({}));
        if (ttRes.ok) {
          const settings = ttData.settings as
            | { room_count?: unknown; periods_am?: unknown; periods_pm?: unknown }
            | undefined;
          const roomCountRaw = Number(settings?.room_count ?? 1);
          const rcVal = Number.isFinite(roomCountRaw) && roomCountRaw > 0 ? Math.floor(roomCountRaw) : 1;
          setTimetableRoomCount(rcVal);
          const am = Number(settings?.periods_am);
          const pm = Number(settings?.periods_pm);
          if (Number.isFinite(am) && am >= 1 && am <= 6) periodsAm = Math.floor(am);
          if (Number.isFinite(pm) && pm >= 1 && pm <= 6) periodsPm = Math.floor(pm);

          if (viewerRole === "owner" || viewerRole === "department_head") {
            const stRoom = c.preferred_room_index;
            const storedRi =
              typeof stRoom === "number" && Number.isFinite(stRoom) ? Math.floor(stRoom) : null;
            if (storedRi !== null && storedRi >= 0 && storedRi < rcVal) {
              setPreferredRoomNumber(String(storedRi + 1));
            } else {
              const classSlots = Array.isArray(ttData.slots)
                ? (ttData.slots as TimetableSlotLite[]).filter((s) => s.class_id === classId)
                : [];
              const rooms = [
                ...new Set(classSlots.map((s) => Number(s.room_index)).filter((n) => Number.isFinite(n) && n >= 0)),
              ];
              if (rooms.length === 1) {
                setPreferredRoomNumber(String(rooms[0]! + 1));
              } else {
                setPreferredRoomNumber("");
              }
            }
          }
        }
      } catch {
        /* ignore timetable metadata load */
      }
      setTimetablePeriodsAm(periodsAm);
      setTimetablePeriodsPm(periodsPm);

      const totalPeriods = periodsAm + periodsPm;
      const prefRaw = c.preferred_lesson_period_index;
      let prefSelect = "";
      if (typeof prefRaw === "number" && Number.isFinite(prefRaw)) {
        const n = Math.floor(prefRaw);
        if (n >= 0 && n < totalPeriods) prefSelect = String(n);
      }
      setLessonPeriodSelect(prefSelect);
    } catch (e: unknown) {
      if (reqId !== loadClassRequestId.current) return;
      setLoadError(e instanceof Error ? e.message : t("class.errLoadClass"));
    }
  }, [base, classId, t, uiLang, viewerRole]);

  useEffect(() => {
    const onClassSettingsSaved = (ev: Event) => {
      const ce = ev as CustomEvent<ClassSettingsSavedDetail>;
      const id = ce.detail?.tenantId?.trim();
      if (!id || id !== tenantId) return;
      void loadClass();
      if (canManageClassSettings) void loadSubjectAccountOptions();
    };
    window.addEventListener(CLASS_SETTINGS_SAVED_EVENT, onClassSettingsSaved);
    return () => window.removeEventListener(CLASS_SETTINGS_SAVED_EVENT, onClassSettingsSaved);
  }, [tenantId, canManageClassSettings, loadSubjectAccountOptions, loadClass]);

  const refreshOrgStudents = useCallback(async () => {
    try {
      const res = await fetch(`${base}/students`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const rows = data.students;
      setOrgStudents(Array.isArray(rows) ? (rows as Student[]) : []);
    } catch {
      /* ignore */
    }
  }, [base]);

  const refreshStudents = useCallback(async () => {
    setLoadError(null);
    try {
      const [sRes, rRes] = await Promise.all([
        fetch(`${base}/students?classId=${encodeURIComponent(classId)}`),
        fetch(`${base}/reports`),
      ]);
      const sData = await sRes.json().catch(() => ({}));
      const rData = await rRes.json().catch(() => ({}));
      if (!sRes.ok) throw new Error(sData.error || t("class.errLoadStudents"));
      if (!rRes.ok) throw new Error(rData.error || t("class.errLoadReports"));
      setStudents(sData.students ?? []);
      const all = (rData.reports ?? []) as Report[];
      const sid = new Set((sData.students ?? []).map((x: Student) => x.id));
      setReports(all.filter((r) => sid.has(r.student_id)));
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : t("common.loadFailed"));
    }
  }, [base, classId, t]);

  useEffect(() => {
    void loadClass();
  }, [loadClass]);

  useEffect(() => {
    if (viewerRole !== "owner" && viewerRole !== "department_head") return;
    void (async () => {
      try {
        const res = await fetch(`${base}/members`);
        const data = await res.json().catch(() => ({}));
        if (
          res.ok &&
          Array.isArray(data.teachers) &&
          (data.teachers as unknown[]).every((t) => typeof (t as { email?: unknown })?.email === "string")
        ) {
          setTeachers(
            (data.teachers as TeacherOption[]).map((t) => ({
              email: String(t.email).trim().toLowerCase(),
              first_name: typeof t.first_name === "string" ? t.first_name : null,
              last_name: typeof t.last_name === "string" ? t.last_name : null,
            })),
          );
        }
      } catch {
        /* ignore */
      }
    })();
  }, [base, viewerRole]);

  useEffect(() => {
    if (viewerRole !== "owner" && viewerRole !== "department_head") return;
    void (async () => {
      try {
        const res = await fetch(`${base}/classes`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const rows = Array.isArray(data.classes) ? (data.classes as ClassListRow[]) : [];
        setAllClasses(rows.map((c) => ({ id: c.id, name: c.name })));
      } catch {
        /* ignore */
      }
    })();
  }, [base, viewerRole]);

  useEffect(() => {
    void refreshStudents();
  }, [refreshStudents]);

  useEffect(() => {
    void refreshOrgStudents();
  }, [refreshOrgStudents]);

  const duplicateNameMatches = useMemo(() => {
    const fn = newFirst.trim();
    const ln = newLast.trim();
    if (!fn || !ln) return [];
    return orgStudents.filter((s) => {
      const sf = (s.first_name ?? "").trim();
      const sl = (s.last_name ?? "").trim();
      return sf === fn && sl === ln;
    });
  }, [orgStudents, newFirst, newLast]);

  const duplicatePupilWarningText = useMemo(() => {
    if (duplicateNameMatches.length === 0) return null;
    const labels = duplicateNameMatches.map((s) =>
      s.class_id === classId
        ? t("class.duplicatePupilThisClass")
        : s.class_name?.trim() || t("class.duplicatePupilUnnamedClass"),
    );
    const locations = [...new Set(labels)].join(", ");
    return t("class.duplicatePupilWarning", { locations });
  }, [duplicateNameMatches, classId, t]);

  const assignedTeacherLabelInSettings = useMemo(() => {
    if (!detail?.assigned_teacher_email?.trim()) return null;
    const fromMembership = formatTeacherNameParts(
      detail.assigned_teacher_first_name,
      detail.assigned_teacher_last_name,
    );
    if (fromMembership) return fromMembership;
    const em = detail.assigned_teacher_email.trim().toLowerCase();
    const teach = teachers.find((x) => x.email === em);
    if (teach) return formatTeacherNameParts(teach.first_name, teach.last_name) ?? t("class.teacherNameNotSet");
    return t("class.teacherNameNotSet");
  }, [detail, teachers, t]);

  async function saveClassSettings(e: React.FormEvent) {
    e.preventDefault();
    const isLead = viewerRole === "owner" || viewerRole === "department_head";
    if (!isLead) return;
    let normalizedSubject: string;
    const trimmedSubject = defSubject.trim();
    if (!trimmedSubject) {
      normalizedSubject = (detail?.default_subject ?? "efl").trim() || "efl";
    } else {
      try {
        normalizedSubject = resolveDefaultSubjectInputToStorage(trimmedSubject, uiLang);
      } catch {
        alert(t("class.invalidSubject"));
        return;
      }
    }
    if (
      normalizeScholasticYearLabel(scholasticYear) !== normalizeScholasticYearLabel(detail?.scholastic_year ?? null)
    ) {
      const ok = window.confirm(t("class.confirmYearChange"));
      if (!ok) return;
    }
    setBusy("class-save");
    try {
      const res = await fetch(`${base}/classes/${encodeURIComponent(classId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: cName.trim(),
          scholastic_year: scholasticYear.trim() || null,
          cefr_level: cefr.trim() || null,
          default_subject: normalizedSubject,
          default_subject_rubric_profile: REPORT_SUBJECTS.some((s) => s.code === normalizedSubject.trim().toLowerCase())
            ? undefined
            : classGradeRubric,
          default_output_language: defLang,
          default_new_report_kind: defNewReportKind,
          default_new_report_period: defNewReportPeriod,
          active_weekdays: activeDays,
          assigned_teacher_email: assignTeacher.trim() ? assignTeacher.trim().toLowerCase() : null,
          preferred_room_index:
            preferredRoomNumber.trim() === ""
              ? null
              : Math.max(0, Number.parseInt(preferredRoomNumber, 10) - 1),
          preferred_lesson_period_index:
            lessonPeriodSelect.trim() === ""
              ? null
              : (() => {
                  const n = Number.parseInt(lessonPeriodSelect, 10);
                  return Number.isFinite(n) ? Math.max(0, n) : null;
                })(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          const err = typeof data.error === "string" ? data.error.toLowerCase() : "";
          const kind: "room" | "teacher" | "generic" = err.includes("teacher")
            ? "teacher"
            : err.includes("room")
              ? "room"
              : "generic";
          setTimetableConflictDialog(kind);
          return;
        }
        throw new Error(typeof data.error === "string" ? data.error : t("common.failed"));
      }
      await loadClass();
      await refreshStudents();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent<ClassSettingsSavedDetail>(CLASS_SETTINGS_SAVED_EVENT, {
            detail: { tenantId, classId },
          }),
        );
      }
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function saveDefaultNewReportPeriod(next: ReportPeriod) {
    const isLead = viewerRole === "owner" || viewerRole === "department_head";
    if (!isLead) return;
    setDefNewReportPeriod(next);
    setBusy("preset-period");
    try {
      const res = await fetch(`${base}/classes/${encodeURIComponent(classId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ default_new_report_period: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      await loadClass();
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
      await loadClass();
    } finally {
      setBusy(null);
    }
  }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    const fn = newFirst.trim();
    const ln = newLast.trim();
    if (!fn || !ln) {
      alert(t("class.firstLastRequired"));
      return;
    }
    setBusy("add");
    try {
      const res = await fetch(`${base}/students`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: fn,
          last_name: ln,
          class_id: classId,
          gender: newGender === "" ? undefined : newGender,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setNewFirst("");
      setNewLast("");
      setNewGender("");
      await refreshStudents();
      await refreshOrgStudents();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function createReport(studentId: string, studentDisplayName: string) {
    const kind = defNewReportKind;
    setBusy("create");
    try {
      const res = await fetch(`${base}/reports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          title: "",
          body: "",
          ...(kind === "short_course" ? { report_kind: "short_course" as const } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && typeof data.existing_report_id === "string") {
        const period: ReportPeriod = kind === "standard" ? defNewReportPeriod : "first";
        setDuplicateReportDialog({
          studentName: studentDisplayName,
          existingReportId: data.existing_report_id as string,
          termLabel: kind === "short_course" ? t("class.shortCourseReportLink") : termLabelForNewReportPeriod(period),
        });
        return;
      }
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      const rep = data.report as { id: string };
      await refreshStudents();
      router.push(`/reports/${tenantId}/classes/${classId}/reports/${rep.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  const reportsByStudent = (sid: string) => reports.filter((r) => r.student_id === sid);

  function termLabelForNewReportPeriod(period: ReportPeriod): string {
    if (period === "first") return t("class.newReportPeriodFirst");
    if (period === "second") return t("class.newReportPeriodSecond");
    return t("class.newReportPeriodThird");
  }

  function handleClickNewReport(s: Student) {
    const kind = defNewReportKind;
    const period: ReportPeriod = kind === "standard" ? defNewReportPeriod : "first";
    const conflictId = findConflictingReportIdForNewReport(
      reportsByStudent(s.id).map((r) => ({ id: r.id, inputs: r.inputs })),
      kind,
      period,
    );
    if (conflictId) {
      setDuplicateReportDialog({
        studentName: s.display_name,
        existingReportId: conflictId,
        termLabel: kind === "short_course" ? t("class.shortCourseReportLink") : termLabelForNewReportPeriod(defNewReportPeriod),
      });
      return;
    }
    void createReport(s.id, s.display_name);
  }

  const canDeleteStudent =
    viewerRole === "owner" || viewerRole === "department_head" || viewerRole === "teacher";
  const canDeleteClass = viewerRole === "owner" || viewerRole === "department_head";

  const locateCandidates = useMemo(
    () => activeRoster.filter((r) => !r.class_ids.includes(classId)),
    [activeRoster, classId],
  );

  useEffect(() => {
    if (openClassPanel !== "locateFromActive") return;
    if (viewerRole !== "owner" && viewerRole !== "department_head") return;
    void (async () => {
      try {
        const res = await fetch(`${base}/school-students?status=active`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const rows = (data.students ?? []) as { id: string; display_name: string; class_ids?: string[] }[];
        setActiveRoster(rows.map((r) => ({ id: r.id, display_name: r.display_name, class_ids: r.class_ids ?? [] })));
      } catch {
        setActiveRoster([]);
      }
    })();
  }, [openClassPanel, viewerRole, base]);

  async function locateFromActiveList() {
    if (!locateSchoolStudentId) return;
    setBusy("locate");
    try {
      const res = await fetch(
        `${base}/school-students/${encodeURIComponent(locateSchoolStudentId)}/enrollments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ class_id: classId }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setLocateSchoolStudentId("");
      await refreshStudents();
      await refreshOrgStudents();
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function deleteStudentRow(studentId: string, displayName: string) {
    if (!confirm(t("class.confirmRemoveStudent", { name: displayName }))) return;
    setBusy("del-stu");
    try {
      const res = await fetch(`${base}/students/${encodeURIComponent(studentId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setEditingStudentId((id) => (id === studentId ? null : id));
      await refreshStudents();
      await refreshOrgStudents();
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  function startEditStudent(s: Student) {
    setEditingStudentId(s.id);
    setEditFirst((s.first_name ?? "").trim());
    setEditLast((s.last_name ?? "").trim());
    const g = s.gender;
    setEditGender(g === "male" || g === "female" || g === "non_binary" ? g : "");
  }

  function cancelEditStudent() {
    setEditingStudentId(null);
  }

  async function saveEditStudent() {
    if (!editingStudentId) return;
    const fn = editFirst.trim();
    const ln = editLast.trim();
    if (!fn || !ln) {
      alert(t("class.firstLastRequired"));
      return;
    }
    setBusy("edit-stu");
    try {
      const res = await fetch(`${base}/students/${encodeURIComponent(editingStudentId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: fn,
          last_name: ln,
          gender: editGender === "" ? null : editGender,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setEditingStudentId(null);
      await refreshStudents();
      await refreshOrgStudents();
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function moveStudent() {
    if (!moveStudentId || !moveToClassId) return;
    if (moveToClassId === classId) {
      alert(t("class.movePickOtherClass"));
      return;
    }
    const who = students.find((s) => s.id === moveStudentId)?.display_name ?? "this pupil";
    const dest = allClasses.find((c) => c.id === moveToClassId)?.name ?? "the destination class";
    if (!confirm(t("class.moveConfirm", { who, dest }))) return;
    setBusy("move-stu");
    try {
      const res = await fetch(`${base}/students/${encodeURIComponent(moveStudentId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ class_id: moveToClassId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setMoveStudentId("");
      setMoveToClassId("");
      await refreshStudents();
      await refreshOrgStudents();
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  async function deleteWholeClass() {
    if (!confirm(t("tenant.confirmDeleteClass", { name: cName || initialClassName }))) return;
    setBusy("del-class");
    try {
      const res = await fetch(`${base}/classes/${encodeURIComponent(classId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      router.push(`/reports/${tenantId}`);
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  const existingReportHref =
    duplicateReportDialog != null
      ? `/reports/${encodeURIComponent(tenantId)}/classes/${encodeURIComponent(classId)}/reports/${encodeURIComponent(duplicateReportDialog.existingReportId)}`
      : "";

  return (
    <div className="space-y-8">
      {duplicateReportDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-report-dialog-title"
          onClick={() => setDuplicateReportDialog(null)}
        >
          <div
            className="max-w-md rounded-2xl border border-emerald-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="duplicate-report-dialog-title" className="text-base font-semibold text-zinc-900">
              {t("class.duplicateReportTitle")}
            </h3>
            <p className="mt-3 text-sm text-zinc-600">
              {t("class.duplicateReportBody", {
                name: duplicateReportDialog.studentName,
                term: duplicateReportDialog.termLabel,
              })}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={existingReportHref}
                className="inline-flex rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
                onClick={() => setDuplicateReportDialog(null)}
              >
                {t("class.duplicateReportEditExisting")}
              </Link>
              <button
                type="button"
                className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-emerald-50/70"
                onClick={() => setDuplicateReportDialog(null)}
              >
                {t("class.duplicateReportCancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {timetableConflictDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timetable-conflict-dialog-title"
          onClick={() => setTimetableConflictDialog(null)}
        >
          <div
            className="max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="timetable-conflict-dialog-title" className="text-base font-semibold text-zinc-900">
              {t("class.timetableConflictTitle")}
            </h3>
            <p className="mt-3 text-sm text-zinc-600">
              {timetableConflictDialog === "teacher"
                ? t("class.timetableConflictTeacherBody")
                : timetableConflictDialog === "room"
                  ? t("class.timetableConflictRoomBody")
                  : t("class.timetableConflictGenericBody")}
            </p>
            <div className="mt-5">
              <button
                type="button"
                className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
                onClick={() => setTimetableConflictDialog(null)}
              >
                {t("class.timetableConflictOk")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{schoolName}</p>
        <h2 className="text-xl font-semibold text-zinc-900">{cName || initialClassName}</h2>
        <Link
          href={classesListHref(tenantId, viewerRole)}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50/80"
        >
          <ArrowLeft className={ICON_INLINE} aria-hidden />
          {t("class.backToClassesList")}
        </Link>
        <p className="mt-1 text-sm text-zinc-600">
          {viewerRole === "teacher" ? t("class.introTeacher") : t("class.intro")}
        </p>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</div>
      ) : null}

      <section
        className="rounded-2xl border border-emerald-300/80 bg-white p-6 shadow-sm"
        onMouseLeave={() => setClassGuideHoverKey(null)}
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
          <FolderKanban className={ICON_SECTION} aria-hidden />
          {t("tenant.sectionMenuTitle")}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">{t("tenant.sectionMenuHint")}</p>
        <nav
          className="mt-4 flex flex-wrap items-center gap-2"
          aria-label={t("tenant.sectionMenuTitle")}
        >
          {classPanelMenuItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={openClassPanel === id}
              onMouseEnter={() => setClassGuideHoverKey(CLASS_PANEL_GUIDE_KEY[id])}
              onFocus={() => setClassGuideHoverKey(CLASS_PANEL_GUIDE_KEY[id])}
              onClick={() => toggleClassPanel(id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${classPanelButtonClass(id)}`}
            >
              <Icon className={ICON_INLINE} aria-hidden />
              {label}
            </button>
          ))}
          {openClassPanel || classPdfPreview ? (
            <span className="inline-flex shrink-0 items-center font-bold text-emerald-900" aria-hidden>
              <ArrowDown className="h-9 w-9" strokeWidth={2.75} />
            </span>
          ) : null}
        </nav>
        <ClassWorkspaceGuide viewerRole={viewerRole} activeStageKey={classGuideHoverKey ?? undefined} />
        {classPdfPreview ? (
          <InlinePdfPreviewCard
            title={classPdfPreview.title}
            pdfUrl={classPdfPreview.url}
            previewKey={classPdfPreview.key}
            onClose={() => setClassPdfPreview(null)}
          />
        ) : null}
      </section>

      {openClassPanel === "settings" ? (
      <section
        id="class-workspace-panel-settings"
        className="rounded-2xl border border-emerald-300/80 bg-white p-6 shadow-sm"
      >
        <h3 className="text-sm font-semibold text-zinc-900">
          <span className="mr-1" aria-hidden>
            🌐
          </span>
          {t("class.settingsTitle")}
        </h3>
        <form onSubmit={saveClassSettings} className="mt-4 grid gap-4 rounded-xl border border-emerald-100 bg-zinc-50/40 p-4 sm:grid-cols-2">
          {viewerRole === "owner" || viewerRole === "department_head" ? (
            <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs leading-snug text-zinc-700 sm:col-span-2">
              <span className="font-semibold text-zinc-800">{t("class.tipLabel")}: </span>
              {t("class.nameTimetableTip")}
            </p>
          ) : null}
          <label className="block min-w-0 text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-600">{t("class.className")}</span>
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <input
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                className="block w-full max-w-[20rem] rounded-lg border border-emerald-200 px-3 py-2"
                maxLength={30}
                required
              />
            ) : (
              <p className="mt-0 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                {cName.trim() || "—"}
              </p>
            )}
          </label>
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block text-zinc-600">{t("class.scholasticYear")}</span>
            {viewerRole === "teacher" ? (
              <p className="mt-0 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                {scholasticYear.trim() || "—"}
              </p>
            ) : (
              <input
                value={scholasticYear}
                onChange={(e) => setScholasticYear(e.target.value)}
                className="block w-full max-w-[12rem] rounded-lg border border-emerald-200 px-3 py-2"
                placeholder={t("class.scholasticPlaceholder")}
                maxLength={15}
              />
            )}
          </label>
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block text-zinc-600">{classLevelFieldLabel}</span>
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <select
                value={cefr}
                onChange={(e) => setCefr(e.target.value)}
                className="block w-full max-w-[12rem] rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {classLevelOptions.map((x) => (
                  <option key={x} value={x} title={formatClassLevelOptionLabel(uiLang, x, classGradeRubric)}>
                    {trimDisplayLabel(formatClassLevelOptionLabel(uiLang, x, classGradeRubric), 15)}
                  </option>
                ))}
              </select>
            ) : (
              <p
                className="mt-0 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800"
                title={cefr.trim() ? formatClassLevelOptionLabel(uiLang, cefr, classGradeRubric) : ""}
              >
                {cefr.trim() ? trimDisplayLabel(formatClassLevelOptionLabel(uiLang, cefr, classGradeRubric), 15) : "—"}
              </p>
            )}
          </label>
          <label className="block min-w-0 text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-600">Subject</span>
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <>
                <input
                  list={classSubjectListId}
                  value={defSubject}
                  onChange={(e) => setDefSubject(e.target.value)}
                  disabled={busy !== null || subjectListBusy}
                  placeholder={t("tenant.defineSubjectNamePlaceholder")}
                  className="block w-full max-w-[20rem] rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                  autoComplete="off"
                  aria-label="Subject"
                  maxLength={40}
                />
                <datalist id={classSubjectListId}>
                  {classWorkspaceAllSubjectSuggestions.map((label) => (
                    <option key={label} value={label} />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-zinc-500">{t("class.subjectPickerHint")}</p>
              </>
            ) : (
              <p className="mt-0 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                {classDefaultSubjectUiLine(uiLang, detail?.default_subject ?? "efl")}
              </p>
            )}
          </label>
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block text-zinc-600">{t("class.defaultOutputLang")}</span>
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <select
                value={defLang}
                onChange={(e) => setDefLang(e.target.value as ReportLanguageCode)}
                className="block w-full max-w-[20rem] rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                {REPORT_LANGUAGES.map((o) => (
                  <option key={o.code} value={o.code}>
                    {reportLanguageOptionLabel(uiLang, o.code)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-0 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                {reportLanguageOptionLabel(uiLang, defLang)}
              </p>
            )}
          </label>
          {viewerRole === "owner" || viewerRole === "department_head" ? (
            <label className="block min-w-0 text-sm">
              <span className="mb-1 block text-zinc-600">{t("class.roomNumber")}</span>
              <select
                value={preferredRoomNumber}
                onChange={(e) => setPreferredRoomNumber(e.target.value)}
                className="block w-full max-w-[20rem] rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">{t("class.roomNumberUnchanged")}</option>
                {Array.from({ length: timetableRoomCount }, (_, i) => String(i + 1)).map((n) => (
                  <option key={n} value={n}>
                    {t("class.roomNumberOption", { n })}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">{t("class.roomNumberHint")}</p>
            </label>
          ) : null}
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block text-zinc-600">{t("class.lessonPeriodLabel")}</span>
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <>
                <select
                  value={lessonPeriodSelect}
                  onChange={(e) => setLessonPeriodSelect(e.target.value)}
                  className="block w-full max-w-[12rem] rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">{t("class.lessonPeriodUnset")}</option>
                  {lessonPeriodOptions.map((o) => (
                    <option key={o.value} value={o.value} title={o.label}>
                      {trimDisplayLabel(o.label, 15)}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="mt-0 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                {(() => {
                  const pref = detail?.preferred_lesson_period_index;
                  if (typeof pref !== "number" || !Number.isFinite(pref)) return "—";
                  const n = Math.floor(pref);
                  const total = timetablePeriodsAm + timetablePeriodsPm;
                  if (n < 0 || n >= total) return "—";
                  return trimDisplayLabel(labelForLessonPeriodIndex(timetablePeriodsAm, timetablePeriodsPm, n, t), 15);
                })()}
              </p>
            )}
          </label>
          <label className="block min-w-0 text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-600">{t("class.reportsPerCourseLabel")}</span>
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <>
                <select
                  value={defNewReportKind}
                  onChange={(e) => setDefNewReportKind(e.target.value as ReportKind)}
                  className="block w-full max-w-[20rem] rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="standard" title={t("class.reportKindStandard")}>
                    {trimDisplayLabel(t("class.reportKindStandard"), 30)}
                  </option>
                  <option value="short_course" title={t("class.reportKindShortCourse")}>
                    {trimDisplayLabel(t("class.reportKindShortCourse"), 30)}
                  </option>
                </select>
                <p className="mt-1 text-xs text-zinc-500">{t("class.defaultNewReportKindHint")}</p>
              </>
            ) : (
              <>
                <p className="mt-0 max-w-xl rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                  {defNewReportKind === "short_course"
                    ? t("class.reportKindShortCourse")
                    : t("class.reportKindStandard")}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{t("class.defaultNewReportKindHint")}</p>
              </>
            )}
          </label>
          <div className="text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-600">{t("class.activeDaysLabel")}</span>
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  {WEEKDAY_KEYS.map((k) => {
                    const selected = activeDays.includes(k);
                    return (
                      <label
                        key={k}
                        className={`inline-flex cursor-pointer select-none items-center rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2 ${
                          selected
                            ? "border-emerald-600 bg-emerald-100 font-semibold text-emerald-950 shadow-sm"
                            : "border-zinc-200 bg-white font-normal text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            setActiveDays((prev) => {
                              const on = prev.includes(k);
                              const raw = on ? prev.filter((d) => d !== k) : [...prev, k];
                              return WEEKDAY_KEYS.filter((d) => raw.includes(d));
                            });
                          }}
                          className="sr-only"
                        />
                        {t(`weekday.${k}`)}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-800">{t("class.activeDaysDisplay")}: </span>
                  {WEEKDAY_KEYS.filter((k) => activeDays.includes(k))
                    .map((k) => t(`weekday.${k}`))
                    .join(", ") || "—"}
                </p>
              </>
            ) : (
              <p className="mt-0 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                {WEEKDAY_KEYS.filter((k) => activeDays.includes(k))
                  .map((k) => t(`weekday.${k}`))
                  .join(", ") || "—"}
              </p>
            )}
          </div>
          {viewerRole === "teacher" ? (
            <div className="space-y-2 text-xs leading-snug text-zinc-500 sm:col-span-2">
              <p>{t("class.coreSettingsReadonlyHint")}</p>
              <p>{t("class.teacherPerReportOutputLangHint")}</p>
            </div>
          ) : null}
          {viewerRole === "owner" || viewerRole === "department_head" ? (
            <div className="sm:col-span-2 max-w-[20rem]">
              <h4 id="class-teacher-heading" className="mb-1 block text-sm font-semibold text-zinc-900">
                {t("class.teacherHeading")}
              </h4>
              <select
                id="class-assigned-teacher"
                value={assignTeacher}
                onChange={(e) => setAssignTeacher(e.target.value)}
                className="block w-full max-w-[20rem] rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                aria-labelledby="class-teacher-heading"
              >
                <option value="">{t("class.notAssigned")}</option>
                {assignTeacher && !teachers.some((x) => x.email === assignTeacher) ? (
                  <option
                    value={assignTeacher}
                    title={`${assignedTeacherLabelInSettings ?? t("class.teacherNameNotSet")} ${t("class.currentSuffix")}`}
                  >
                    {trimDisplayLabel(
                      `${assignedTeacherLabelInSettings ?? t("class.teacherNameNotSet")} ${t("class.currentSuffix")}`,
                      30,
                    )}
                  </option>
                ) : null}
                {teachers.map((x) => {
                  const name = formatTeacherNameParts(x.first_name, x.last_name) ?? t("class.teacherNameNotSet");
                  const roleSuffix =
                    x.role === "owner"
                      ? ` — ${t("roster.roleOwner")}`
                      : x.role === "department_head"
                        ? ` — ${t("roster.roleDeptShort")}`
                        : x.role === "teacher"
                          ? ` — ${t("roster.roleTeacher")}`
                          : "";
                  return (
                    <option key={x.email} value={x.email} title={`${name}${roleSuffix}`}>
                      {trimDisplayLabel(`${name}${roleSuffix}`, 30)}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-xs text-zinc-500">{t("class.assignedTeacherHint")}</p>
            </div>
          ) : detail?.assigned_teacher_email ? (
            <div className="sm:col-span-2">
              <h4 className="text-sm font-semibold text-zinc-900">{t("class.teacherHeading")}</h4>
              <p className="mt-1 text-sm text-zinc-700" title={assignedTeacherLabelInSettings ?? ""}>
                {trimDisplayLabel(assignedTeacherLabelInSettings ?? "—", 30)}
              </p>
            </div>
          ) : null}
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <button
                type="submit"
                disabled={busy !== null || !detail}
                className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {t("class.saveSettings")}
              </button>
            ) : null}
            {canDeleteClass ? (
              <button
                type="button"
                disabled={busy !== null || !detail}
                onClick={() => void deleteWholeClass()}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
              >
                {t("class.deleteClass")}
              </button>
            ) : null}
          </div>
        </form>
      </section>
      ) : null}

      {openClassPanel === "students" ? (
      <section
        id="class-workspace-panel-students"
        className="rounded-2xl border border-emerald-300/80 bg-white p-6 shadow-sm"
      >
        <h3 className="text-sm font-semibold text-zinc-900">{t("class.studentsTitle")}</h3>
        <Link
          href={classesListHref(tenantId, viewerRole)}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50/80"
        >
          <ArrowLeft className={ICON_INLINE} aria-hidden />
          {t("class.backToClassesList")}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-x-[2ch] gap-y-2 text-sm">
          <span className="text-zinc-600">{t("class.makeReportsForLabel")}</span>
          {viewerRole === "owner" || viewerRole === "department_head" ? (
            <select
              value={defNewReportPeriod}
              onChange={(e) => void saveDefaultNewReportPeriod(e.target.value as ReportPeriod)}
              disabled={busy !== null || defNewReportKind === "short_course"}
              title={
                defNewReportKind === "short_course" ? t("class.makeReportsForDisabledShortCourse") : undefined
              }
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="first">{t("class.newReportPeriodFirst")}</option>
              <option value="second">{t("class.newReportPeriodSecond")}</option>
              <option value="third">{t("class.newReportPeriodThird")}</option>
            </select>
          ) : defNewReportKind === "short_course" ? (
            <span className="text-sm text-zinc-400">—</span>
          ) : (
            <span className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
              {defNewReportPeriod === "first"
                ? t("class.newReportPeriodFirst")
                : defNewReportPeriod === "second"
                  ? t("class.newReportPeriodSecond")
                  : t("class.newReportPeriodThird")}
            </span>
          )}
        </div>
        <form onSubmit={addStudent} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block text-zinc-600">{t("class.firstName")}</span>
            <input
              value={newFirst}
              onChange={(e) => setNewFirst(e.target.value)}
              className="block w-full rounded-lg border border-emerald-200 px-3 py-2"
              required
            />
          </label>
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block text-zinc-600">{t("class.lastName")}</span>
            <input
              value={newLast}
              onChange={(e) => setNewLast(e.target.value)}
              className="block w-full rounded-lg border border-emerald-200 px-3 py-2"
              required
            />
          </label>
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block text-zinc-600">{t("class.genderOptional")}</span>
            <select
              value={newGender}
              onChange={(e) => setNewGender(e.target.value as typeof newGender)}
              className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="male">{t("class.genderMale")}</option>
              <option value="female">{t("class.genderFemale")}</option>
              <option value="non_binary">{t("class.genderNonBinaryOpt")}</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={busy !== null}
              className="w-full rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
            >
              {t("class.addPupil")}
            </button>
          </div>
          {duplicatePupilWarningText ? (
            <div
              role="status"
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 sm:col-span-2 lg:col-span-4"
            >
              {duplicatePupilWarningText}
            </div>
          ) : null}
        </form>

        <ul className="mt-4 divide-y divide-emerald-100">
          {students.map((s) => (
            <li
              key={s.id}
              id={`class-student-row-${s.id}`}
              className={`py-3 ${
                initialFocusStudentId && s.id === initialFocusStudentId
                  ? "scroll-mt-24 rounded-lg bg-emerald-50/80 px-2 ring-2 ring-emerald-400/50"
                  : ""
              }`}
            >
              {editingStudentId === s.id ? (
                <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block min-w-0 text-sm">
                      <span className="mb-1 block text-zinc-600">{t("class.firstName")}</span>
                      <input
                        value={editFirst}
                        onChange={(e) => setEditFirst(e.target.value)}
                        className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2"
                        autoComplete="given-name"
                      />
                    </label>
                    <label className="block min-w-0 text-sm">
                      <span className="mb-1 block text-zinc-600">{t("class.lastName")}</span>
                      <input
                        value={editLast}
                        onChange={(e) => setEditLast(e.target.value)}
                        className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2"
                        autoComplete="family-name"
                      />
                    </label>
                    <label className="block min-w-0 text-sm">
                      <span className="mb-1 block text-zinc-600">{t("class.genderOptional")}</span>
                      <select
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value as typeof editGender)}
                        className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">—</option>
                        <option value="male">{t("class.genderMale")}</option>
                        <option value="female">{t("class.genderFemale")}</option>
                        <option value="non_binary">{t("class.genderNonBinaryOpt")}</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void saveEditStudent()}
                      className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {t("class.savePupilEdits")}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={cancelEditStudent}
                      className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-emerald-50/70 disabled:opacity-50"
                    >
                      {t("class.cancelPupilEdit")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-zinc-900">{s.display_name}</span>
                    <button
                      type="button"
                      disabled={busy !== null || editingStudentId !== null}
                      onClick={() => startEditStudent(s)}
                      className="shrink-0 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {t("class.editPupil")}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {reportsByStudent(s.id).map((r) => {
                      const repInputs = parseReportInputs(r.inputs);
                      if (isShortCourseReport(repInputs)) {
                        return (
                          <Link
                            key={r.id}
                            href={`/reports/${tenantId}/classes/${classId}/reports/${r.id}`}
                            className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-sm text-zinc-800 hover:bg-emerald-100"
                            aria-label={t("class.shortCourseReportLink")}
                          >
                            {t("class.shortCourseReportLink")}
                          </Link>
                        );
                      }
                      const n = reportPeriodTermNumber(repInputs.report_period);
                      const aria = t("class.reportEditTermAria", { n });
                      return (
                        <Link
                          key={r.id}
                          href={`/reports/${tenantId}/classes/${classId}/reports/${r.id}`}
                          className="inline-flex min-w-[2.25rem] items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-sm font-semibold tabular-nums text-zinc-800 hover:bg-emerald-100"
                          aria-label={aria}
                          title={aria}
                        >
                          {String(n)}
                        </Link>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => handleClickNewReport(s)}
                      disabled={busy !== null || editingStudentId !== null}
                      className="rounded-lg border border-dashed border-emerald-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-emerald-50/70 disabled:opacity-50"
                    >
                      {t("class.newReport")}
                    </button>
                    {canDeleteStudent ? (
                      <button
                        type="button"
                        disabled={busy !== null || editingStudentId !== null}
                        onClick={() => void deleteStudentRow(s.id, s.display_name)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-900 hover:bg-red-100 disabled:opacity-50"
                      >
                        {t("class.deletePupil")}
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {students.length === 0 ? <p className="mt-2 text-sm text-zinc-500">{t("class.noPupils")}</p> : null}
      </section>
      ) : null}

      {openClassPanel === "bulkDownload" ? (
        <section
          id="class-workspace-panel-bulkDownload"
          className="rounded-2xl border border-emerald-300/80 bg-white p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-zinc-900">{t("class.printClassReports")}</h3>
          <p className="mt-1 text-xs text-zinc-500">{t("class.bulkDownloadPanelHint")}</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="block min-w-0 text-sm">
              <span className="mb-1 block text-zinc-600">{t("class.bulkDownloadSelectLabel")}</span>
              <select
                value={batchTermFilter}
                onChange={(e) => setBatchTermFilter(e.target.value as ReportPeriod)}
                className="block rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                <option value="first">{t("archive.term1")}</option>
                <option value="second">{t("archive.term2")}</option>
                <option value="third">{t("archive.term3")}</option>
              </select>
            </label>
            {classBulkPdfGate.canDownload ? (
              <>
                <button
                  type="button"
                  aria-pressed={classPdfPreview?.id === CLASS_BULK_PDF_ID}
                  onClick={() =>
                    previewClassPdf(CLASS_BULK_PDF_ID, batchHref, t("class.printReport"))
                  }
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    classPdfPreview?.id === CLASS_BULK_PDF_ID
                      ? "border-emerald-600 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-400/60"
                      : "border-emerald-200 bg-white text-zinc-800 hover:bg-emerald-50"
                  } disabled:opacity-50`}
                >
                  <Printer className={ICON_INLINE} aria-hidden />
                  {t("class.printReport")}
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <span
                  className="inline-flex cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-400"
                  title={classBulkPdfGate.message}
                >
                  {t("class.printReport")}
                </span>
                <p className="max-w-md text-xs text-amber-800">{classBulkPdfGate.message}</p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {openClassPanel === "locateFromActive" && (viewerRole === "owner" || viewerRole === "department_head") ? (
        <section
          id="class-workspace-panel-locateFromActive"
          className="rounded-2xl border border-emerald-300/80 bg-white p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-zinc-900">{t("class.locateFromActiveTitle")}</h3>
          <p className="mt-1 text-sm text-zinc-600">{t("class.locateFromActiveHint")}</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block min-w-0 flex-1 text-sm sm:max-w-md">
              <span className="mb-1 block text-zinc-600">{t("class.locateFromActivePick")}</span>
              <select
                value={locateSchoolStudentId}
                onChange={(e) => setLocateSchoolStudentId(e.target.value)}
                className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {locateCandidates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.display_name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy !== null || !locateSchoolStudentId}
              onClick={() => void locateFromActiveList()}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {t("class.locateFromActiveButton")}
            </button>
          </div>
          {locateCandidates.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500">{t("dash.activeStudentsEmpty")}</p>
          ) : null}
        </section>
      ) : null}

      {openClassPanel === "movePupil" && (viewerRole === "owner" || viewerRole === "department_head") ? (
        <section
          id="class-workspace-panel-movePupil"
          className="rounded-2xl border border-emerald-300/80 bg-white p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-zinc-900">{t("class.movePupilSectionTitle")}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block min-w-0 text-sm">
              <span className="mb-1 block text-zinc-600">{t("class.movePupilLabel")}</span>
              <select
                value={moveStudentId}
                onChange={(e) => setMoveStudentId(e.target.value)}
                className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0 text-sm">
              <span className="mb-1 block text-zinc-600">{t("class.moveDestinationLabel")}</span>
              <select
                value={moveToClassId}
                onChange={(e) => setMoveToClassId(e.target.value)}
                className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {allClasses
                  .filter((c) => c.id !== classId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                disabled={busy !== null || !moveStudentId || !moveToClassId}
                onClick={() => void moveStudent()}
                className="w-full rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
              >
                {t("class.movePupilButton")}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">{t("class.movePupilFootnote")}</p>
        </section>
      ) : null}

      {openClassPanel === "registerPreview" ? (
        <section
          id="class-workspace-panel-registerPreview"
          className="rounded-2xl border border-emerald-300/80 bg-white p-6 shadow-sm"
        >
          {registerPdfGate.canPrint ? (
            <InlinePdfPreviewCard
              title={t("class.registerMenu")}
              pdfUrl={registerPdfHref}
              previewKey={registerPreviewKey}
              onClose={() => setOpenClassPanel(null)}
            />
          ) : (
            <>
              <h3 className="text-sm font-semibold text-zinc-900">{t("class.registerMenu")}</h3>
              <p className="mt-2 text-sm text-amber-800" role="alert">
                {registerPdfGate.message}
              </p>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
