"use client";

import {
  ArrowLeftRight,
  FolderKanban,
  Printer,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { reportLanguageOptionLabel, subjectLabelLocalized } from "@/lib/i18n/uiStrings";
import { REPORT_LANGUAGES, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import {
  type ReportKind,
  type ReportPeriod,
  isShortCourseReport,
  parseReportInputs,
  reportPeriodTermNumber,
} from "@/lib/reportInputs";
import { REPORT_SUBJECTS, type SubjectCode } from "@/lib/subjects";
import { WEEKDAY_KEYS, type WeekdayKey, isWeekdayKey } from "@/lib/activeWeekdays";
import { classesListHref } from "@/lib/app/classesNavigation";
import { openPdfForPrint } from "@/lib/app/openPdfForPrint";
import { ICON_INLINE, ICON_SECTION } from "@/components/ui/iconSizes";
import type { RomRole } from "@/lib/data/memberships";
import { CLASS_SETTINGS_SAVED_EVENT, type ClassSettingsSavedDetail } from "@/lib/appEvents";

type ClassWorkspacePanelId =
  | "settings"
  | "students"
  | "bulkDownload"
  | "movePupil"
  | "registerPreview";

const CLASS_PANEL_ICON: Record<ClassWorkspacePanelId, LucideIcon> = {
  settings: Settings2,
  students: Users,
  bulkDownload: Printer,
  movePupil: ArrowLeftRight,
  registerPreview: Printer,
};

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
  default_output_language: string;
  default_new_report_kind?: ReportKind;
  default_new_report_period?: ReportPeriod;
  assigned_teacher_email: string | null;
  /** From membership; used for display (never show raw email in class settings). */
  assigned_teacher_first_name?: string | null;
  assigned_teacher_last_name?: string | null;
  active_weekdays: WeekdayKey[];
};

type ClassListRow = { id: string; name: string };

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

const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

function formatTeacherNameParts(first: string | null | undefined, last: string | null | undefined): string | null {
  const fn = (first ?? "").trim();
  const ln = (last ?? "").trim();
  const full = `${fn} ${ln}`.trim();
  if (full) return full;
  if (fn) return fn;
  if (ln) return ln;
  return null;
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
  const batchBase = `${base}/classes/${encodeURIComponent(classId)}/pdf-batch`;
  const [batchTermFilter, setBatchTermFilter] = useState<ReportPeriod>("first");

  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

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

  const openClassBulkPdfPreview = useCallback(() => {
    openPdfForPrint(batchHref);
  }, [batchHref]);

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
  const [defSubject, setDefSubject] = useState<SubjectCode>("efl");
  const [defLang, setDefLang] = useState<ReportLanguageCode>("en");
  const [defNewReportKind, setDefNewReportKind] = useState<ReportKind>("standard");
  const [defNewReportPeriod, setDefNewReportPeriod] = useState<ReportPeriod>("first");
  const [assignTeacher, setAssignTeacher] = useState("");
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [allClasses, setAllClasses] = useState<ClassListRow[]>([]);
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
    setOpenClassPanel((current) => (current === id ? null : id));
  }, []);

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
        id: "movePupil",
        label: t("class.panelMovePupil"),
        Icon: CLASS_PANEL_ICON.movePupil,
      });
    }
    items.push({
      id: "registerPreview",
      label: t("class.registerPreviewTitle"),
      Icon: CLASS_PANEL_ICON.registerPreview,
    });
    return items;
  }, [t, viewerRole]);

  const loadClass = useCallback(async () => {
    const reqId = ++loadClassRequestId.current;
    try {
      const res = await fetch(`${base}/classes/${encodeURIComponent(classId)}`);
      const data = await res.json().catch(() => ({}));
      if (reqId !== loadClassRequestId.current) return;
      if (!res.ok) throw new Error(data.error || t("class.errLoadClass"));
      const c = data.class as ClassDetail;
      setDetail(c);
      setCName(c.name);
      setScholasticYear(c.scholastic_year?.trim() ?? "");
      setCefr(c.cefr_level ?? "");
      setDefSubject((c.default_subject as SubjectCode) || "efl");
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
    } catch (e: unknown) {
      if (reqId !== loadClassRequestId.current) return;
      setLoadError(e instanceof Error ? e.message : t("class.errLoadClass"));
    }
  }, [base, classId, t]);

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
          default_subject: defSubject,
          default_output_language: defLang,
          default_new_report_kind: defNewReportKind,
          default_new_report_period: defNewReportPeriod,
          active_weekdays: activeDays,
          assigned_teacher_email: assignTeacher.trim() ? assignTeacher.trim().toLowerCase() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
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

  async function createReport(studentId: string) {
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

  const canDeleteStudent =
    viewerRole === "owner" || viewerRole === "department_head" || viewerRole === "teacher";
  const canDeleteClass = viewerRole === "owner" || viewerRole === "department_head";

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

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{schoolName}</p>
        <h2 className="text-xl font-semibold text-zinc-900">{cName || initialClassName}</h2>
        <Link
          href={classesListHref(tenantId, viewerRole)}
          className="mt-1 inline-flex items-center text-sm font-medium text-emerald-800 hover:text-emerald-950"
        >
          <span className="mr-1" aria-hidden>
            ←
          </span>
          {t("class.backToClassesList")}
        </Link>
        <p className="mt-1 text-sm text-zinc-600">
          {viewerRole === "teacher" ? t("class.introTeacher") : t("class.intro")}
        </p>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</div>
      ) : null}

      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
          <FolderKanban className={ICON_SECTION} aria-hidden />
          {t("tenant.sectionMenuTitle")}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">{t("tenant.sectionMenuHint")}</p>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label={t("tenant.sectionMenuTitle")}>
          {classPanelMenuItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={openClassPanel === id}
              onClick={() => toggleClassPanel(id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${classPanelButtonClass(id)}`}
            >
              <Icon className={ICON_INLINE} aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      </section>

      {openClassPanel === "settings" ? (
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">
          <span className="mr-1" aria-hidden>
            🌐
          </span>
          {t("class.settingsTitle")}
        </h3>
        <form onSubmit={saveClassSettings} className="mt-4 grid gap-4 sm:grid-cols-2">
          {viewerRole === "owner" || viewerRole === "department_head" ? (
            <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs leading-snug text-zinc-700 sm:col-span-2">
              <span className="font-semibold text-zinc-800">{t("class.tipLabel")}: </span>
              {t("class.nameTimetableTip")}
            </p>
          ) : null}
          <label className="text-sm sm:col-span-2">
            <span className="text-zinc-600">{t("class.className")}</span>
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <input
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2"
                required
              />
            ) : (
              <p className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                {cName.trim() || "—"}
              </p>
            )}
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">{t("class.scholasticYear")}</span>
            {viewerRole === "teacher" ? (
              <p className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                {scholasticYear.trim() || "—"}
              </p>
            ) : (
              <input
                value={scholasticYear}
                onChange={(e) => setScholasticYear(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2"
                placeholder={t("class.scholasticPlaceholder")}
              />
            )}
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">{t("class.cefr")}</span>
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <select
                value={cefr}
                onChange={(e) => setCefr(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {CEFR.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                {cefr.trim() || "—"}
              </p>
            )}
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">{t("class.defaultSubject")}</span>
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <select
                value={defSubject}
                onChange={(e) => setDefSubject(e.target.value as SubjectCode)}
                className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                {REPORT_SUBJECTS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {subjectLabelLocalized(uiLang, s.code)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                {subjectLabelLocalized(uiLang, defSubject)}
              </p>
            )}
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">{t("class.defaultOutputLang")}</span>
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <select
                value={defLang}
                onChange={(e) => setDefLang(e.target.value as ReportLanguageCode)}
                className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                {REPORT_LANGUAGES.map((o) => (
                  <option key={o.code} value={o.code}>
                    {reportLanguageOptionLabel(uiLang, o.code)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                {reportLanguageOptionLabel(uiLang, defLang)}
              </p>
            )}
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-zinc-600">{t("class.defaultNewReportKind")}</span>
            {viewerRole === "owner" || viewerRole === "department_head" ? (
              <>
                <select
                  value={defNewReportKind}
                  onChange={(e) => setDefNewReportKind(e.target.value as ReportKind)}
                  className="mt-1 w-full max-w-xl rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="standard">{t("class.reportKindStandard")}</option>
                  <option value="short_course">{t("class.reportKindShortCourse")}</option>
                </select>
                <p className="mt-1 text-xs text-zinc-500">{t("class.defaultNewReportKindHint")}</p>
              </>
            ) : (
              <>
                <p className="mt-1 max-w-xl rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                  {defNewReportKind === "short_course"
                    ? t("class.reportKindShortCourse")
                    : t("class.reportKindStandard")}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{t("class.defaultNewReportKindHint")}</p>
              </>
            )}
          </label>
          <div className="text-sm sm:col-span-2">
            <span className="text-zinc-600">{t("class.activeDaysLabel")}</span>
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
              <p className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
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
            <div className="sm:col-span-2">
              <h4 id="class-teacher-heading" className="text-sm font-semibold text-zinc-900">
                {t("class.teacherHeading")}
              </h4>
              <select
                value={assignTeacher}
                onChange={(e) => setAssignTeacher(e.target.value)}
                className="mt-2 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                aria-labelledby="class-teacher-heading"
              >
                <option value="">{t("class.notAssigned")}</option>
                {assignTeacher && !teachers.some((x) => x.email === assignTeacher) ? (
                  <option value={assignTeacher}>
                    {assignedTeacherLabelInSettings ?? t("class.teacherNameNotSet")} {t("class.currentSuffix")}
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
                    <option key={x.email} value={x.email}>
                      {name}
                      {roleSuffix}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-xs text-zinc-500">{t("class.assignedTeacherHint")}</p>
            </div>
          ) : detail?.assigned_teacher_email ? (
            <div className="sm:col-span-2">
              <h4 className="text-sm font-semibold text-zinc-900">{t("class.teacherHeading")}</h4>
              <p className="mt-1 text-sm text-zinc-700">{assignedTeacherLabelInSettings}</p>
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
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">{t("class.studentsTitle")}</h3>
        <Link
          href={classesListHref(tenantId, viewerRole)}
          className="mt-1 inline-block text-sm font-medium text-emerald-800 hover:text-emerald-950 hover:underline"
        >
          {t("class.backToClassesList")}
        </Link>
        <p className="mt-2 text-xs text-zinc-500">{t("class.studentsHint")}</p>
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
        <p className="mt-1 text-xs text-zinc-500">{t("class.makeReportsForHint")}</p>
        <form onSubmit={addStudent} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="text-zinc-600">{t("class.firstName")}</span>
            <input
              value={newFirst}
              onChange={(e) => setNewFirst(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">{t("class.lastName")}</span>
            <input
              value={newLast}
              onChange={(e) => setNewLast(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">{t("class.genderOptional")}</span>
            <select
              value={newGender}
              onChange={(e) => setNewGender(e.target.value as typeof newGender)}
              className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
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
                    <label className="text-sm">
                      <span className="text-zinc-600">{t("class.firstName")}</span>
                      <input
                        value={editFirst}
                        onChange={(e) => setEditFirst(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2"
                        autoComplete="given-name"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-zinc-600">{t("class.lastName")}</span>
                      <input
                        value={editLast}
                        onChange={(e) => setEditLast(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2"
                        autoComplete="family-name"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-zinc-600">{t("class.genderOptional")}</span>
                      <select
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value as typeof editGender)}
                        className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
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
                      onClick={() => void createReport(s.id)}
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
        <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900">{t("class.printClassReports")}</h3>
          <p className="mt-1 text-xs text-zinc-500">{t("class.bulkDownloadPanelHint")}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="inline-flex flex-row flex-wrap items-center gap-[2ch] text-sm">
              <span className="shrink-0 text-zinc-600">{t("class.bulkDownloadSelectLabel")}</span>
              <select
                value={batchTermFilter}
                onChange={(e) => setBatchTermFilter(e.target.value as ReportPeriod)}
                className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
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
                  onClick={() => openClassBulkPdfPreview()}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <Printer className={ICON_INLINE} aria-hidden />
                  {t("common.printPdf")}
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <span
                  className="inline-flex cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-400"
                  title={classBulkPdfGate.message}
                >
                  {t("common.printPdf")}
                </span>
                <p className="max-w-md text-xs text-amber-800">{classBulkPdfGate.message}</p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {openClassPanel === "movePupil" && (viewerRole === "owner" || viewerRole === "department_head") ? (
        <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900">{t("class.movePupilSectionTitle")}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="text-zinc-600">{t("class.movePupilLabel")}</span>
              <select
                value={moveStudentId}
                onChange={(e) => setMoveStudentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-600">{t("class.moveDestinationLabel")}</span>
              <select
                value={moveToClassId}
                onChange={(e) => setMoveToClassId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
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
        <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900">{t("class.registerPreviewTitle")}</h3>
          <p className="mt-1 text-xs text-zinc-500">{t("class.registerPreviewHint")}</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            {registerPdfGate.canPrint ? (
              <button
                type="button"
                onClick={() => openPdfForPrint(registerPdfHref)}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-emerald-50"
              >
                <Printer className={ICON_INLINE} aria-hidden />
                {t("common.printPdf")}
              </button>
            ) : (
              <div className="flex flex-col gap-1">
                <span
                  className="inline-flex cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-400"
                  title={registerPdfGate.message}
                >
                  {t("common.printPdf")}
                </span>
                <p className="max-w-md text-xs text-amber-800">{registerPdfGate.message}</p>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
