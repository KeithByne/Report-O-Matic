"use client";

import type { UiLang } from "@/lib/i18n/uiStrings";
import { uiLanguageNativeLabel } from "@/lib/i18n/uiStrings";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";

/** Kept in English by product choice: only the option list uses native language names. */
const UI_LANGUAGE_SELECTOR_LABEL = "UI language";

export function GlobeLanguageSwitcher() {
  const { lang, setLang, options } = useUiLanguage();

  return (
    <label className="flex min-w-0 flex-col gap-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2 py-1.5 text-sm shadow-sm">
      <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-700">
        <span className="text-lg leading-none" aria-hidden>
          🌐
        </span>
        {UI_LANGUAGE_SELECTOR_LABEL}
      </span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as UiLang)}
        aria-label={UI_LANGUAGE_SELECTOR_LABEL}
        className="rom-ui-language-select block w-full min-w-0 max-w-[min(18rem,100%)] cursor-pointer rounded-md border-0 bg-transparent py-0.5 text-sm font-medium text-zinc-900 focus:outline-none focus:ring-0"
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {uiLanguageNativeLabel(o.code)}
          </option>
        ))}
      </select>
    </label>
  );
}
