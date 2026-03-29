"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import {
  allTermsComplete,
  DATASET4_METRICS,
  type Dataset4MetricKey,
  type ReportInputs,
  type ReportPeriod,
  type TermGrades,
  emptyReportInputs,
  parseReportInputs,
  termAveragePercent,
} from "@/lib/reportInputs";
import { isReportLanguageCode, REPORT_LANGUAGES, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { metricLabel } from "@/lib/i18n/uiStrings";
import { REPORT_SUBJECTS, subjectLabel, type SubjectCode } from "@/lib/subjects";

type Student = {
  id: string;
  display_name: string;
  class_id: string;
  first_name: string | null;
  last_name: string | null;
  gender: "male" | "female" | "non_binary" | null;
};

type ClassInfo = {
  id: string;
  name: string;
  scholastic_year: string | null;
  cefr_level: string | null;
  default_subject: string;
  default_output_language: string;
};

type Report = {
  id: string;
  student_id: string;
  title: string | null;
  body: string;
  body_teacher_preview: string;
  teacher_preview_language: ReportLanguageCode;
  status: "draft" | "final";
  output_language: ReportLanguageCode;
  inputs: ReportInputs;
  updated_at: string;
};

type Props = { tenantId: string; classId: string; reportId: string; schoolName: string };

function reportPeriodToTermIndex(rp: ReportPeriod): 0 | 1 | 2 {
  if (rp === "first") return 0;
  if (rp === "second") return 1;
  return 2;
}

function GradeSelect({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <select
      value={value === null ? "" : String(value)}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : parseInt(v, 10));
      }}
      className={`mt-1 w-full min-w-[4.5rem] rounded-lg border px-2 py-1.5 text-sm ${
        value === null ? "border-emerald-200/70 bg-emerald-50/50 text-zinc-500" : "border-emerald-400 bg-emerald-50 text-emerald-950"
      }`}
    >
      <option value="">—</option>
      {Array.from({ length: 11 }, (_, n) => (
        <option key={n} value={String(n)}>
          {n}
        </option>
      ))}
    </select>
  );
}

export function ReportEditor({ tenantId, classId, reportId, schoolName }: Props) {
  const { lang, t } = useUiLanguage();
  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;

  function termHeading(idx: 0 | 1 | 2): string {
    return [t("archive.term1"), t("archive.term2"), t("archive.term3")][idx];
  }

  const [student, setStudent] = useState<Student | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [klass, setKlass] = useState<ClassInfo | null>(null);
  const [viewerEmail, setViewerEmail] = useState("");

  const [outputLanguage, setOutputLanguage] = useState<ReportLanguageCode>("en");
  const [teacherPreviewLanguage, setTeacherPreviewLanguage] = useState<ReportLanguageCode>("en");
  const [inputs, setInputs] = useState<ReportInputs>(emptyReportInputs);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editGender, setEditGender] = useState<"" | "male" | "female" | "non_binary">("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewKey, setPdfPreviewKey] = useState(0);

  const classDefaultSubject: SubjectCode =
    klass?.default_subject && REPORT_SUBJECTS.some((s) => s.code === klass.default_subject)
      ? (klass.default_subject as SubjectCode)
      : "efl";

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`${base}/reports/${encodeURIComponent(reportId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load report");
      const rep = data.report as Report;
      const st = data.student as Student;
      const cl = data.class as ClassInfo | null;
      if (st.class_id !== classId) {
        setLoadError("This report does not belong to the class in the URL.");
        return;
      }
      setStudent(st);
      setReport(rep);
      setKlass(cl);
      const tLang = data.tenant_default_report_language as string;
      setViewerEmail(typeof data.viewer_email === "string" ? data.viewer_email : "");

      const classLang =
        cl?.default_output_language && isReportLanguageCode(cl.default_output_language)
          ? cl.default_output_language
          : isReportLanguageCode(tLang)
            ? tLang
            : "en";
      const out = isReportLanguageCode(rep.output_language) ? rep.output_language : classLang;
      setOutputLanguage(out);
      const tp = isReportLanguageCode(rep.teacher_preview_language) ? rep.teacher_preview_language : out;
      setTeacherPreviewLanguage(tp);
      setInputs(parseReportInputs(rep.inputs));
      setEditFirst(st.first_name?.trim() || st.display_name.split(/\s+/)[0] || "");
      setEditLast(st.last_name?.trim() || "");
      setEditGender(
        st.gender === "male" || st.gender === "female" || st.gender === "non_binary" ? st.gender : "",
      );
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
    }
  }, [base, classId, reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveStudentDetails() {
    if (!student) return;
    const fn = editFirst.trim();
    const ln = editLast.trim();
    if (!fn || !ln) {
      alert("First name and last name are required.");
      return;
    }
    setBusy("student");
    try {
      const res = await fetch(`${base}/students/${encodeURIComponent(student.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: fn,
          last_name: ln,
          gender: editGender === "" ? null : editGender,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update student");
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveReport() {
    setBusy("save");
    try {
      const res = await fetch(`${base}/reports/${encodeURIComponent(reportId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: report?.status || "draft",
          output_language: outputLanguage,
          teacher_preview_language: teacherPreviewLanguage,
          inputs,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function persistTeacherLanguage(next: ReportLanguageCode) {
    setTeacherPreviewLanguage(next);
    setBusy("sync-lang");
    try {
      const res = await fetch(`${base}/reports/${encodeURIComponent(reportId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teacher_preview_language: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update teacher preview");
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function removeCommentPreviews() {
    if (!confirm("Remove both generated comments (PDF and teacher preview)?")) return;
    setBusy("clear");
    try {
      const res = await fetch(`${base}/reports/${encodeURIComponent(reportId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "", body_teacher_preview: "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function runAi() {
    setBusy("ai");
    try {
      const saveRes = await fetch(`${base}/reports/${encodeURIComponent(reportId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: report?.status || "draft",
          output_language: outputLanguage,
          teacher_preview_language: teacherPreviewLanguage,
          inputs,
        }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) throw new Error(saveData.error || "Save failed before AI");

      const res = await fetch(`${base}/reports/${encodeURIComponent(reportId)}/ai`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: inputs.optional_teacher_notes || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "AI failed");
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  function pdfHref() {
    return `${base}/reports/${encodeURIComponent(reportId)}/pdf`;
  }


  function setTermGrade(termIdx: 0 | 1 | 2, key: Dataset4MetricKey, val: number | null) {
    setInputs((prev) => {
      const next = { ...prev, terms: [...prev.terms] as [TermGrades, TermGrades, TermGrades] };
      const t = { ...next.terms[termIdx] };
      t[key] = val;
      next.terms[termIdx] = t;
      return next;
    });
  }

  const datasetComplete = allTermsComplete(inputs);
  const focusTermIndex = reportPeriodToTermIndex(inputs.report_period);
  const focusTermAvg = termAveragePercent(inputs.terms[focusTermIndex]);

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {loadError}{" "}
        <Link href={`/reports/${tenantId}/classes/${classId}`} className="font-medium text-red-950 underline">
          {t("report.backClass")}
        </Link>
      </div>
    );
  }

  if (!student || !report || !klass) {
    return <p className="text-sm text-zinc-500">{t("report.loading")}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{schoolName}</p>
          <h2 className="text-xl font-semibold text-zinc-900">{t("report.pageTitle")}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t("report.pageIntro")}</p>
        </div>
        <Link href={`/reports/${tenantId}/classes/${classId}`} className="text-sm font-medium text-emerald-800 hover:text-emerald-950 hover:underline">
          {t("report.backClass")}
        </Link>
      </div>

      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">{t("report.contextTitle")}</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-emerald-100">
              <tr>
                <td className="py-2 pr-4 text-zinc-500">{t("report.className")}</td>
                <td className="py-2 font-medium text-zinc-900">{klass.name}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-zinc-500">{t("report.scholasticYear")}</td>
                <td className="py-2">{klass.scholastic_year?.trim() || "—"}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-zinc-500">{t("report.cefr")}</td>
                <td className="py-2">{klass.cefr_level || "—"}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-zinc-500">{t("report.defaultSubject")}</td>
                <td className="py-2">{subjectLabel(classDefaultSubject)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-zinc-500">{t("report.teacherSignedIn")}</td>
                <td className="py-2 font-mono text-xs">{viewerEmail || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-emerald-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block min-w-0 text-sm">
            <span className="inline-flex items-center gap-2 text-zinc-600">
              <span aria-hidden>🌐</span> {t("report.pdfLang")}
            </span>
            <p className="mt-0.5 text-xs text-zinc-500">{t("report.pdfLangHint")}</p>
            <select
              value={outputLanguage}
              onChange={(e) => setOutputLanguage(e.target.value as ReportLanguageCode)}
              className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
            >
              {REPORT_LANGUAGES.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0 text-sm">
            <span className="text-zinc-600">{t("report.teacherPreviewLang")}</span>
            <p className="mt-0.5 text-xs text-zinc-500">{t("report.teacherPreviewHint")}</p>
            <select
              value={teacherPreviewLanguage}
              onChange={(e) => void persistTeacherLanguage(e.target.value as ReportLanguageCode)}
              disabled={busy !== null}
              className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
            >
              {REPORT_LANGUAGES.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0 text-sm">
            <span className="text-zinc-600">{t("report.subjectOverride")}</span>
            <select
              value={inputs.subject_code ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setInputs((prev) => ({
                  ...prev,
                  subject_code: v === "" ? null : (v as SubjectCode),
                }));
              }}
              className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">{t("report.useClassDefault", { subject: subjectLabel(classDefaultSubject) })}</option>
              {REPORT_SUBJECTS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">{t("report.studentTitle")}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            {t("report.firstName")}
            <input
              value={editFirst}
              onChange={(e) => setEditFirst(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            {t("report.lastName")}
            <input
              value={editLast}
              onChange={(e) => setEditLast(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            {t("report.gender")}
            <select
              value={editGender}
              onChange={(e) => setEditGender(e.target.value as typeof editGender)}
              className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="male">{t("report.genderMale")}</option>
              <option value="female">{t("report.genderFemale")}</option>
              <option value="non_binary">{t("report.genderNonBinary")}</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => void saveStudentDetails()}
              disabled={busy !== null}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {t("report.saveStudent")}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">{t("report.termGradesTitle")}</h3>
        <p className="mt-1 text-xs text-zinc-500">{t("report.termGradesHint")}</p>
        <div className="mt-4 max-w-md">
          <label className="block text-sm font-medium text-zinc-800">
            {t("report.termForReport")}
            <select
              value={inputs.report_period}
              onChange={(e) =>
                setInputs((prev) => ({
                  ...prev,
                  report_period: e.target.value as ReportInputs["report_period"],
                }))
              }
              className="mt-2 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm font-normal text-zinc-900 shadow-sm"
            >
              <option value="first">{t("report.termFirst")}</option>
              <option value="second">{t("report.termSecond")}</option>
              <option value="third">{t("report.termThird")}</option>
            </select>
          </label>
          <p className="mt-2 text-xs text-zinc-500">
            {t("report.termTotal")}{" "}
            <span className="font-semibold text-zinc-800">
              {focusTermAvg === null ? "—" : `${focusTermAvg.toFixed(2)}%`}
            </span>
          </p>
        </div>

        <div className="mt-6 space-y-4 border-t border-emerald-100 pt-6">
          <p className="text-sm font-semibold text-zinc-900">
            {termHeading(focusTermIndex)}
            {t("report.termInputs")}
          </p>
          <div className="space-y-4">
            {([0, 1, 2, 3] as const).map((rowIdx) => {
              const row = DATASET4_METRICS.slice(rowIdx * 4, rowIdx * 4 + 4);
              return (
                <div key={rowIdx} className="grid grid-cols-4 gap-3 items-end">
                  {row.map((m) => (
                    <div key={m.key} className="flex min-w-0 flex-col">
                      <span className="mb-1 text-[11px] leading-tight text-zinc-700 sm:text-sm">
                        {metricLabel(lang, m.key)}
                      </span>
                      <GradeSelect
                        value={inputs.terms[focusTermIndex][m.key]}
                        onChange={(n) => setTermGrade(focusTermIndex, m.key, n)}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">{t("report.optionalNotes")}</h3>
        <p className="mt-1 text-xs text-zinc-500">{t("report.optionalNotesHint")}</p>
        <textarea
          value={inputs.optional_teacher_notes}
          onChange={(e) => setInputs((prev) => ({ ...prev, optional_teacher_notes: e.target.value }))}
          rows={3}
          className="mt-2 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
        />
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">{t("report.generatedTitle")}</h3>
        <p className="mt-1 text-xs text-zinc-500">{t("report.generatedHint", { term: termHeading(focusTermIndex) })}</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("archive.pdfComment")} ({outputLanguage.toUpperCase()})
            </p>
            <div className="mt-2 min-h-[8rem] rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-zinc-900 whitespace-pre-wrap">
              {report.body?.trim() || `— ${t("report.runAi")}`}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("archive.teacherComment")} ({teacherPreviewLanguage.toUpperCase()})
            </p>
            <div className="mt-2 min-h-[8rem] rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-zinc-900 whitespace-pre-wrap">
              {report.body_teacher_preview?.trim() || `— ${t("report.teacherPreviewPlaceholder")}`}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">{t("report.pdfPreviewHint")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveReport()}
            disabled={busy !== null}
            className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {t("report.saveReport")}
          </button>
          <button
            type="button"
            onClick={() => {
              setPdfPreviewKey((k) => k + 1);
              setPdfPreviewOpen(true);
            }}
            className="inline-flex items-center rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-emerald-50"
          >
            {t("report.pdfPreview")}
          </button>
          <a
            href={pdfHref()}
            className="inline-flex items-center rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800"
          >
            {t("report.downloadPdf")}
          </a>
          <button
            type="button"
            onClick={() => void removeCommentPreviews()}
            disabled={busy !== null || (!report.body?.trim() && !report.body_teacher_preview?.trim())}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
          >
            {t("report.remove")}
          </button>
        </div>
      </section>

      {pdfPreviewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={t("report.pdfPreview")}
        >
          <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-emerald-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-900">{t("report.pdfPreview")}</h2>
              <button
                type="button"
                onClick={() => setPdfPreviewOpen(false)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                {t("report.pdfPreviewClose")}
              </button>
            </div>
            <iframe
              title={t("report.pdfPreview")}
              className="min-h-0 w-full flex-1 bg-zinc-100"
              src={`${pdfHref()}?inline=1&t=${pdfPreviewKey}`}
            />
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-amber-100 bg-amber-50/80 p-5">
        <h3 className="text-sm font-semibold text-amber-950">{t("report.aiTitle")}</h3>
        <p className="mt-1 text-xs text-amber-900/80">
          {t("report.aiHint")} {!datasetComplete ? t("report.aiFillHint") : null}
        </p>
        <button
          type="button"
          onClick={() => void runAi()}
          disabled={busy !== null}
          className="mt-3 rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy === "ai" ? t("report.generating") : t("report.generateAi")}
        </button>
      </section>
    </div>
  );
}
