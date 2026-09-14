"use client";

import { Loader2, Search, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import type { SchoolStudentWithClasses } from "@/lib/data/schoolStudents";

type Props = {
  tenantId: string;
};

export function DashboardFindStudentPanel({ tenantId }: Props) {
  const { t } = useUiLanguage();
  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<SchoolStudentWithClasses[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${base}/school-students?status=all`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setRows((data.students ?? []) as SchoolStudentWithClasses[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.failed"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [base, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return rows
      .filter((row) => {
        const hay = `${row.display_name} ${row.first_name} ${row.last_name} ${row.class_names.join(" ")} ${row.last_class_name ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [rows, query]);

  return (
    <section
      id="dash-workspace-panel-findStudent"
      className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"
      role="search"
      aria-labelledby="dash-find-student-title"
    >
      <h2 id="dash-find-student-title" className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <Search className={ICON_INLINE} aria-hidden />
        {t("dash.panelFindStudent")}
      </h2>
      <p className="mt-1 text-sm text-zinc-600">{t("dash.findStudentHint")}</p>

      {err ? (
        <p className="mt-3 text-sm text-red-800" role="alert">
          {err}
        </p>
      ) : null}

      <label className="mt-4 block min-w-0 text-sm">
        <span className="mb-1 block text-zinc-600">{t("dash.findStudentSearchLabel")}</span>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="block w-full rounded-lg border border-emerald-200 bg-white py-2 pl-9 pr-3 text-sm"
            placeholder={t("dash.findStudentSearchPlaceholder")}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </label>

      {loading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className={`${ICON_INLINE} animate-spin`} aria-hidden />
          …
        </p>
      ) : query.trim() === "" ? (
        <p className="mt-6 text-sm text-zinc-500">{t("dash.findStudentTypeToSearch")}</p>
      ) : matches.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">{t("dash.findStudentEmpty")}</p>
      ) : (
        <div className="mt-4 max-h-[min(70vh,42rem)] overflow-y-auto overscroll-y-contain rounded-xl border border-emerald-100">
          <ul className="divide-y divide-emerald-100">
            {matches.map((row) => {
              const isInactive = row.status === "inactive";
              const classLine =
                row.class_names.length > 0
                  ? t("dash.findStudentClasses", { classes: row.class_names.join(", ") })
                  : isInactive && row.last_class_name
                    ? t("dash.findStudentLastClass", { className: row.last_class_name })
                    : isInactive
                      ? t("dash.findStudentNoLastClass")
                      : t("dash.activeStudentsNoClasses");
              return (
              <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-zinc-900">{row.display_name}</p>
                    {isInactive ? (
                      <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                        {t("dash.findStudentStatusInactive")}
                      </span>
                    ) : (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
                        {t("dash.findStudentStatusActive")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{classLine}</p>
                </div>
                {row.class_ids.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {row.class_ids.map((classId, i) => (
                      <Link
                        key={`${row.id}-${classId}`}
                        href={`/reports/${encodeURIComponent(tenantId)}/classes/${encodeURIComponent(classId)}?panel=students`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-100"
                      >
                        <Users className="h-3.5 w-3.5" aria-hidden />
                        {row.class_names[i] || t("dash.findStudentOpenClass")}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
