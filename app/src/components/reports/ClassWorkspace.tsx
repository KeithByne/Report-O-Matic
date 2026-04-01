"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClassScholasticArchives } from "@/components/reports/ClassScholasticArchives";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { REPORT_LANGUAGES, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import {
  type ClassBulkPdfTermFilter,
  parseReportInputs,
  reportReadyForClassBulkPdf,
} from "@/lib/reportInputs";
import { REPORT_SUBJECTS, type SubjectCode } from "@/lib/subjects";
import { WEEKDAY_KEYS, type WeekdayKey } from "@/lib/activeWeekdays";

function normalizeScholasticYearLabel(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

type Student = {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
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
  assigned_teacher_email: string | null;
  active_weekdays: WeekdayKey[];
};

type ClassListRow = { id: string; name: string };

type ViewerRole = "owner" | "department_head" | "teacher";

type TeacherOption = { email: string; first_name: string | null; last_name: string | null };

type Props = {
  tenantId: string;
  classId: string;
  schoolName: string;
  className: string;
  viewerRole: ViewerRole;
};

const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export function ClassWorkspace({ tenantId, classId, schoolName, className: initialClassName, viewerRole }: Props) {
  const { t, lang: uiLang } = useUiLanguage();
  const router = useRouter();
  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;
  const batchBase = `${base}/classes/${encodeURIComponent(classId)}/pdf-batch`;
  const [batchOrder, setBatchOrder] = useState<"roster" | "student" | "updated_desc" | "updated_asc">("roster");
  const [batchTermFilter, setBatchTermFilter] = useState<ClassBulkPdfTermFilter>("all");

  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  const classBulkPdfGate = useMemo(() => {
    const notFinishedMsg = "You can't download all the class reports until they are all finished.";
    const notFinishedTermMsg = "Every pupil needs a finished report for the selected term.";
    if (students.length === 0) {
      return { canDownload: false as const, message: "Add pupils to this class before downloading a combined PDF." };
    }
    const byStudent = new Map<string, Report[]>();
    for (const r of reports) {
      const arr = byStudent.get(r.student_id) ?? [];
      arr.push(r);
      byStudent.set(r.student_id, arr);
    }
    for (const s of students) {
      const rs = byStudent.get(s.id);
      if (!rs?.length) return { canDownload: false as const, message: notFinishedMsg };
    }
    if (batchTermFilter === "all") {
      if (
        reports.some(
          (r) =>
            !reportReadyForClassBulkPdf({
              status: r.status,
              body: r.body ?? "",
              inputs: parseReportInputs(r.inputs),
            }),
        )
      ) {
        return { canDownload: false as const, message: notFinishedMsg };
      }
      return { canDownload: true as const, message: null as string | null };
    }
    const period = batchTermFilter;
    for (const s of students) {
      const ok = reports.some((r) => {
        if (r.student_id !== s.id) return false;
        const inputs = parseReportInputs(r.inputs);
        if (inputs.report_period !== period) return false;
        return reportReadyForClassBulkPdf({
          status: r.status,
          body: r.body ?? "",
          inputs,
        });
      });
      if (!ok) return { canDownload: false as const, message: notFinishedTermMsg };
    }
    return { canDownload: true as const, message: null as string | null };
  }, [students, reports, batchTermFilter]);

  const batchHref = useMemo(() => {
    const qp = new URLSearchParams();
    if (batchTermFilter !== "all") qp.set("term", batchTermFilter);
    if (batchOrder !== "roster") qp.set("order", batchOrder);
    const s = qp.toString();
    return s ? `${batchBase}?${s}` : batchBase;
  }, [batchBase, batchTermFilter, batchOrder]);

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
  const [assignTeacher, setAssignTeacher] = useState("");
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [allClasses, setAllClasses] = useState<ClassListRow[]>([]);
  const [moveStudentId, setMoveStudentId] = useState("");
  const [moveToClassId, setMoveToClassId] = useState("");

  const [activeDays, setActiveDays] = useState<Set<WeekdayKey>>(() => new Set());

  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newGender, setNewGender] = useState<"" | "male" | "female" | "non_binary">("");

  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [archiveRefresh, setArchiveRefresh] = useState(0);

  const loadClass = useCallback(async () => {
    try {
      const res = await fetch(`${base}/classes/${encodeURIComponent(classId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load class");
      const c = data.class as ClassDetail;
      setDetail(c);
      setCName(c.name);
      setScholasticYear(c.scholastic_year?.trim() ?? "");
      setCefr(c.cefr_level ?? "");
      setDefSubject((c.default_subject as SubjectCode) || "efl");
      setDefLang((c.default_output_language as ReportLanguageCode) || "en");
      setAssignTeacher(c.assigned_teacher_email?.trim() ?? "");
      const aw = Array.isArray(c.active_weekdays) ? c.active_weekdays : [];
      setActiveDays(new Set(aw.filter((x): x is WeekdayKey => WEEKDAY_KEYS.includes(x as WeekdayKey))));
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Failed to load class");
    }
  }, [base, classId]);

  const refreshStudents = useCallback(async () => {
    setLoadError(null);
    try {
      const [sRes, rRes] = await Promise.all([
        fetch(`${base}/students?classId=${encodeURIComponent(classId)}`),
        fetch(`${base}/reports`),
      ]);
      const sData = await sRes.json().catch(() => ({}));
      const rData = await rRes.json().catch(() => ({}));
      if (!sRes.ok) throw new Error(sData.error || "Failed to load students");
      if (!rRes.ok) throw new Error(rData.error || "Failed to load reports");
      setStudents(sData.students ?? []);
      const all = (rData.reports ?? []) as Report[];
      const sid = new Set((sData.students ?? []).map((x: Student) => x.id));
      setReports(all.filter((r) => sid.has(r.student_id)));
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
    }
  }, [base, classId]);

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

  function teacherLabel(t: TeacherOption): string {
    const fn = (t.first_name ?? "").trim();
    const ln = (t.last_name ?? "").trim();
    const name = `${fn} ${ln}`.trim();
    return name || t.email;
  }

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

  async function saveClassSettings(e: React.FormEvent) {
    e.preventDefault();
    const isLead = viewerRole === "owner" || viewerRole === "department_head";
    if (
      isLead &&
      normalizeScholasticYearLabel(scholasticYear) !== normalizeScholasticYearLabel(detail?.scholastic_year ?? null)
    ) {
      const ok = window.confirm(
        "Changing the scholastic year saves a read-only archive of the current year (all pupil reports), then removes those reports so you can start fresh for the new year. Pupils stay in the class. Continue?",
      );
      if (!ok) return;
    }
    setBusy("class-save");
    try {
      const res = await fetch(`${base}/classes/${encodeURIComponent(classId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: cName.trim(),
          ...(isLead ? { scholastic_year: scholasticYear.trim() || null } : {}),
          cefr_level: cefr.trim() || null,
          default_subject: defSubject,
          default_output_language: defLang,
          ...(viewerRole === "owner" || viewerRole === "department_head"
            ? {
                assigned_teacher_email: assignTeacher.trim() ? assignTeacher.trim().toLowerCase() : null,
              }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      await loadClass();
      setArchiveRefresh((n) => n + 1);
      await refreshStudents();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    const fn = newFirst.trim();
    const ln = newLast.trim();
    if (!fn || !ln) {
      alert("First name and last name are required.");
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
      if (!res.ok) throw new Error(data.error || "Failed");
      setNewFirst("");
      setNewLast("");
      setNewGender("");
      await refreshStudents();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function createReport(studentId: string) {
    setBusy("create");
    try {
      const res = await fetch(`${base}/reports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_id: studentId, title: "", body: "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      const rep = data.report as { id: string };
      await refreshStudents();
      router.push(`/reports/${tenantId}/classes/${classId}/reports/${rep.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const reportsByStudent = (sid: string) => reports.filter((r) => r.student_id === sid);

  const canDeleteStudent =
    viewerRole === "owner" || viewerRole === "department_head" || viewerRole === "teacher";
  const canDeleteClass = viewerRole === "owner" || viewerRole === "department_head";

  async function deleteStudentRow(studentId: string, displayName: string) {
    if (!confirm(`Remove ${displayName} from this class? All their reports will be deleted.`)) return;
    setBusy("del-stu");
    try {
      const res = await fetch(`${base}/students/${encodeURIComponent(studentId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      await refreshStudents();
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function moveStudent() {
    if (!moveStudentId || !moveToClassId) return;
    if (moveToClassId === classId) {
      alert("Pick a different destination class.");
      return;
    }
    const who = students.find((s) => s.id === moveStudentId)?.display_name ?? "this pupil";
    const dest = allClasses.find((c) => c.id === moveToClassId)?.name ?? "the destination class";
    if (!confirm(`Move ${who} to ${dest}? Their reports will move with them.`)) return;
    setBusy("move-stu");
    try {
      const res = await fetch(`${base}/students/${encodeURIComponent(moveStudentId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ class_id: moveToClassId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setMoveStudentId("");
      setMoveToClassId("");
      await refreshStudents();
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function deleteWholeClass() {
    if (!confirm(`Delete class "${cName || initialClassName}" and all pupils and reports in it?`)) return;
    setBusy("del-class");
    try {
      const res = await fetch(`${base}/classes/${encodeURIComponent(classId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push(`/reports/${tenantId}`);
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{schoolName}</p>
        <h2 className="text-xl font-semibold text-zinc-900">{cName || initialClassName}</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Set <strong>class name</strong>, <strong>year</strong>, <strong>CEFR</strong>, <strong>subject</strong>, and{" "}
          <strong>default output language</strong> here. The individual report page only overrides when needed.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</div>
      ) : null}

      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">
          <span className="mr-1" aria-hidden>
            🌐
          </span>
          Class settings
        </h3>
        <form onSubmit={saveClassSettings} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="text-zinc-600">Class name</span>
            <input
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">Scholastic year (yyyy – yyyy)</span>
            {viewerRole === "teacher" ? (
              <p className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-zinc-800">
                {scholasticYear.trim() || "—"}
              </p>
            ) : (
              <input
                value={scholasticYear}
                onChange={(e) => setScholasticYear(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2"
                placeholder="e.g. 2024 – 2025"
              />
            )}
            {viewerRole === "teacher" ? (
              <p className="mt-1 text-xs text-zinc-500">Only owners and department heads can change the scholastic year.</p>
            ) : null}
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">Class level (CEFR)</span>
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
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">Default subject</span>
            <select
              value={defSubject}
              onChange={(e) => setDefSubject(e.target.value as SubjectCode)}
              className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
            >
              {REPORT_SUBJECTS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">Default output language</span>
            <select
              value={defLang}
              onChange={(e) => setDefLang(e.target.value as ReportLanguageCode)}
              className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
            >
              {REPORT_LANGUAGES.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm sm:col-span-2">
            <span className="text-zinc-600">{t("class.activeDaysLabel")}</span>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {WEEKDAY_KEYS.map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    checked={activeDays.has(k)}
                    onChange={() => {
                      setActiveDays((prev) => {
                        const next = new Set(prev);
                        if (next.has(k)) next.delete(k);
                        else next.add(k);
                        return next;
                      });
                    }}
                    className="rounded border-emerald-300 text-emerald-800 focus:ring-emerald-600"
                  />
                  {t(`weekday.${k}`)}
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-800">{t("class.activeDaysDisplay")}: </span>
              {WEEKDAY_KEYS.filter((k) => activeDays.has(k))
                .map((k) => t(`weekday.${k}`))
                .join(", ") || "—"}
            </p>
          </div>
          {viewerRole === "owner" || viewerRole === "department_head" ? (
            <label className="text-sm sm:col-span-2">
              <span className="text-zinc-600">Assigned teacher (must match invited teacher email)</span>
              <select
                value={assignTeacher}
                onChange={(e) => setAssignTeacher(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">— Not assigned —</option>
                {assignTeacher && !teachers.some((t) => t.email === assignTeacher) ? (
                  <option value={assignTeacher}>{assignTeacher} (current)</option>
                ) : null}
                {teachers.map((t) => (
                  <option key={t.email} value={t.email}>
                    {teacherLabel(t)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">
                Teachers only see classes assigned to them here. Invite teachers from the dashboard first.
              </p>
            </label>
          ) : detail?.assigned_teacher_email ? (
            <p className="text-sm text-zinc-600 sm:col-span-2">
              <span className="font-medium text-zinc-800">Class assignment: </span>
              {(() => {
                const em = detail.assigned_teacher_email?.trim().toLowerCase() || "";
                const t = teachers.find((x) => x.email === em);
                return t ? teacherLabel(t) : detail.assigned_teacher_email;
              })()}
            </p>
          ) : null}
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy !== null || !detail}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save class settings
            </button>
            {canDeleteClass ? (
              <button
                type="button"
                disabled={busy !== null || !detail}
                onClick={() => void deleteWholeClass()}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
              >
                Delete class
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <ClassScholasticArchives key={archiveRefresh} classId={classId} apiBase={base} />

      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">{t("class.studentsTitle")}</h3>
        <p className="mt-1 text-xs text-zinc-500">{t("class.studentsHint")}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="text-sm">
            <span className="text-zinc-600">{t("class.bulkPdfWhichReports")}</span>
            <select
              value={batchTermFilter}
              onChange={(e) => setBatchTermFilter(e.target.value as ClassBulkPdfTermFilter)}
              className="mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">{t("class.bulkPdfAllReady")}</option>
              <option value="first">{t("archive.term1")}</option>
              <option value="second">{t("archive.term2")}</option>
              <option value="third">{t("archive.term3")}</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">Order</span>
            <select
              value={batchOrder}
              onChange={(e) => setBatchOrder(e.target.value as typeof batchOrder)}
              className="mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
            >
              <option value="roster">Class roster</option>
              <option value="student">Student name</option>
              <option value="updated_desc">Last updated (newest first)</option>
              <option value="updated_asc">Last updated (oldest first)</option>
            </select>
          </label>
          {classBulkPdfGate.canDownload ? (
            <a
              href={batchHref}
              className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-emerald-100"
            >
              Download class PDFs (one file)
            </a>
          ) : (
            <div className="flex flex-col gap-1">
              <span
                className="inline-flex cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-400"
                title={classBulkPdfGate.message}
              >
                Download class PDFs (one file)
              </span>
              <p className="max-w-md text-xs text-amber-800">{classBulkPdfGate.message}</p>
            </div>
          )}
          {registerPdfGate.canPrint ? (
            <a
              href={registerPdfHref}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-emerald-50"
            >
              {t("class.printRegister")}
            </a>
          ) : (
            <div className="flex flex-col gap-1">
              <span
                className="inline-flex cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-400"
                title={registerPdfGate.message}
              >
                {t("class.printRegister")}
              </span>
              <p className="max-w-md text-xs text-amber-800">{registerPdfGate.message}</p>
            </div>
          )}
        </div>
        <form onSubmit={addStudent} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="text-zinc-600">First name(s)</span>
            <input
              value={newFirst}
              onChange={(e) => setNewFirst(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">Last name(s)</span>
            <input
              value={newLast}
              onChange={(e) => setNewLast(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">Gender (optional)</span>
            <select
              value={newGender}
              onChange={(e) => setNewGender(e.target.value as typeof newGender)}
              className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={busy !== null}
              className="w-full rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
            >
              Add pupil
            </button>
          </div>
        </form>

        {viewerRole === "owner" || viewerRole === "department_head" ? (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Move pupil to another class</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="text-zinc-600">Pupil</span>
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
                <span className="text-zinc-600">Destination class</span>
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
                  Move pupil
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              This keeps the pupil’s reports and data intact, and logs a “moved” event for dashboard stats.
            </p>
          </div>
        ) : null}

        <ul className="mt-4 divide-y divide-emerald-100">
          {students.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="font-medium text-zinc-900">{s.display_name}</div>
              <div className="flex flex-wrap items-center gap-2">
                {reportsByStudent(s.id).map((r) => (
                  <Link
                    key={r.id}
                    href={`/reports/${tenantId}/classes/${classId}/reports/${r.id}`}
                    className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-sm text-zinc-800 hover:bg-emerald-100"
                  >
                    Report
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => void createReport(s.id)}
                  disabled={busy !== null}
                  className="rounded-lg border border-dashed border-emerald-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-emerald-50/70"
                >
                  + New report
                </button>
                {canDeleteStudent ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void deleteStudentRow(s.id, s.display_name)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-900 hover:bg-red-100 disabled:opacity-50"
                  >
                    Delete pupil
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {students.length === 0 ? <p className="mt-2 text-sm text-zinc-500">No pupils yet — add one above.</p> : null}
      </section>
    </div>
  );
}
