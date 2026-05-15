"use client";

import { useEffect, useMemo, useState } from "react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";

/** Match static landing brand assets (`public/landing.html`). Day view: transparent PNG in `public`. */
const LOGO_ORIGINAL = ["/LogoReport-O-Matic.png"] as const;

/** Night View: `public/rom-logo-blue-trans.png` */
const NIGHT_LOGO_PATH = "/rom-logo-blue-trans.png";

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
    // sm/md box sizes (+15% vs 5.5rem / 6rem) so day and night marks read clearly in headers.
    <div className={size === "sm" ? "h-[6.325rem] w-[6.325rem] shrink-0" : "h-[6.9rem] w-[6.9rem] shrink-0"}>
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
