import crypto from "node:crypto";

type ScryptParams = {
  N: number;
  r: number;
  p: number;
  keyLen: number;
};

const DEFAULT_PARAMS: ScryptParams = { N: 16384, r: 8, p: 1, keyLen: 32 };

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/**
 * Format:
 * scrypt$N$r$p$salt_b64url$hash_b64url
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, DEFAULT_PARAMS.keyLen, {
    N: DEFAULT_PARAMS.N,
    r: DEFAULT_PARAMS.r,
    p: DEFAULT_PARAMS.p,
    maxmem: 128 * 1024 * 1024,
  });
  return [
    "scrypt",
    String(DEFAULT_PARAMS.N),
    String(DEFAULT_PARAMS.r),
    String(DEFAULT_PARAMS.p),
    b64url(salt),
    b64url(key),
  ].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6) return false;
    const [alg, nStr, rStr, pStr, saltStr, hashStr] = parts;
    if (alg !== "scrypt") return false;
    const N = Number.parseInt(nStr, 10);
    const r = Number.parseInt(rStr, 10);
    const p = Number.parseInt(pStr, 10);
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

    const salt = fromB64url(saltStr);
    const expected = fromB64url(hashStr);
    const derived = crypto.scryptSync(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 128 * 1024 * 1024,
    });
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

