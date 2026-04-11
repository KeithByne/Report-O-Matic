"use client";

import { CalendarDays, FileText, NotebookText, Printer } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import type { ReportPeriod } from "@/lib/reportInputs";
import { openPdfForPrint } from "@/lib/app/openPdfForPrint";

type ClassRow = {
  id: string;
  name: string;
  student_count: number;
  default_new_report_kind?: "standard" | "short_course";
};

type Props = { tenantId: string; isTeacher?: boolean };

export function TeacherDownloadsCard({ tenantId, isTeacher = false }: Props) {
  const { t, lang: uiLang } = useUiLanguage();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`${base}/classes`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("tenant.errLoadClasses"));
      setClasses(data.classes ?? []);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : t("common.loadFailed"));
      setClasses([]);
    }
  }, [base, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const allShortCourse = useMemo(
    () =>
      classes.length > 0 &&
      classes.every((c) => (c.default_new_report_kind ?? "standard") === "short_course"),
    [classes],
  );

  const [reportsTerm, setReportsTerm] = useState<ReportPeriod>("first");
  const [reportsClassId, setReportsClassId] = useState<string>("");

  useEffect(() => {
    if (classes.length > 0 && !reportsClassId) {
      setReportsClassId(classes[0]!.id);
    }
  }, [classes, reportsClassId]);

  const teacherReportsHref = useMemo(() => {
    if (allShortCourse) {
      if (!reportsClassId) return "";
      const qp = new URLSearchParams();
      qp.set("term", "all");
      if (isTeacher) qp.set("anyStatus", "1");
      return `${base}/classes/${encodeURIComponent(reportsClassId)}/pdf-batch?${qp.toString()}`;
    }
    if (isTeacher) {
      const qp = new URLSearchParams();
      qp.set("term", "all");
      qp.set("order", "class");
      qp.set("anyStatus", "1");
      return `${base}/reports/pdf-batch?${qp.toString()}`;
    }
    const qp = new URLSearchParams();
    qp.set("term", reportsTerm);
    qp.set("order", "term");
    return `${base}/reports/pdf-batch?${qp.toString()}`;
  }, [allShortCourse, base, reportsClassId, reportsTerm, isTeacher]);

  const bulkReadyUrl = useMemo(() => {
    if (!teacherReportsHref) return "";
    if (allShortCourse && reportsClassId) {
      if (isTeacher) {
        return `${base}/teacher/bulk-reports-ready?classId=${encodeURIComponent(reportsClassId)}&anyStatus=1`;
      }
      return `${base}/teacher/bulk-reports-ready?classId=${encodeURIComponent(reportsClassId)}`;
    }
    if (!allShortCourse) {
      if (isTeacher) {
        return `${base}/teacher/bulk-reports-ready?term=all&anyStatus=1`;
      }
      return `${base}/teacher/bulk-reports-ready?term=${encodeURIComponent(reportsTerm)}`;
    }
    return "";
  }, [allShortCourse, base, reportsClassId, reportsTerm, teacherReportsHref, isTeacher]);

  const [bulkReportsReady, setBulkReportsReady] = useState<boolean | null>(null);

  useEffect(() => {
    if (!bulkReadyUrl) {
      setBulkReportsReady(false);
      return;
    }
    let cancelled = false;
    setBulkReportsReady(null);
    void fetch(bulkReadyUrl, { method: "GET" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { ready?: boolean };
        if (cancelled) return;
        setBulkReportsReady(res.ok && data.ready === true);
      })
      .catch(() => {
        if (!cancelled) setBulkReportsReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bulkReadyUrl]);

  const registersHref = `${base}/teacher/registers-pdf?lang=${encodeURIComponent(uiLang)}`;
  const timetableHref = `${base}/timetable-pdf?lang=${encodeURIComponent(uiLang)}`;

  const linkClass =
    "inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-emerald-100";
  const linkDisabledClass =
    "inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-400";

  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <Printer className={ICON_INLINE} aria-hidden />
        {t("dash.teacherDownloadsCardTitle")}
      </h3>
      <p className="mt-1 text-xs text-zinc-600">{t("dash.teacherDownloadsCardLead")}</p>

      {loadError ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : null}

      <ul className="mt-4 space-y-4">
        <li className="flex flex-col gap-2 border-b border-emerald-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-800">
              <NotebookText className={ICON_INLINE} aria-hidden />
              {t("dash.teacherDownloadsRegisters")}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">{t("dash.teacherDownloadsRegistersHint")}</p>
          </div>
          <button
            type="button"
            onClick={() => openPdfForPrint(registersHref)}
            className={`${linkClass} shrink-0`}
          >
            <Printer className={ICON_INLINE} aria-hidden />
            {t("common.printPdf")}
          </button>
        </li>

        <li className="flex flex-col gap-2 border-b border-emerald-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-800">
              <CalendarDays className={ICON_INLINE} aria-hidden />
              {t("dash.teacherDownloadsTimetable")}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">{t("dash.teacherDownloadsTimetableHint")}</p>
          </div>
          <button
            type="button"
            onClick={() => openPdfForPrint(timetableHref)}
            className={`${linkClass} shrink-0`}
          >
            <Printer className={ICON_INLINE} aria-hidden />
            {t("common.printPdf")}
          </button>
        </li>

        <li className="flex flex-col gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-800">
              <FileText className={ICON_INLINE} aria-hidden />
              {t("dash.teacherDownloadsAllReports")}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">{t("dash.teacherDownloadsAllReportsHint")}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            {allShortCourse ? (
              <label className="flex flex-col gap-1 text-sm sm:min-w-[12rem]">
                <span className="text-zinc-600">{t("dash.teacherDownloadsShortCourseClass")}</span>
                <select
                  value={reportsClassId}
                  onChange={(e) => setReportsClassId(e.target.value)}
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : isTeacher ? (
              <p className="max-w-md text-xs text-zinc-500">{t("dash.teacherDownloadsAllReportsTeacherHint")}</p>
            ) : (
              <label className="flex flex-col gap-1 text-sm sm:min-w-[10rem]">
                <span className="text-zinc-600">{t("class.bulkDownloadTermLabel")}</span>
                <select
                  value={reportsTerm}
                  onChange={(e) => setReportsTerm(e.target.value as ReportPeriod)}
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="first">{t("archive.term1")}</option>
                  <option value="second">{t("archive.term2")}</option>
                  <option value="third">{t("archive.term3")}</option>
                </select>
              </label>
            )}
            {teacherReportsHref ? (
              bulkReportsReady === true ? (
                <button
                  type="button"
                  onClick={() => openPdfForPrint(teacherReportsHref)}
                  className={`${linkClass} w-fit`}
                >
                  <Printer className={ICON_INLINE} aria-hidden />
                  {t("common.printPdf")}
                </button>
              ) : (
                <div className="flex flex-col gap-1">
                  <span
                    className={`${linkDisabledClass} w-fit`}
                    aria-disabled
                  >
                    <Printer className={ICON_INLINE} aria-hidden />
                    {bulkReportsReady === null ? t("dash.teacherDownloadsChecking") : t("common.printPdf")}
                  </span>
                  {bulkReportsReady === false ? (
                    <p className="max-w-md text-xs text-amber-800">
                      {isTeacher ? t("dash.teacherDownloadsBulkReportsEmpty") : t("dash.teacherDownloadsReportsNotReady")}
                    </p>
                  ) : null}
                </div>
              )
            ) : (
              <span className="text-sm text-zinc-400">{t("dash.teacherDownloadsNoClass")}</span>
            )}
          </div>
        </li>
      </ul>
    </div>
  );
}
