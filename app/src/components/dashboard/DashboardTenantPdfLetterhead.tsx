"use client";

import { Building2, ExternalLink, Eye, FileImage, Mail, Phone, Save, Smartphone, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { PdfBlobIframeViewer } from "@/components/dashboard/PdfBlobIframeViewer";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { openPdfForPrint } from "@/lib/app/openPdfForPrint";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { LETTERHEAD_CONTACT_GLYPH, parseLetterheadContactLayout, type LetterheadContactLayout } from "@/lib/pdf/letterheadContact";

type Tenant = { tenantId: string; tenantName: string };

type LhState = {
  name: string;
  tagline: string;
  address: string;
  contactLayout: LetterheadContactLayout;
  phone: string;
  mobile: string;
  email: string;
  has_logo: boolean;
};

function emptyLhState(): LhState {
  return {
    name: "",
    tagline: "",
    address: "",
    contactLayout: "inline",
    phone: "",
    mobile: "",
    email: "",
    has_logo: false,
  };
}

function letterheadFromApi(lh: Record<string, unknown> | null | undefined): LhState {
  const contactLayout = parseLetterheadContactLayout(
    typeof lh?.contact_layout === "string" ? lh.contact_layout : null,
  );
  return {
    name: typeof lh?.name === "string" ? lh.name : "",
    tagline: typeof lh?.tagline === "string" ? lh.tagline : "",
    address: typeof lh?.address === "string" ? lh.address : "",
    contactLayout,
    phone: typeof lh?.phone === "string" ? lh.phone : "",
    mobile: typeof lh?.mobile === "string" ? lh.mobile : "",
    email: typeof lh?.email === "string" ? lh.email : "",
    has_logo: lh?.has_logo === true,
  };
}

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
  const tenantsRef = useRef(tenants);
  tenantsRef.current = tenants;

  const loadOne = useCallback(async (tenantId: string): Promise<LhState> => {
    const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/settings`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return emptyLhState();
    const lh = data.pdf_letterhead;
    if (!lh || typeof lh !== "object" || Array.isArray(lh)) return emptyLhState();
    return letterheadFromApi(lh as Record<string, unknown>);
  }, []);

  const refresh = useCallback(async () => {
    const list = tenantsRef.current;
    const pairs = await Promise.all(list.map(async (x) => [x.tenantId, await loadOne(x.tenantId)] as const));
    setByTenant(Object.fromEntries(pairs) as Record<string, LhState>);
  }, [loadOne]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save(tenantId: string) {
    const fields = byTenant[tenantId] ?? emptyLhState();
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
            contact_layout: fields.contactLayout,
            phone: fields.phone.trim() || null,
            mobile: fields.mobile.trim() || null,
            email: fields.email.trim() || null,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      const lh = data.pdf_letterhead;
      if (lh && typeof lh === "object" && !Array.isArray(lh)) {
        setByTenant((prev) => ({
          ...prev,
          [tenantId]: letterheadFromApi(lh as Record<string, unknown>),
        }));
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
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
      if (!res.ok) throw new Error(data.error || t("common.uploadFailed"));
      setByTenant((prev) => ({
        ...prev,
        [tenantId]: { ...(prev[tenantId] ?? emptyLhState()), has_logo: true },
      }));
      setLogoKey((k) => k + 1);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
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
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setByTenant((prev) => ({
        ...prev,
        [tenantId]: { ...(prev[tenantId] ?? emptyLhState()), has_logo: false },
      }));
      setLogoKey((k) => k + 1);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setLogoBusy(null);
    }
  }

  function updateField<K extends keyof Omit<LhState, "has_logo">>(
    tenantId: string,
    key: K,
    value: LhState[K],
  ) {
    setByTenant((prev) => ({
      ...prev,
      [tenantId]: { ...(prev[tenantId] ?? emptyLhState()), [key]: value },
    }));
  }

  function openPreview(tenantId: string) {
    setPreviewTenantId(tenantId);
  }

  const previewPdfUrl = useMemo(() => {
    if (!previewTenantId) return null;
    const lang = reportLangByTenant[previewTenantId] ?? uiLang;
    return `/api/tenants/${encodeURIComponent(previewTenantId)}/pdf-sample?lang=${encodeURIComponent(lang)}&k=${logoKey}`;
  }, [previewTenantId, reportLangByTenant, uiLang, logoKey]);

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
            const f = byTenant[ten.tenantId] ?? emptyLhState();
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
                    <div className="mt-1 flex h-[100px] w-full max-w-[160px] items-center justify-start overflow-hidden rounded-lg border border-emerald-200 bg-white">
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
                    <label className="mt-4 block min-w-0 text-sm">
                      <span className="mb-1 block text-zinc-600">{t("dash.pdfLetterheadTagline")}</span>
                      <input
                        value={f.tagline}
                        onChange={(e) => updateField(ten.tenantId, "tagline", e.target.value)}
                        className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <label className="block min-w-0 text-sm">
                      <span className="mb-1 block text-zinc-600">{t("dash.pdfLetterheadName")}</span>
                      <input
                        value={f.name}
                        onChange={(e) => updateField(ten.tenantId, "name", e.target.value)}
                        placeholder={ten.tenantName}
                        className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block min-w-0 text-sm">
                      <span className="mb-1 block text-zinc-600">{t("dash.pdfLetterheadAddress")}</span>
                      <textarea
                        value={f.address}
                        onChange={(e) => updateField(ten.tenantId, "address", e.target.value)}
                        rows={3}
                        className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="space-y-3">
                      <div>
                        <span className="mb-1 block text-sm text-zinc-600">{t("dash.pdfLetterheadContact")}</span>
                        <fieldset className="flex flex-wrap gap-3 text-sm">
                          <legend className="sr-only">{t("dash.pdfLetterheadContactLayout")}</legend>
                          <label className="inline-flex cursor-pointer items-center gap-1.5">
                            <input
                              type="radio"
                              name={`lh-contact-layout-${ten.tenantId}`}
                              checked={f.contactLayout === "inline"}
                              onChange={() => updateField(ten.tenantId, "contactLayout", "inline")}
                              className="text-emerald-800"
                            />
                            {t("dash.pdfLetterheadContactInline")}
                          </label>
                          <label className="inline-flex cursor-pointer items-center gap-1.5">
                            <input
                              type="radio"
                              name={`lh-contact-layout-${ten.tenantId}`}
                              checked={f.contactLayout === "stacked"}
                              onChange={() => updateField(ten.tenantId, "contactLayout", "stacked")}
                              className="text-emerald-800"
                            />
                            {t("dash.pdfLetterheadContactStacked")}
                          </label>
                        </fieldset>
                      </div>
                      <label className="block min-w-0 text-sm">
                        <span className="mb-1 flex items-center gap-1.5 text-zinc-600">
                          <Phone className={`${ICON_INLINE} shrink-0 text-emerald-800/80`} aria-hidden />
                          <span aria-hidden>{LETTERHEAD_CONTACT_GLYPH.phone}</span>
                          {t("dash.pdfLetterheadPhone")}
                        </span>
                        <input
                          value={f.phone}
                          onChange={(e) => updateField(ten.tenantId, "phone", e.target.value)}
                          placeholder={t("dash.pdfLetterheadPhonePlaceholder")}
                          className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block min-w-0 text-sm">
                        <span className="mb-1 flex items-center gap-1.5 text-zinc-600">
                          <Smartphone className={`${ICON_INLINE} shrink-0 text-emerald-800/80`} aria-hidden />
                          <span aria-hidden>{LETTERHEAD_CONTACT_GLYPH.mobile}</span>
                          {t("dash.pdfLetterheadMobile")}
                        </span>
                        <input
                          value={f.mobile}
                          onChange={(e) => updateField(ten.tenantId, "mobile", e.target.value)}
                          placeholder={t("dash.pdfLetterheadMobilePlaceholder")}
                          className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block min-w-0 text-sm">
                        <span className="mb-1 flex items-center gap-1.5 text-zinc-600">
                          <Mail className={`${ICON_INLINE} shrink-0 text-emerald-800/80`} aria-hidden />
                          <span aria-hidden>{LETTERHEAD_CONTACT_GLYPH.email}</span>
                          {t("dash.pdfLetterheadEmail")}
                        </span>
                        <input
                          value={f.email}
                          onChange={(e) => updateField(ten.tenantId, "email", e.target.value)}
                          placeholder={t("dash.pdfLetterheadEmailPlaceholder")}
                          className="block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                          inputMode="email"
                          autoComplete="email"
                        />
                      </label>
                      <p className="text-xs text-zinc-500">{t("dash.pdfLetterheadContactHint")}</p>
                    </div>
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
              <div className="flex flex-wrap items-center gap-2">
                {previewPdfUrl ? (
                  <button
                    type="button"
                    onClick={() => openPdfForPrint(previewPdfUrl)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-emerald-50"
                  >
                    <ExternalLink className={ICON_INLINE} aria-hidden />
                    {t("dash.pdfPreviewOpenTab")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPreviewTenantId(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  <X className={ICON_INLINE} aria-hidden />
                  {t("dash.pdfPreviewClose")}
                </button>
              </div>
            </div>
            {previewPdfUrl ? (
              <PdfBlobIframeViewer
                key={previewPdfUrl}
                pdfUrl={previewPdfUrl}
                previewKey={logoKey}
                title={t("dash.pdfPreviewTitle")}
                className="min-h-0 w-full flex-1 bg-zinc-100"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
