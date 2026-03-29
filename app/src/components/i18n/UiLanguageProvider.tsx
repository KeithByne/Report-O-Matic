"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type UiLang,
  isUiLang,
  translate as translateMsg,
  UI_LANG_OPTIONS,
} from "@/lib/i18n/uiStrings";

const STORAGE_KEY = "rom_ui_language";

type Ctx = {
  lang: UiLang;
  setLang: (l: UiLang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  options: typeof UI_LANG_OPTIONS;
};

const UiLangContext = createContext<Ctx | null>(null);

export function UiLanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && isUiLang(raw)) setLangState(raw);
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
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang, ready]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translateMsg(lang, key, vars),
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, t, options: UI_LANG_OPTIONS }),
    [lang, setLang, t],
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
