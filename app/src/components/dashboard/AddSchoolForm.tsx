"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";

export function AddSchoolForm() {
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
      if (!res.ok) throw new Error(data.error || "Failed");
      setName("");
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-emerald-950">{t("dash.addSchoolTitle")}</h2>
      <p className="mt-1 text-sm text-emerald-900/90">{t("dash.addSchoolHint")}</p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block min-w-[12rem] flex-1 text-sm">
          <span className="text-emerald-900">{t("dash.addSchoolPlaceholder")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("dash.addSchoolPlaceholder")}
            disabled={busy}
            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? t("dash.addSchoolWorking") : t("dash.addSchoolButton")}
        </button>
      </form>
    </section>
  );
}
