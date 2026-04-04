import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Strip port from Host header (IPv6 may include brackets). */
function hostWithoutPort(host: string): string {
  const h = host.trim().toLowerCase();
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    if (end !== -1) return h.slice(0, end + 1);
  }
  const colon = h.indexOf(":");
  if (colon === -1) return h;
  return h.slice(0, colon);
}

/** RFC1918 — LAN dev URLs (e.g. http://192.168.x.x:3000) must not redirect to production. */
function isPrivateLanIPv4(hostname: string): boolean {
  const raw = hostWithoutPort(hostname);
  const parts = raw.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Do not send dev machines to production when ROM_CANONICAL_HOST is set (breaks sign-in / API). */
function isLocalDevHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (h === "localhost" || h.startsWith("localhost:")) return true;
  if (h === "127.0.0.1" || h.startsWith("127.0.0.1:")) return true;
  if (h.startsWith("[::1]") || h === "[::1]") return true;
  return false;
}

export function middleware(req: NextRequest) {
  if (process.env.ROM_SKIP_CANONICAL_REDIRECT === "1") return NextResponse.next();

  const canonical = (process.env.ROM_CANONICAL_HOST ?? "").trim().toLowerCase();
  if (!canonical) return NextResponse.next();

  const host = (req.headers.get("host") ?? "").trim().toLowerCase();
  if (!host) return NextResponse.next();

  // `next dev` — never redirect away from the dev server.
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  if (isLocalDevHost(host)) return NextResponse.next();
  if (isPrivateLanIPv4(host)) return NextResponse.next();

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

