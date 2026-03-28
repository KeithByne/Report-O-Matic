import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { verifyOtpChallenge } from "@/lib/auth/otpChallenge";
import { signSession } from "@/lib/auth/session";
import { ensureOwnerTenantForSignup } from "@/lib/data/memberships";
import { getServiceSupabase } from "@/lib/supabase/service";
import { checkRateLimit } from "@/lib/security/rateLimit";

type VerifyCodeBody = {
  email?: unknown;
  challenge_id?: unknown;
  code?: unknown;
};

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: CORS_HEADERS });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getPepper(): string {
  return process.env.ROM_OTP_PEPPER || "dev-change-me";
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const xrip = req.headers.get("x-real-ip");
  if (xrip) return xrip.trim();
  return "unknown";
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const nowMs = Date.now();

  let body: VerifyCodeBody;
  try {
    body = (await req.json()) as VerifyCodeBody;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const emailRaw = typeof body.email === "string" ? body.email : "";
  const challengeId = typeof body.challenge_id === "string" ? body.challenge_id : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  const email = normalizeEmail(emailRaw);
  if (!email || !challengeId || !code) return jsonError(400, "Missing email, challenge_id, or code.");
  if (!isUuid(challengeId)) return jsonError(400, "Invalid challenge id.");
  if (!/^\d{6,7}$/.test(code)) return jsonError(400, "Code must be 6 or 7 digits.");

  // Rate limit verification attempts.
  const ip = getClientIp(req);
  const rl = checkRateLimit({ key: `verify:${ip}:${email}`, limit: 12, windowMs: 60_000, nowMs });
  if (!rl.ok) return jsonError(429, "Too many attempts. Please wait and try again.");

  const verified = await verifyOtpChallenge({
    challengeId,
    email,
    code,
    pepper: getPepper(),
    nowMs,
  });
  if (!verified.ok) return jsonError(verified.status, verified.message);

  if (getServiceSupabase()) {
    try {
      if (verified.mode === "signup" && verified.schoolName) {
        await ensureOwnerTenantForSignup({ email, schoolName: verified.schoolName });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not finish signup.";
      console.error("[ROM verify-code] ensureOwnerTenantForSignup:", msg);
      return jsonError(500, msg);
    }
  }

  const sessionExpMs = nowMs + 8 * 60 * 60 * 1000; // 8 hours
  const sessionId = crypto.randomUUID();
  const token = signSession({ sid: sessionId, email, exp: sessionExpMs });
  const res = NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  res.cookies.set("rom_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return res;
}

