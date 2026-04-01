"use client";

import { useCallback, useEffect, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import type { ArchivedReportSnapshot, ClassScholasticArchivePayload } from "@/lib/data/classArchives";
import {
  DATASET4_METRICS,
  isShortCourseReport,
  parseReportInputs,
  termAveragePercent,
  type ReportPeriod,
} from "@/lib/reportInputs";
import { UI_LOCALE_BCP47 } from "@/lib/i18n/reportLanguages";
import { metricLabel } from "@/lib/i18n/uiStrings";

type ArchiveListItem = { id: string; scholastic_year_label: string; archived_at: string };

type Props = { classId: string; apiBase: string };

function periodLabel(rp: ReportPeriod): "archive.term1" | "archive.term2" | "archive.term3" {
  if (rp === "first") return "archive.term1";
  if (rp === "second") return "archive.term2";
  return "archive.term3";
}

function ArchiveReadonlyGrades({ inputsRaw, reportN }: { inputsRaw: unknown; reportN: number }) {
  const { lang, t } = useUiLanguage();
  const inputs = parseReportInputs(inputsRaw);
  const short = isShortCourseReport(inputs);
  const terms: (0 | 1 | 2)[] = short ? [0] : [0, 1, 2];
  const termTitle = (i: 0 | 1 | 2) =>
    short ? t("report.shortCourseTermHeading") : [t("archive.term1"), t("archive.term2"), t("archive.term3")][i];

  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3">
      <p className="text-xs font-semibold text-zinc-700">
        {(short ? t("archive.gradesTitleShortCourse") : t("archive.gradesTitle"))} — {t("archive.reportN", { n: reportN })}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {short ? t("archive.termFocusShortCourse") : `${t("archive.termFocus")}: ${t(periodLabel(inputs.report_period))}`}
      </p>
      <div className="mt-3 space-y-4">
        {terms.map((ti) => {
          const avg = termAveragePercent(inputs.terms[ti]);
          return (
            <div key={ti}>
              <p className="text-xs font-medium text-zinc-800">
                {termTitle(ti)}
                {avg === null ? "" : ` · ${avg.toFixed(2)}%`}
              </p>
              <div className="mt-2 space-y-2">
                {([0, 1, 2, 3] as const).map((rowIdx) => {
                  const row = DATASET4_METRICS.slice(rowIdx * 4, rowIdx * 4 + 4);
                  return (
                    <div key={rowIdx} className="grid grid-cols-4 gap-2 items-end">
                      {row.map((m) => {
                        const v = inputs.terms[ti][m.key];
                        return (
                          <div key={m.key} className="min-w-0 text-center">
                            <div className="mb-0.5 min-h-[2.25rem] text-[10px] leading-tight text-zinc-600 sm:text-xs">
                              {metricLabel(lang, m.key)}
                            </div>
                            <div className="rounded border border-emerald-200 bg-emerald-50/70 py-1 text-sm font-medium text-zinc-900">
                              {v === null ? "—" : v}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArchivedReportBlock({
  report,
  index,
}: {
  report: ArchivedReportSnapshot;
  index: number;
}) {
  const { t, lang } = useUiLanguage();
  const n = index + 1;
  const dateOpts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
  return (
    <li className="rounded-lg border border-emerald-200 bg-emerald-50/70/80 p-3 text-sm">
      <p className="text-xs text-zinc-500">
        {t("archive.reportN", { n })} · {t("archive.updated")}{" "}
        {new Date(report.updated_at).toLocaleString(UI_LOCALE_BCP47[lang], dateOpts)} · {report.status} · PDF{" "}
        {report.output_language.toUpperCase()}
      </p>
      {report.title?.trim() ? <p className="mt-1 font-medium text-zinc-800">{report.title}</p> : null}
      <ArchiveReadonlyGrades inputsRaw={report.inputs} reportN={n} />
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-zinc-500">{t("archive.pdfComment")}</p>
          <p className="mt-1 whitespace-pre-wrap text-zinc-800">{report.body?.trim() || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-zinc-500">
            {t("archive.teacherComment")} ({report.teacher_preview_language.toUpperCase()})
          </p>
          <p className="mt-1 whitespace-pre-wrap text-zinc-800">{report.body_teacher_preview?.trim() || "—"}</p>
        </div>
      </div>
    </li>
  );
}

export function ClassScholasticArchives({ classId, apiBase }: Props) {
  const { t, lang } = useUiLanguage();
  const [archives, setArchives] = useState<ArchiveListItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ payload: ClassScholasticArchivePayload; label: string; archivedAt: string } | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`${apiBase}/classes/${encodeURIComponent(classId)}/archives`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load archives");
      setArchives(data.archives ?? []);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Failed");
      setArchives([]);
    }
  }, [apiBase, classId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function openArchive(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`${apiBase}/classes/${encodeURIComponent(classId)}/archives/${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setModal({
        payload: data.payload as ClassScholasticArchivePayload,
        label: data.archive.scholastic_year_label as string,
        archivedAt: data.archive.archived_at as string,
      });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  function sortReports(reports: ArchivedReportSnapshot[]): ArchivedReportSnapshot[] {
    return [...reports].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  if (loadError) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-950">
        {t("archive.title")}: {loadError}
      </section>
    );
  }

  if (archives.length === 0) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">{t("archive.title")}</h3>
        <p className="mt-1 text-sm text-zinc-600">{t("archive.emptyExpl")}</p>
        <p className="mt-2 text-sm text-zinc-500">{t("archive.none")}</p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">{t("archive.title")}</h3>
        <p className="mt-1 text-sm text-zinc-600">{t("archive.readonlyExpl")}</p>
        <ul className="mt-3 divide-y divide-emerald-100">
          {archives.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <span className="font-medium text-zinc-900">{a.scholastic_year_label}</span>
                <span className="ml-2 text-xs text-zinc-500">
                  {t("archive.archived")}{" "}
                  {new Date(a.archived_at).toLocaleString(UI_LOCALE_BCP47[lang], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void openArchive(a.id)}
                className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                {busyId === a.id ? t("archive.loading") : t("archive.review")}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-title"
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-emerald-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="archive-title" className="text-lg font-semibold text-zinc-900">
                  {modal.payload.class_name} — {modal.label}
                </h2>
                <p className="text-xs text-zinc-500">
                  {t("archive.archived")}{" "}
                  {new Date(modal.archivedAt).toLocaleString(UI_LOCALE_BCP47[lang], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-emerald-50/70"
              >
                {t("archive.close")}
              </button>
            </div>
            <div className="mt-4 space-y-6">
              {modal.payload.students.length === 0 ? (
                <p className="text-sm text-zinc-600">{t("archive.noPupils")}</p>
              ) : (
                modal.payload.students.map((st) => (
                  <div key={st.id} className="rounded-xl border border-emerald-200 p-4">
                    <p className="font-medium text-zinc-900">{st.display_name}</p>
                    {st.reports.length === 0 ? (
                      <p className="mt-1 text-sm text-zinc-500">{t("archive.noReports")}</p>
                    ) : (
                      <ul className="mt-2 space-y-4">
                        {sortReports(st.reports).map((r, idx) => (
                          <ArchivedReportBlock key={r.id} report={r} index={idx} />
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
