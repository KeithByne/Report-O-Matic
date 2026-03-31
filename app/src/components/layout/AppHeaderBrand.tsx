"use client";

import { useState } from "react";

/** Match static landing brand assets (`public/landing.html`). */
const LOGO_CANDIDATES = ["/rom-logo.webp", "/rom-logo.png"] as const;

/**
 * Header brand building blocks:
 * - `AppHeaderLogo`: logo only (for left column space)
 * - `AppHeaderWordmark`: text only
 * - `AppHeaderBrand`: compact inline (logo + text) for legacy usage
 */
export function AppHeaderLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const [logoIx, setLogoIx] = useState(0);

  return (
    // Target: logo occupies ~80% of common header height.
    <div className={size === "sm" ? "h-11 w-11" : "h-12 w-12"}>
      {logoIx < LOGO_CANDIDATES.length ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={LOGO_CANDIDATES[logoIx]}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setLogoIx((n) => n + 1)}
        />
      ) : null}
    </div>
  );
}

export function AppHeaderWordmark() {
  return <div className="text-lg font-semibold leading-none tracking-tight text-zinc-900">Report-O-Matic</div>;
}

export function AppHeaderBrand() {
  return (
    <div className="flex items-center gap-2">
      <AppHeaderLogo />
      <AppHeaderWordmark />
    </div>
  );
}
