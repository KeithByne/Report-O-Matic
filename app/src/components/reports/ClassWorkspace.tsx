"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ClassScholasticArchives } from "@/components/reports/ClassScholasticArchives";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { REPORT_LANGUAGES, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { REPORT_SUBJECTS, type SubjectCode } from "@/lib/subjects";

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
};

type ViewerRole = "owner" | "department_head" | "teacher";

type Props = {
  tenantId: string;
  classId: string;
  schoolName: string;
  className: string;
  viewerRole: ViewerRole;
};

const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export function ClassWorkspace({ tenantId, classId, schoolName, className: initialClassName, viewerRole }: Props) {
  const { t } = useUiLanguage();
  const router = useRouter();
  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;

  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  const [cName, setCName] = useState(initialClassName);
  const [scholasticYear, setScholasticYear] = useState("");
  const [cefr, setCefr] = useState("");
  const [defSubject, setDefSubject] = useState<SubjectCode>("efl");
  const [defLang, setDefLang] = useState<ReportLanguageCode>("en");
  const [assignTeacher, setAssignTeacher] = useState("");
  const [teacherEmails, setTeacherEmails] = useState<string[]>([]);

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
        if (res.ok && Array.isArray(data.teachers)) setTeacherEmails(data.teachers as string[]);
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
          {viewerRole === "owner" || viewerRole === "department_head" ? (
            <label className="text-sm sm:col-span-2">
              <span className="text-zinc-600">Assigned teacher (must match invited teacher email)</span>
              <select
                value={assignTeacher}
                onChange={(e) => setAssignTeacher(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">— Not assigned —</option>
                {assignTeacher && !teacherEmails.some((em) => em === assignTeacher) ? (
                  <option value={assignTeacher}>{assignTeacher} (current)</option>
                ) : null}
                {teacherEmails.map((em) => (
                  <option key={em} value={em}>
                    {em}
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
              {detail.assigned_teacher_email}
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
        <h3 className="text-sm font-semibold text-zinc-900">Students in this class</h3>
        <p className="mt-1 text-xs text-zinc-500">{t("class.studentsHint")}</p>
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
