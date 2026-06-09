"use client";

import { useEffect, useMemo, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { pdfInlineSrc } from "@/lib/app/openPdfForPrint";

type Props = {
  pdfUrl: string;
  title: string;
  /** Bumps fetch URL when the same PDF is opened again. */
  previewKey?: number;
  className?: string;
};

/** Fetches a same-origin PDF and embeds it via a blob URL (avoids iframe redirect / framing issues). */
export function PdfBlobIframeViewer({ pdfUrl, title, previewKey = 0, className }: Props) {
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

  if (loadError) {
    return (
      <p className="whitespace-pre-wrap px-4 py-3 text-sm text-red-800" role="alert">
        {loadError}
      </p>
    );
  }
  if (loading) {
    return <p className="px-4 py-8 text-center text-sm text-zinc-600">{t("dash.pdfPreviewLoading")}</p>;
  }
  if (!blobUrl) return null;

  return (
    <iframe
      title={title}
      className={className ?? "block h-[min(70vh,720px)] w-full bg-zinc-100"}
      src={blobUrl}
    />
  );
}
