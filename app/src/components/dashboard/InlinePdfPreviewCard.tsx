"use client";

import { ExternalLink, Printer, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import { openPdfForPrint, pdfInlineSrc } from "@/lib/app/openPdfForPrint";

type Props = {
  title: string;
  pdfUrl: string;
  onClose: () => void;
  /** Bumps fetch URL when the same PDF is opened again. */
  previewKey?: number;
};

export function InlinePdfPreviewCard({ title, pdfUrl, onClose, previewKey = 0 }: Props) {
  const { t } = useUiLanguage();
  const fetchUrl = useMemo(() => pdfInlineSrc(pdfUrl, previewKey), [pdfUrl, previewKey]);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setLoadError(null);
    setBlobUrl(null);

    void (async () => {
      try {
        const res = await fetch(fetchUrl, { credentials: "include" });
        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          const msg = typeof data.error === "string" ? data.error.trim() : "";
          throw new Error(msg || t("dash.pdfPreviewLoadFailed"));
        }
        if (!contentType.includes("application/pdf")) {
          throw new Error(t("dash.pdfPreviewLoadFailed"));
        }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : t("dash.pdfPreviewLoadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fetchUrl, t]);

  return (
    <section
      id="dash-teacher-panel-pdf-preview"
      className="mt-4 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm ring-1 ring-emerald-100"
      aria-label={title}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/50 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Printer className={ICON_INLINE} aria-hidden />
          {title}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openPdfForPrint(pdfUrl)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-emerald-50"
          >
            <ExternalLink className={ICON_INLINE} aria-hidden />
            {t("dash.pdfPreviewOpenTab")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            <X className={ICON_INLINE} aria-hidden />
            {t("dash.pdfPreviewClose")}
          </button>
        </div>
      </div>
      {loadError ? (
        <p className="px-4 py-3 text-sm text-red-800" role="alert">
          {loadError}
        </p>
      ) : loading ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-600">{t("dash.pdfPreviewLoading")}</p>
      ) : blobUrl ? (
        <iframe title={title} className="block h-[min(70vh,720px)] w-full bg-zinc-100" src={blobUrl} />
      ) : null}
    </section>
  );
}
