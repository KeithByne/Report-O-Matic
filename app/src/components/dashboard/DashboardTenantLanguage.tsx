"use client";

import { Languages } from "lucide-react";
import { useId, useState } from "react";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { REPORT_LANGUAGES, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { reportLanguageOptionLabel } from "@/lib/i18n/uiStrings";

type Tenant = { tenantId: string; tenantName: string; canEditSettings: boolean };

export function DashboardTenantLanguage({
  tenants,
  langs,
  onLanguageSaved,
  embedded = false,
}: {
  tenants: Tenant[];
  langs: Record<string, ReportLanguageCode>;
  onLanguageSaved: (tenantId: string, code: ReportLanguageCode) => void;
  /** Omit outer card; compact block for use inside another section (e.g. school overview). */
  embedded?: boolean;
}) {
  const { t, lang: uiLang } = useUiLanguage();
  const [busy, setBusy] = useState<string | null>(null);
  const cardTitleId = useId();

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
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      onLanguageSaved(tenantId, code);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(null);
    }
  }

  if (tenants.length === 0) return null;

  const controls = (
    <ul className={embedded ? "space-y-3" : "mt-4 space-y-4"}>
      {tenants.map((row) => {
        const schoolNameId = `${cardTitleId}-school-${row.tenantId}`;
        return (
          <li key={row.tenantId} className="flex flex-col gap-2">
            <span id={schoolNameId} className="text-sm font-medium text-zinc-900">
              {row.tenantName}
            </span>
            <label className="block min-w-0 text-sm">
              <select
                aria-labelledby={`${schoolNameId} ${cardTitleId}`}
                value={langs[row.tenantId] ?? "en"}
                onChange={(e) => void save(row.tenantId, e.target.value as ReportLanguageCode)}
                disabled={busy !== null || !row.canEditSettings}
                className="block w-full max-w-[30ch] rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-emerald-50 disabled:text-zinc-600"
              >
                {REPORT_LANGUAGES.map((o) => (
                  <option key={o.code} value={o.code}>
                    {reportLanguageOptionLabel(uiLang, o.code)}
                  </option>
                ))}
              </select>
            </label>
          </li>
        );
      })}
    </ul>
  );

  if (embedded) {
    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
        <h3 id={cardTitleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Languages className={ICON_INLINE} aria-hidden />
          {t("dash.tenantLangTitle")}
        </h3>
        <p className="mt-1 text-xs text-zinc-600">{t("dash.tenantLangHint")}</p>
        {controls}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
      <h2 id={cardTitleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <Languages className={ICON_INLINE} aria-hidden />
        {t("dash.tenantLangTitle")}
      </h2>
      <p className="mt-1 text-sm text-zinc-600">{t("dash.tenantLangHint")}</p>
      {controls}
    </section>
  );
}
