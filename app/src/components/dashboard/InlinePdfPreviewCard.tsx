"use client";

import { ExternalLink, Printer, X } from "lucide-react";
import { useMemo } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import { openPdfForPrint, pdfInlineSrc } from "@/lib/app/openPdfForPrint";

type Props = {
  title: string;
  pdfUrl: string;
  onClose: () => void;
  /** Bumps iframe src when the same URL is opened again. */
  previewKey?: number;
};

export function InlinePdfPreviewCard({ title, pdfUrl, onClose, previewKey = 0 }: Props) {
  const { t } = useUiLanguage();
  const iframeSrc = useMemo(() => pdfInlineSrc(pdfUrl, previewKey), [pdfUrl, previewKey]);

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
      <p className="border-b border-emerald-50 px-4 py-2 text-xs text-zinc-600">{t("dash.pdfPreviewPrintHint")}</p>
      <iframe title={title} className="block h-[min(70vh,720px)] w-full bg-zinc-100" src={iframeSrc} />
    </section>
  );
}
