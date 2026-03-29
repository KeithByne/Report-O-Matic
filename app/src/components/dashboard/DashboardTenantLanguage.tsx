"use client";

import { useState } from "react";
import { REPORT_LANGUAGES, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";

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
  const [busy, setBusy] = useState<string | null>(null);

  async function save(tenantId: string, code: ReportLanguageCode) {
    const t = tenants.find((x) => x.tenantId === tenantId);
    if (!t?.canEditSettings) return;
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
      <h2 className="text-sm font-semibold text-zinc-900">Default report language (per school)</h2>
      <p className="mt-1 text-sm text-zinc-600">
        <span aria-hidden className="mr-1">
          🌐
        </span>
        Applies to new classes and reports unless overridden on the class or individual report. Owners and department
        heads can change this; teachers see the current default read-only.
      </p>
      <ul className="mt-4 space-y-4">
        {tenants.map((t) => (
          <li key={t.tenantId} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium text-zinc-900">{t.tenantName}</span>
            <select
              value={langs[t.tenantId] ?? "en"}
              onChange={(e) => void save(t.tenantId, e.target.value as ReportLanguageCode)}
              disabled={busy !== null || !t.canEditSettings}
              className="max-w-xs rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-emerald-50 disabled:text-zinc-600"
            >
              {REPORT_LANGUAGES.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}
