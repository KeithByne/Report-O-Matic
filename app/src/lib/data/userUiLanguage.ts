import { getServiceSupabase } from "@/lib/supabase/service";
import { isUiLang, type UiLang } from "@/lib/i18n/uiStrings";

const UI_PREF_KEY_PREFIX = "ui-lang::";

declare global {
  // eslint-disable-next-line no-var -- dev-only process cache
  var __rom_dev_ui_lang__: Map<string, UiLang> | undefined;
}

function devMap(): Map<string, UiLang> {
  if (!globalThis.__rom_dev_ui_lang__) globalThis.__rom_dev_ui_lang__ = new Map<string, UiLang>();
  return globalThis.__rom_dev_ui_lang__;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function prefKey(email: string): string {
  return `${UI_PREF_KEY_PREFIX}${normalizeEmail(email)}`;
}

export function userUiLanguagePrefKey(email: string): string {
  return prefKey(email);
}

export async function getStoredUiLanguageForEmail(email: string): Promise<UiLang | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const supabase = getServiceSupabase();
  if (supabase) {
    const { data } = await supabase.from("auth_passwords").select("password_hash").eq("email", prefKey(normalized)).maybeSingle();
    const raw = (data as { password_hash?: unknown } | null)?.password_hash;
    return typeof raw === "string" && isUiLang(raw.trim()) ? (raw.trim() as UiLang) : null;
  }
  return devMap().get(normalized) ?? null;
}

export async function setStoredUiLanguageForEmail(email: string, language: UiLang): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const supabase = getServiceSupabase();
  if (supabase) {
    await supabase
      .from("auth_passwords")
      .upsert({ email: prefKey(normalized), password_hash: language }, { onConflict: "email" });
    return;
  }
  devMap().set(normalized, language);
}
