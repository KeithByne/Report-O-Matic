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

type RegisterSchool = { tenantId: string; tenantName: string };

type Props = {
  tenantId: string;
  isTeacher?: boolean;
  /** Renders inside the teacher dashboard menu card (no outer card chrome). */
  embedded?: boolean;
  /** When set, register PDF buttons are shown for each school (multi-school teachers). */
  registerSchools?: RegisterSchool[];
};

export function TeacherDownloadsCard({
  tenantId,
  isTeacher = false,
  embedded = false,
  registerSchools,
}: Props) {
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

  const registersHrefFor = (schoolTenantId: string) =>
    `/api/tenants/${encodeURIComponent(schoolTenantId)}/teacher/registers-pdf?lang=${encodeURIComponent(uiLang)}`;
  const timetableHref = `${base}/timetable-pdf?lang=${encodeURIComponent(uiLang)}`;

  const btnTimetableClass =
    "inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-emerald-100";
  const btnReportsClass =
    "inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-200/80";
  const btnRegistersClass =
    "inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800";
  const btnDisabledClass =
    "inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-400";

  const registerTargets = useMemo(() => {
    if (registerSchools && registerSchools.length > 0) return registerSchools;
    return [{ tenantId, tenantName: "" }];
  }, [registerSchools, tenantId]);

  const shellClass = embedded
    ? "mt-4 border-t border-emerald-100 pt-4"
    : "mt-4 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5";

  return (
    <div className={shellClass} id={embedded ? "dash-teacher-panel-downloads" : undefined}>
      {!embedded ? (
        <>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Printer className={ICON_INLINE} aria-hidden />
            {t("dash.teacherDownloadsCardTitle")}
          </h3>
          <p className="mt-1 text-xs text-zinc-600">{t("dash.teacherDownloadsCardLead")}</p>
        </>
      ) : (
        <p className="text-xs text-zinc-600">{t("dash.teacherDownloadsCardLead")}</p>
      )}

      {loadError ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-3">
        {(allShortCourse || !allShortCourse) && classes.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            {allShortCourse ? (
              <label className="flex min-w-[12rem] flex-col gap-1 text-sm">
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
            ) : (
              <label className="flex min-w-[10rem] flex-col gap-1 text-sm">
                <span className="sr-only">{t("dash.teacherDownloadsAllReports")}</span>
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
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => openPdfForPrint(timetableHref)} className={btnTimetableClass}>
            <CalendarDays className={ICON_INLINE} aria-hidden />
            {t("dash.teacherDownloadsTimetable")}
          </button>

          {teacherReportsHref ? (
            bulkReportsReady === true ? (
              <button
                type="button"
                onClick={() => openPdfForPrint(teacherReportsHref)}
                className={btnReportsClass}
              >
                <FileText className={ICON_INLINE} aria-hidden />
                {t("dash.teacherDownloadsAllReports")}
              </button>
            ) : (
              <span className={btnDisabledClass} aria-disabled>
                <FileText className={ICON_INLINE} aria-hidden />
                {bulkReportsReady === null ? t("dash.teacherDownloadsChecking") : t("dash.teacherDownloadsAllReports")}
              </span>
            )
          ) : (
            <span className="text-sm text-zinc-400">{t("dash.teacherDownloadsNoClass")}</span>
          )}

          {registerTargets.map((school) => (
            <button
              key={school.tenantId}
              type="button"
              onClick={() => openPdfForPrint(registersHrefFor(school.tenantId))}
              className={btnRegistersClass}
            >
              <NotebookText className={ICON_INLINE} aria-hidden />
              {registerTargets.length > 1 && school.tenantName ? `${school.tenantName} — ` : null}
              {t("dash.teacherDownloadsPrintMyRegisters")}
            </button>
          ))}
        </div>

        {bulkReportsReady === false && teacherReportsHref ? (
          <p className="text-xs text-amber-800">
            {isTeacher ? t("dash.teacherDownloadsBulkReportsEmpty") : t("dash.teacherDownloadsReportsNotReady")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
