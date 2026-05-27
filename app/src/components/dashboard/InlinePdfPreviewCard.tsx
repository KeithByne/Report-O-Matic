"use client";

import { ExternalLink, Printer, X } from "lucide-react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { PdfBlobIframeViewer } from "@/components/dashboard/PdfBlobIframeViewer";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import { openPdfForPrint } from "@/lib/app/openPdfForPrint";

type Props = {
  title: string;
  pdfUrl: string;
  onClose: () => void;
  /** Bumps fetch URL when the same PDF is opened again. */
  previewKey?: number;
  /** Override default section id (teacher PDF preview). */
  sectionId?: string;
  /** When false, preview is watermarked server-side; open/print is disabled. */
  canExport?: boolean;
};

export function InlinePdfPreviewCard({
  title,
  pdfUrl,
  onClose,
  previewKey = 0,
  sectionId = "dash-teacher-panel-pdf-preview",
  canExport = true,
}: Props) {
  const { t } = useUiLanguage();

  return (
    <section
      id={sectionId}
      className="mt-4 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm ring-1 ring-emerald-100"
      aria-label={title}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/50 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Printer className={ICON_INLINE} aria-hidden />
          {title}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {canExport ? (
            <button
              type="button"
              onClick={() => openPdfForPrint(pdfUrl)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-emerald-50"
            >
              <ExternalLink className={ICON_INLINE} aria-hidden />
              {t("dash.pdfPreviewOpenTab")}
            </button>
          ) : (
            <p className="text-xs font-medium text-amber-900">{t("credits.previewOnlyHint")}</p>
          )}
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
      <PdfBlobIframeViewer pdfUrl={pdfUrl} previewKey={previewKey} title={title} />
    </section>
  );
}
