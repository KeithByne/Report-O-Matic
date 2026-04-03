"use client";

import { Building2, Eye, FileImage, Save, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";

type Tenant = { tenantId: string; tenantName: string };

type LhState = {
  name: string;
  tagline: string;
  address: string;
  contact: string;
  has_logo: boolean;
};

const emptyLh: LhState = {
  name: "",
  tagline: "",
  address: "",
  contact: "",
  has_logo: false,
};

export function DashboardTenantPdfLetterhead({
  tenants,
  reportLangByTenant,
}: {
  tenants: Tenant[];
  reportLangByTenant: Record<string, ReportLanguageCode>;
}) {
  const { t, lang: uiLang } = useUiLanguage();
  const dialogTitleId = useId();
  const [byTenant, setByTenant] = useState<Record<string, LhState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState<string | null>(null);
  const [logoKey, setLogoKey] = useState(0);
  const [previewTenantId, setPreviewTenantId] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tenantsRef = useRef(tenants);
  tenantsRef.current = tenants;

  const loadOne = useCallback(async (tenantId: string) => {
    const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/settings`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return emptyLh;
    const lh = data.pdf_letterhead as
      | {
          name?: string | null;
          tagline?: string | null;
          address?: string | null;
          contact?: string | null;
          has_logo?: boolean;
        }
      | undefined;
    return {
      name: typeof lh?.name === "string" ? lh.name : "",
      tagline: typeof lh?.tagline === "string" ? lh.tagline : "",
      address: typeof lh?.address === "string" ? lh.address : "",
      contact: typeof lh?.contact === "string" ? lh.contact : "",
      has_logo: lh?.has_logo === true,
    };
  }, []);

  const refresh = useCallback(async () => {
    const list = tenantsRef.current;
    const next: Record<string, LhState> = {};
    await Promise.all(
      list.map(async (x) => {
        next[x.tenantId] = await loadOne(x.tenantId);
      }),
    );
    setByTenant(next);
  }, [loadOne]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save(tenantId: string) {
    const fields = byTenant[tenantId] ?? emptyLh;
    setBusy(tenantId);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pdf_letterhead: {
            name: fields.name.trim() || null,
            tagline: fields.tagline.trim() || null,
            address: fields.address.trim() || null,
            contact: fields.contact.trim() || null,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      const lh = data.pdf_letterhead as typeof data.pdf_letterhead;
      if (lh && typeof lh === "object") {
        setByTenant((prev) => ({
          ...prev,
          [tenantId]: {
            ...(prev[tenantId] ?? emptyLh),
            name: typeof lh.name === "string" ? lh.name : "",
            tagline: typeof lh.tagline === "string" ? lh.tagline : "",
            address: typeof lh.address === "string" ? lh.address : "",
            contact: typeof lh.contact === "string" ? lh.contact : "",
            has_logo: lh.has_logo === true,
          },
        }));
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function uploadLogo(tenantId: string, file: File) {
    setLogoBusy(tenantId);
    try {
      const fd = new FormData();
      fd.set("logo", file);
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/letterhead-logo`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setByTenant((prev) => ({
        ...prev,
        [tenantId]: { ...(prev[tenantId] ?? emptyLh), has_logo: true },
      }));
      setLogoKey((k) => k + 1);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setLogoBusy(null);
    }
  }

  async function removeLogo(tenantId: string) {
    setLogoBusy(tenantId);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/letterhead-logo`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setByTenant((prev) => ({
        ...prev,
        [tenantId]: { ...(prev[tenantId] ?? emptyLh), has_logo: false },
      }));
      setLogoKey((k) => k + 1);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setLogoBusy(null);
    }
  }

  function updateField(tenantId: string, key: keyof Omit<LhState, "has_logo">, value: string) {
    setByTenant((prev) => ({
      ...prev,
      [tenantId]: { ...(prev[tenantId] ?? emptyLh), [key]: value },
    }));
  }

  function openPreview(tenantId: string) {
    setPreviewTenantId(tenantId);
  }

  if (tenants.length === 0) return null;

  return (
    <>
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <FileImage className={ICON_INLINE} aria-hidden />
          {t("dash.pdfLetterheadTitle")}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">{t("dash.pdfLetterheadHint")}</p>
        <ul className="mt-4 space-y-6">
          {tenants.map((ten) => {
            const f = byTenant[ten.tenantId] ?? emptyLh;
            const logoSrc = f.has_logo
              ? `/api/tenants/${encodeURIComponent(ten.tenantId)}/letterhead-logo?k=${logoKey}`
              : null;
            return (
              <li key={ten.tenantId} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <p className="flex items-center gap-2 font-medium text-zinc-900">
                  <Building2 className={`${ICON_INLINE} text-emerald-800/80`} aria-hidden />
                  {ten.tenantName}
                </p>
                <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="w-full shrink-0 lg:w-[140px]">
                    <p className="text-xs font-medium text-zinc-600">{t("dash.pdfLetterheadLogo")}</p>
                    <div
                      className="mt-1 overflow-hidden rounded-lg border border-emerald-200 bg-white"
                      style={{ aspectRatio: "3 / 1", maxHeight: "100px", width: "100%", maxWidth: "360px" }}
                    >
                      {logoSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element -- API-served preview
                        <img
                          src={logoSrc}
                          alt=""
                          className="h-full w-full object-contain object-left"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-zinc-50 px-1 text-center text-xs text-zinc-400">
                          —
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">{t("dash.pdfLetterheadLogoHint")}</p>
                    <div className="mt-2 flex flex-col gap-2">
                      <label
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-50 ${logoBusy !== null ? "pointer-events-none opacity-50" : ""}`}
                      >
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          disabled={logoBusy !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void uploadLogo(ten.tenantId, file);
                          }}
                        />
                        <Upload className={`${ICON_INLINE} shrink-0`} aria-hidden />
                        {logoBusy === ten.tenantId
                          ? t("dash.pdfLetterheadLogoUploading")
                          : t("dash.pdfLetterheadLogoPick")}
                      </label>
                      {f.has_logo ? (
                        <button
                          type="button"
                          disabled={logoBusy !== null}
                          onClick={() => void removeLogo(ten.tenantId)}
                          className="inline-flex items-center gap-1 text-left text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                        >
                          <Trash2 className={`${ICON_INLINE} h-3.5 w-3.5 shrink-0`} aria-hidden />
                          {t("dash.pdfLetterheadLogoRemove")}
                        </button>
                      ) : null}
                    </div>
                    <label className="mt-4 block text-sm">
                      <span className="text-zinc-600">{t("dash.pdfLetterheadTagline")}</span>
                      <input
                        value={f.tagline}
                        onChange={(e) => updateField(ten.tenantId, "tagline", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <label className="block text-sm">
                      <span className="text-zinc-600">{t("dash.pdfLetterheadName")}</span>
                      <input
                        value={f.name}
                        onChange={(e) => updateField(ten.tenantId, "name", e.target.value)}
                        placeholder={ten.tenantName}
                        className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-zinc-600">{t("dash.pdfLetterheadAddress")}</span>
                      <textarea
                        value={f.address}
                        onChange={(e) => updateField(ten.tenantId, "address", e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-zinc-600">{t("dash.pdfLetterheadContact")}</span>
                      <input
                        value={f.contact}
                        onChange={(e) => updateField(ten.tenantId, "contact", e.target.value)}
                        placeholder="Phone · email · website"
                        className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void save(ten.tenantId)}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-900 disabled:opacity-50"
                  >
                    <Save className={ICON_INLINE} aria-hidden />
                    {busy === ten.tenantId ? t("dash.pdfLetterheadSaving") : t("dash.pdfLetterheadSave")}
                  </button>
                  <button
                    type="button"
                    onClick={() => openPreview(ten.tenantId)}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-emerald-50"
                  >
                    <Eye className={ICON_INLINE} aria-hidden />
                    {t("dash.pdfLetterheadPreview")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {previewTenantId ? (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
        >
          <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-emerald-100 px-4 py-3">
              <h2 id={dialogTitleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <FileImage className={ICON_INLINE} aria-hidden />
                {t("dash.pdfPreviewTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setPreviewTenantId(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                <X className={ICON_INLINE} aria-hidden />
                {t("dash.pdfPreviewClose")}
              </button>
            </div>
            <iframe
              ref={iframeRef}
              title={t("dash.pdfPreviewTitle")}
              className="min-h-0 w-full flex-1 bg-zinc-100"
              key={`pdf-preview-${previewTenantId}-${reportLangByTenant[previewTenantId] ?? uiLang}-${logoKey}`}
              src={`/api/tenants/${encodeURIComponent(previewTenantId)}/pdf-sample?inline=1&lang=${encodeURIComponent(
                reportLangByTenant[previewTenantId] ?? uiLang,
              )}&t=${Date.now()}&k=${logoKey}`}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
