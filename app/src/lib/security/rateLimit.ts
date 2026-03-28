type Bucket = {
  resetAtMs: number;
  remaining: number;
};

declare global {
  var __rom_rate_limit__: Map<string, Bucket> | undefined;
}

function getMap(): Map<string, Bucket> {
  if (!globalThis.__rom_rate_limit__) globalThis.__rom_rate_limit__ = new Map<string, Bucket>();
  return globalThis.__rom_rate_limit__!;
}

/**
 * Very small dev-only fixed-window rate limiter.
 * For production we'll use a durable store (e.g. Upstash Redis) or Supabase.
 */
export function checkRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
  nowMs: number;
}): { ok: true; remaining: number; resetAtMs: number } | { ok: false; remaining: 0; resetAtMs: number } {
  const map = getMap();
  const existing = map.get(opts.key);

  if (!existing || existing.resetAtMs <= opts.nowMs) {
    const b: Bucket = { resetAtMs: opts.nowMs + opts.windowMs, remaining: opts.limit - 1 };
    map.set(opts.key, b);
    return { ok: true, remaining: b.remaining, resetAtMs: b.resetAtMs };
  }

  if (existing.remaining <= 0) {
    return { ok: false, remaining: 0, resetAtMs: existing.resetAtMs };
  }

  existing.remaining -= 1;
  map.set(opts.key, existing);
  return { ok: true, remaining: existing.remaining, resetAtMs: existing.resetAtMs };
}

