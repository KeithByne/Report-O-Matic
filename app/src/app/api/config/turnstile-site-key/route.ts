import { NextResponse } from "next/server";

/**
 * Public read of the Turnstile **site** key for static `landing.html`.
 * The secret stays server-only (`TURNSTILE_SECRET_KEY`). Site key is already exposed to browsers.
 */
export async function GET() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  return NextResponse.json(
    { site_key: siteKey },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
