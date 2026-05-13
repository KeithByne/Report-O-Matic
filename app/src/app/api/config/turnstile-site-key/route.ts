import { NextResponse } from "next/server";

/**
 * Public read of the Turnstile **site** key for `landing.html` and client pages.
 * Prefer `NEXT_PUBLIC_TURNSTILE_SITE` in Vercel (avoids “KEY” in a public var name).
 * Legacy: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SITE_KEY`.
 * The secret stays server-only (`TURNSTILE_SECRET_KEY`).
 */
export async function GET() {
  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE?.trim() ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ||
    process.env.TURNSTILE_SITE_KEY?.trim() ||
    "";
  return NextResponse.json(
    { site_key: siteKey },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
