"use client";

import type { UiLang } from "@/lib/i18n/uiStrings";
import { reportLanguageOptionLabel } from "@/lib/i18n/uiStrings";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";

export function GlobeLanguageSwitcher() {
  const { lang, setLang, t, options } = useUiLanguage();

  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2 py-1.5 text-sm shadow-sm">
      <span className="text-lg leading-none" aria-hidden>
        🌐
      </span>
      <span className="sr-only">{t("a11y.uiLanguage")}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as UiLang)}
        aria-label={t("a11y.uiLanguage")}
        className="max-w-[9rem] cursor-pointer border-0 bg-transparent py-0.5 text-sm font-medium text-zinc-900 focus:outline-none focus:ring-0"
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {reportLanguageOptionLabel(lang, o.code)}
          </option>
        ))}
      </select>
    </label>
  );
}
