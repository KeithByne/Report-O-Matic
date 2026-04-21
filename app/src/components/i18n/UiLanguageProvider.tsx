"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type UiLang,
  isUiLang,
  translate as translateMsg,
  UI_LANG_OPTIONS,
} from "@/lib/i18n/uiStrings";

const STORAGE_KEY = "rom_ui_language";
const DISPLAY_THEME_KEY = "rom_display_theme";
const DISPLAY_TEXT_KEY = "rom_display_text";

export type DisplayTheme = "original" | "night";
export type DisplayText = "normal" | "bold";

type Ctx = {
  lang: UiLang;
  setLang: (l: UiLang) => void;
  displayTheme: DisplayTheme;
  setDisplayTheme: (v: DisplayTheme) => void;
  displayText: DisplayText;
  setDisplayText: (v: DisplayText) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  options: typeof UI_LANG_OPTIONS;
};

const UiLangContext = createContext<Ctx | null>(null);

export function UiLanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>("en");
  const [displayTheme, setDisplayThemeState] = useState<DisplayTheme>("original");
  const [displayText, setDisplayTextState] = useState<DisplayText>("normal");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && isUiLang(raw)) setLangState(raw);
      const rawTheme = localStorage.getItem(DISPLAY_THEME_KEY);
      if (rawTheme === "original" || rawTheme === "night") setDisplayThemeState(rawTheme);
      const rawText = localStorage.getItem(DISPLAY_TEXT_KEY);
      if (rawText === "normal" || rawText === "bold") setDisplayTextState(rawText);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setLang = useCallback((l: UiLang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
      document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    }
  }, []);

  const setDisplayTheme = useCallback((v: DisplayTheme) => {
    setDisplayThemeState(v);
    try {
      localStorage.setItem(DISPLAY_THEME_KEY, v);
    } catch {
      /* ignore */
    }
  }, []);

  const setDisplayText = useCallback((v: DisplayText) => {
    setDisplayTextState(v);
    try {
      localStorage.setItem(DISPLAY_TEXT_KEY, v);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
      document.documentElement.dataset.romTheme = displayTheme;
      document.documentElement.dataset.romText = displayText;
    }
  }, [lang, ready, displayTheme, displayText]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translateMsg(lang, key, vars),
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, displayTheme, setDisplayTheme, displayText, setDisplayText, t, options: UI_LANG_OPTIONS }),
    [lang, setLang, displayTheme, setDisplayTheme, displayText, setDisplayText, t],
  );

  return <UiLangContext.Provider value={value}>{children}</UiLangContext.Provider>;
}

export function useUiLanguage(): Ctx {
  const c = useContext(UiLangContext);
  if (!c) throw new Error("useUiLanguage must be used within UiLanguageProvider");
  return c;
}

/** Safe hook: returns English if provider missing (should not happen in app shell). */
export function useUiLanguageOptional(): Ctx | null {
  return useContext(UiLangContext);
}
