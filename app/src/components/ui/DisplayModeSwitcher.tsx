"use client";

import { Monitor, Moon, Type } from "lucide-react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { HEADER_CONTROL_BLOCK, HEADER_CONTROL_SELECT } from "@/components/layout/headerControlStyles";
import { ICON_INLINE } from "@/components/ui/iconSizes";

export function DisplayModeSwitcher() {
  const { t, displayTheme, setDisplayTheme, displayText, setDisplayText } = useUiLanguage();

  return (
    <div className={HEADER_CONTROL_BLOCK}>
      <span className="sr-only">{t("display.title")}</span>
      <div className="flex w-full items-center gap-1">
        <Monitor className={`${ICON_INLINE} shrink-0`} aria-hidden />
        <select
          aria-label={t("display.theme")}
          value={displayTheme}
          onChange={(e) => setDisplayTheme(e.target.value === "night" ? "night" : "original")}
          className={HEADER_CONTROL_SELECT}
        >
          <option value="original">{t("display.theme.original")}</option>
          <option value="night">{t("display.theme.night")}</option>
        </select>
        <Moon className={`${ICON_INLINE} shrink-0`} aria-hidden />
      </div>
      <div className="flex w-full items-center gap-1">
        <Type className={`${ICON_INLINE} shrink-0`} aria-hidden />
        <select
          aria-label={t("display.text")}
          value={displayText}
          onChange={(e) => setDisplayText(e.target.value === "bold" ? "bold" : "normal")}
          className={HEADER_CONTROL_SELECT}
        >
          <option value="normal">{t("display.text.normal")}</option>
          <option value="bold">{t("display.text.bold")}</option>
        </select>
      </div>
    </div>
  );
}
