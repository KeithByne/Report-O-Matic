"use client";

import { useState } from "react";

/** Match static landing brand assets (`public/landing.html`). */
const LOGO_CANDIDATES = ["/rom-logo.webp", "/rom-logo.png"] as const;

/**
 * App name + optional logo. Logo height is 110% of the adjacent wordmark scale (`text-lg` / 18px titles).
 */
export function AppHeaderBrand() {
  const [logoIx, setLogoIx] = useState(0);

  return (
    <div className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight text-zinc-900">
      {logoIx < LOGO_CANDIDATES.length ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={LOGO_CANDIDATES[logoIx]}
          alt=""
          className="h-[calc(1.125rem*1.1)] w-auto shrink-0 object-contain"
          onError={() => setLogoIx((n) => n + 1)}
        />
      ) : null}
      <span className="translate-y-[0.5px]">Report-O-Matic</span>
    </div>
  );
}
