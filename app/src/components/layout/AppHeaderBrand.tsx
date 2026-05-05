"use client";

import { useEffect, useMemo, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";

/** Match static landing brand assets (`public/landing.html`). */
const LOGO_ORIGINAL = ["/rom-logo.webp", "/rom-logo.png"] as const;

/** Night View: add `public/Report-O-Matic NightView.png` (spaces OK; URL-encoded below). */
const NIGHT_LOGO_PATH = `/${encodeURIComponent("Report-O-Matic NightView.png")}`;

/**
 * Header brand building blocks:
 * - `AppHeaderLogo`: logo only (for left column space)
 * - `AppHeaderWordmark`: text only
 * - `AppHeaderBrand`: compact inline (logo + text) for legacy usage
 */
export function AppHeaderLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const { displayTheme } = useUiLanguage();
  const candidates = useMemo(
    () =>
      displayTheme === "night" ? ([NIGHT_LOGO_PATH, ...LOGO_ORIGINAL] as const) : LOGO_ORIGINAL,
    [displayTheme],
  );
  const [logoIx, setLogoIx] = useState(0);

  useEffect(() => {
    setLogoIx(0);
  }, [displayTheme]);

  return (
    // ~2× prior sizes (sm was 2.75rem, md was 3rem) so the mark reads clearly in all app headers.
    <div className={size === "sm" ? "h-[5.5rem] w-[5.5rem] shrink-0" : "h-24 w-24 shrink-0"}>
      {logoIx < candidates.length ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={candidates[logoIx]}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setLogoIx((n) => n + 1)}
        />
      ) : null}
    </div>
  );
}

export function AppHeaderWordmark() {
  const { t } = useUiLanguage();
  return (
    <div className="text-lg font-semibold leading-none tracking-tight text-zinc-900">{t("brand.saasName")}</div>
  );
}

export function AppHeaderBrand() {
  return (
    <div className="flex items-center gap-2">
      <AppHeaderLogo />
      <AppHeaderWordmark />
    </div>
  );
}
