"use client";

import { Building2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";

type AddSchoolFormProps = {
  /** Omit outer section + title (use inside another card). */
  embedded?: boolean;
  /** When embedded, omit the default heading (parent supplies the section title). */
  suppressEmbeddedHeading?: boolean;
};

export function AddSchoolForm({ embedded = false, suppressEmbeddedHeading = false }: AddSchoolFormProps) {
  const router = useRouter();
  const { t } = useUiLanguage();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      setName("");
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t("common.failed"));
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="block min-w-[12rem] flex-1 text-sm">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("dash.addSchoolPlaceholder")}
          disabled={busy}
          className={`w-full rounded-lg border px-3 py-2 text-sm text-zinc-900 ${
            embedded ? "border-emerald-200 bg-white" : "border-emerald-200 bg-white"
          }`}
          aria-label={t("dash.addSchoolPlaceholder")}
        />
      </div>
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        <Plus className={ICON_INLINE} aria-hidden />
        {busy ? t("dash.addSchoolWorking") : t("dash.addSchoolButton")}
      </button>
    </form>
  );

  if (embedded) {
    if (suppressEmbeddedHeading) {
      return <div>{form}</div>;
    }
    return (
      <div className="border-t border-emerald-100 pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
          <Building2 className={ICON_INLINE} aria-hidden />
          {t("dash.addSchoolTitle")}
        </h3>
        <div className="mt-3">{form}</div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
        <Building2 className={ICON_INLINE} aria-hidden />
        {t("dash.addSchoolTitle")}
      </h2>
      <div className="mt-4">{form}</div>
    </section>
  );
}
