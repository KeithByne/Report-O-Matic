"use client";

import { Monitor, Moon, Type } from "lucide-react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { ICON_INLINE } from "@/components/ui/iconSizes";

export function DisplayModeSwitcher() {
  const { t, displayTheme, setDisplayTheme, displayText, setDisplayText } = useUiLanguage();

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-sm text-zinc-800 shadow-sm">
      <Monitor className={ICON_INLINE} aria-hidden />
      <span className="sr-only">{t("display.title")}</span>
      <select
        aria-label={t("display.theme")}
        value={displayTheme}
        onChange={(e) => setDisplayTheme(e.target.value === "night" ? "night" : "original")}
        className="rounded border border-emerald-200 bg-white px-2 py-1 text-xs"
      >
        <option value="original">{t("display.theme.original")}</option>
        <option value="night">{t("display.theme.night")}</option>
      </select>
      <Moon className={ICON_INLINE} aria-hidden />
      <Type className={ICON_INLINE} aria-hidden />
      <select
        aria-label={t("display.text")}
        value={displayText}
        onChange={(e) => setDisplayText(e.target.value === "bold" ? "bold" : "normal")}
        className="rounded border border-emerald-200 bg-white px-2 py-1 text-xs"
      >
        <option value="normal">{t("display.text.normal")}</option>
        <option value="bold">{t("display.text.bold")}</option>
      </select>
    </div>
  );
}
