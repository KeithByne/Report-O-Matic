"use client";

import { useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { REPORT_LANGUAGES, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { reportLanguageOptionLabel } from "@/lib/i18n/uiStrings";

type Tenant = { tenantId: string; tenantName: string; canEditSettings: boolean };

export function DashboardTenantLanguage({
  tenants,
  langs,
  onLanguageSaved,
}: {
  tenants: Tenant[];
  langs: Record<string, ReportLanguageCode>;
  onLanguageSaved: (tenantId: string, code: ReportLanguageCode) => void;
}) {
  const { t, lang: uiLang } = useUiLanguage();
  const [busy, setBusy] = useState<string | null>(null);

  async function save(tenantId: string, code: ReportLanguageCode) {
    const row = tenants.find((x) => x.tenantId === tenantId);
    if (!row?.canEditSettings) return;
    setBusy(tenantId);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ default_report_language: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      onLanguageSaved(tenantId, code);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (tenants.length === 0) return null;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">{t("dash.tenantLangTitle")}</h2>
      <p className="mt-1 text-sm text-zinc-600">
        <span aria-hidden className="mr-1">
          🌐
        </span>
        {t("dash.tenantLangHint")}
      </p>
      <ul className="mt-4 space-y-4">
        {tenants.map((row) => (
          <li key={row.tenantId} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium text-zinc-900">{row.tenantName}</span>
            <select
              value={langs[row.tenantId] ?? "en"}
              onChange={(e) => void save(row.tenantId, e.target.value as ReportLanguageCode)}
              disabled={busy !== null || !row.canEditSettings}
              className="max-w-xs rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-emerald-50 disabled:text-zinc-600"
            >
              {REPORT_LANGUAGES.map((o) => (
                <option key={o.code} value={o.code}>
                  {reportLanguageOptionLabel(uiLang, o.code)}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}
