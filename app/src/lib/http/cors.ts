const DEFAULT_ALLOW_METHODS = "POST, OPTIONS";
const DEFAULT_ALLOW_HEADERS = "content-type";
const DEFAULT_MAX_AGE = "86400";

export type CorsDecision =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; headers: Record<string, string> };

function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * CORS allowlist for browser requests.
 *
 * - If no `Origin` header is present (server-to-server or same-origin navigation), no CORS headers are needed.
 * - If `ROM_CORS_ALLOW_ORIGINS` includes "*", we allow any Origin (not recommended for prod).
 * - To allow `file://` during local dev, the browser sends `Origin: null`; you may add `null` to the allowlist.
 */
export function corsHeadersForRequest(req: Request): CorsDecision {
  const origin = req.headers.get("origin");
  const allow = parseAllowlist(process.env.ROM_CORS_ALLOW_ORIGINS);

  const base: Record<string, string> = {
    "access-control-allow-methods": DEFAULT_ALLOW_METHODS,
    "access-control-allow-headers": DEFAULT_ALLOW_HEADERS,
    "access-control-max-age": DEFAULT_MAX_AGE,
  };

  // No Origin header → not a browser CORS request. Don't add allow-origin.
  if (!origin) return { ok: true, headers: base };

  if (allow.includes("*") || allow.includes(origin)) {
    return {
      ok: true,
      headers: {
        ...base,
        "access-control-allow-origin": origin,
        vary: "Origin",
      },
    };
  }

  return { ok: false, headers: { ...base, vary: "Origin" } };
}

