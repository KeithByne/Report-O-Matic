"use client";

import { Moon, Sun, Type } from "lucide-react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { HEADER_CONTROL_BLOCK, HEADER_CONTROL_SELECT } from "@/components/layout/headerControlStyles";
import { ICON_INLINE } from "@/components/ui/iconSizes";

export function DisplayModeSwitcher() {
  const { t, displayTheme, setDisplayTheme, displayText, setDisplayText } = useUiLanguage();
  const themeButtonClass = (active: boolean) =>
    [
      "inline-flex h-6 w-6 items-center justify-center rounded border text-xs transition",
      active
        ? "border-emerald-500 bg-emerald-100 text-emerald-900"
        : "border-emerald-200 bg-white text-zinc-700 hover:bg-emerald-50",
    ].join(" ");

  return (
    <div className={HEADER_CONTROL_BLOCK}>
      <span className="sr-only">{t("display.title")}</span>
      <div className="flex w-full items-center justify-center gap-1" role="group" aria-label={t("display.theme")}>
        <button
          type="button"
          className={themeButtonClass(displayTheme === "original")}
          aria-label={t("display.theme.original")}
          aria-pressed={displayTheme === "original"}
          title={t("display.theme.original")}
          onClick={() => setDisplayTheme("original")}
        >
          <Sun className={ICON_INLINE} aria-hidden />
        </button>
        <button
          type="button"
          className={themeButtonClass(displayTheme === "night")}
          aria-label={t("display.theme.night")}
          aria-pressed={displayTheme === "night"}
          title={t("display.theme.night")}
          onClick={() => setDisplayTheme("night")}
        >
          <Moon className={ICON_INLINE} aria-hidden />
        </button>
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
