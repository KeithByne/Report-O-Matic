import crypto from "node:crypto";
import { tryRequireRuntimeSecret } from "@/lib/security/envSecrets";

export type SessionPayload = {
  sid: string;
  email: string;
  exp: number; // unix ms
};

function getSecretOrNull(): string | null {
  const r = tryRequireRuntimeSecret("ROM_SESSION_SECRET", {
    devFallback: "dev-change-me-too",
    minLength: 24,
  });
  return r.ok ? r.value : null;
}

/** Returns null when session signing is not configured in production (avoid throwing from API routes). */
export function signSession(payload: SessionPayload): string | null {
  const secret = getSecretOrNull();
  if (!secret) return null;
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string): SessionPayload | null {
  const secret = getSecretOrNull();
  if (!secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let expected = "";
  try {
    expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  } catch {
    return null;
  }
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload || typeof payload.exp !== "number" || typeof payload.email !== "string") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

