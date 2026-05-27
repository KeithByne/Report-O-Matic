"use client";

import type { UiLang } from "@/lib/i18n/uiStrings";
import { uiLanguageNativeLabel } from "@/lib/i18n/uiStrings";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { HEADER_CONTROL_BLOCK, HEADER_CONTROL_SELECT } from "@/components/layout/headerControlStyles";

/** Kept in English by product choice: only the option list uses native language names. */
const UI_LANGUAGE_SELECTOR_LABEL = "Language";

export function GlobeLanguageSwitcher() {
  const { lang, setLang, options } = useUiLanguage();

  return (
    <label className={`${HEADER_CONTROL_BLOCK} bg-emerald-50/70`}>
      <span className="flex items-center gap-1 text-[10px] font-semibold leading-none text-zinc-700">
        <span className="text-base leading-none" aria-hidden>
          🌐
        </span>
        {UI_LANGUAGE_SELECTOR_LABEL}
      </span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as UiLang)}
        aria-label={UI_LANGUAGE_SELECTOR_LABEL}
        className={HEADER_CONTROL_SELECT}
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
