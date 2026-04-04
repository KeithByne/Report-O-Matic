"use client";

import { Archive } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ClassScholasticArchives } from "@/components/reports/ClassScholasticArchives";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";

type ClassRow = { id: string; name: string };

export function DashboardScholasticArchivesOverview({ tenantId }: { tenantId: string }) {
  const { t } = useUiLanguage();
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [classesLoading, setClassesLoading] = useState(false);

  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;

  const loadClasses = useCallback(async () => {
    setLoadError(null);
    setClassesLoading(true);
    try {
      const res = await fetch(`${base}/classes`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      const rows = (data.classes ?? []) as ClassRow[];
      setClasses(rows);
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id ?? "";
      });
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Failed");
    } finally {
      setClassesLoading(false);
    }
  }, [base]);

  useEffect(() => {
    if (!open) return;
    void loadClasses();
  }, [open, loadClasses]);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-emerald-50/80"
        aria-expanded={open}
      >
        <Archive className={ICON_INLINE} aria-hidden />
        {t("archive.title")}
      </button>
      {open ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
          {loadError ? (
            <p className="text-sm text-red-800">{loadError}</p>
          ) : classesLoading ? (
            <p className="text-sm text-zinc-600">{t("report.loading")}</p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-zinc-600">{t("tenant.noClassesLead")}</p>
          ) : (
            <>
              <label className="block text-sm text-zinc-700">
                <span className="font-medium">{t("class.className")}</span>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="mt-1 block w-full max-w-md rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedId ? (
                <div className="mt-4">
                  <ClassScholasticArchives classId={selectedId} apiBase={base} />
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
