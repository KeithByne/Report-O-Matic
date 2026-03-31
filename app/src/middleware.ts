import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const canonical = (process.env.ROM_CANONICAL_HOST ?? "").trim().toLowerCase();
  if (!canonical) return NextResponse.next();

  const host = (req.headers.get("host") ?? "").trim().toLowerCase();
  if (!host) return NextResponse.next();

  // Avoid redirect loops if host already matches.
  if (host === canonical) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.host = canonical;
  url.protocol = "https:";
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

