"use client";

import { ClipboardList, Loader2, Printer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InlinePdfPreviewCard } from "@/components/dashboard/InlinePdfPreviewCard";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE, ICON_SECTION } from "@/components/ui/iconSizes";
import { scrollPanelContentTopIntoView } from "@/lib/ui/scrollPanelContentIntoView";

const REGISTERS_CARD_ID = "dash-workspace-panel-registers";
const REGISTERS_PDF_PREVIEW_ID = "dash-workspace-panel-registers-pdf-preview";

type ClassRow = {
  id: string;
  name: string;
  student_count?: number;
};

type Props = {
  tenantId: string;
  canExportPdfs: boolean;
};

export function DashboardSchoolRegistersPanel({ tenantId, canExportPdfs }: Props) {
  const { t, lang: uiLang } = useUiLanguage();
  const base = `/api/tenants/${encodeURIComponent(tenantId)}`;
  const cardRef = useRef<HTMLElement | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [previewKey, setPreviewKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${base}/classes`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("tenant.errLoadClasses"));
      const list = (data.classes ?? []) as ClassRow[];
      setClasses(list);
      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const c of list) next[c.id] = prev[c.id] === true;
        return next;
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.loadFailed"));
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [base, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Bring the Registers card into the upper portion of the window when opened.
  useEffect(() => {
    scrollPanelContentTopIntoView(cardRef.current ?? document.getElementById(REGISTERS_CARD_ID), {
      block: "start",
    });
  }, []);

  // Pin the PDF preview to the top of the window when generated / refreshed.
  useEffect(() => {
    if (!previewUrl) return;
    scrollPanelContentTopIntoView(document.getElementById(REGISTERS_PDF_PREVIEW_ID), {
      block: "start",
    });
  }, [previewUrl, previewKey]);

  const selectedIds = useMemo(
    () => classes.filter((c) => selected[c.id]).map((c) => c.id),
    [classes, selected],
  );

  const allSelected = classes.length > 0 && selectedIds.length === classes.length;

  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
    setPreviewUrl(null);
  }

  function toggleAll() {
    const next = !allSelected;
    setSelected(Object.fromEntries(classes.map((c) => [c.id, next])));
    setPreviewUrl(null);
  }

  function printSelected() {
    if (selectedIds.length === 0) return;
    const qp = new URLSearchParams();
    qp.set("lang", uiLang);
    qp.set("inline", "1");
    qp.set("class_ids", selectedIds.join(","));
    setPreviewUrl(`${base}/school/registers-pdf?${qp.toString()}`);
    setPreviewKey(Date.now());
  }

  return (
    <section
      ref={cardRef}
      id={REGISTERS_CARD_ID}
      className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"
      aria-labelledby="dash-registers-title"
    >
      <h2 id="dash-registers-title" className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <ClipboardList className={ICON_SECTION} aria-hidden />
        {t("dash.panelRegisters")}
      </h2>
      <p className="mt-1 text-sm text-zinc-600">{t("dash.registersSelectInstruction")}</p>

      {err ? (
        <p className="mt-3 text-sm text-red-800" role="alert">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className={`${ICON_INLINE} animate-spin`} aria-hidden />
          …
        </p>
      ) : classes.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">{t("dash.registersNoClasses")}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-emerald-50"
            >
              {allSelected ? t("dash.registersDeselectAll") : t("dash.registersSelectAll")}
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0 || !canExportPdfs}
              onClick={printSelected}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
            >
              <Printer className={ICON_INLINE} aria-hidden />
              {t("dash.registersPrintSelected")}
            </button>
          </div>
          {!canExportPdfs ? (
            <p className="mt-2 text-xs text-amber-800">{t("dash.registersNeedCredits")}</p>
          ) : null}

          <ul className="mt-4 max-h-[min(70vh,42rem)] divide-y divide-emerald-100 overflow-y-auto overscroll-y-contain rounded-xl border border-emerald-100">
            {classes.map((c) => {
              const checked = selected[c.id] === true;
              const count =
                typeof c.student_count === "number"
                  ? t("dash.registersPupilCount", { n: c.student_count })
                  : null;
              return (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-emerald-50/50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(c.id)}
                      className="mt-1 h-4 w-4 rounded border-emerald-300 text-emerald-800 focus:ring-emerald-500"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-zinc-900">{c.name}</span>
                      {count ? <span className="mt-0.5 block text-xs text-zinc-500">{count}</span> : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {previewUrl ? (
        <div className="mt-5">
          <InlinePdfPreviewCard
            sectionId={REGISTERS_PDF_PREVIEW_ID}
            title={t("dash.registersPreviewTitle")}
            pdfUrl={previewUrl}
            canExport={canExportPdfs}
            previewKey={previewKey}
            onClose={() => setPreviewUrl(null)}
          />
        </div>
      ) : null}
    </section>
  );
}
