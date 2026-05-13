import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { corsHeadersForRequest } from "@/lib/http/cors";
import { verifySigninOtpChallenge } from "@/lib/auth/signinOtp";
import { normalizeOtpChallengeId, normalizeOtpCodeInput } from "@/lib/auth/otpCodeNormalize";
import { signSession } from "@/lib/auth/session";
import { postSignInRedirectPath } from "@/lib/auth/saasOwnerShared";
import { claimTestAccessIfNeeded } from "@/lib/auth/claimTestAccess";
import { getServiceSupabase } from "@/lib/supabase/service";
import { tryRequireRuntimeSecret } from "@/lib/security/envSecrets";

type Body = {
  email?: unknown;
  challenge_id?: unknown;
  code?: unknown;
};

function jsonError(status: number, message: string, headers: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const xrip = req.headers.get("x-real-ip");
  if (xrip) return xrip.trim();
  return "unknown";
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function OPTIONS(req: Request) {
  const cors = corsHeadersForRequest(req);
  if (!cors.ok) return new NextResponse(null, { status: 403, headers: cors.headers });
  return new NextResponse(null, { status: 204, headers: cors.headers });
}

export async function POST(req: Request) {
  const cors = corsHeadersForRequest(req);
  if (!cors.ok) return NextResponse.json({ error: "Origin not allowed." }, { status: 403, headers: cors.headers });
  const nowMs = Date.now();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError(400, "Invalid JSON body.", cors.headers);
  }

  const emailRaw = typeof body.email === "string" ? body.email : "";
  const challengeRaw = typeof body.challenge_id === "string" ? body.challenge_id : "";
  const codeRaw =
    typeof body.code === "string"
      ? body.code
      : typeof body.code === "number" && Number.isFinite(body.code)
        ? String(Math.trunc(body.code))
        : "";
  const challengeId = normalizeOtpChallengeId(challengeRaw);
  const code = normalizeOtpCodeInput(codeRaw);
  const email = normalizeEmail(emailRaw);

  if (!email || !challengeId || !code) {
    return jsonError(400, "Missing email, challenge_id, or code.", cors.headers);
  }
  if (!isUuid(challengeId)) return jsonError(400, "Invalid challenge id.", cors.headers);
  if (!/^\d{6}$/.test(code)) return jsonError(400, "Code must be 6 digits.", cors.headers);

  const ip = getClientIp(req);
  const rl = checkRateLimit({ key: `verify-signin:${ip}:${email}`, limit: 12, windowMs: 60_000, nowMs });
  if (!rl.ok) {
    return jsonError(429, "Too many attempts. Please wait and try again.", cors.headers);
  }

  const pepperRes = tryRequireRuntimeSecret("ROM_OTP_PEPPER", {
    devFallback: "dev-change-me",
    minLength: 24,
  });
  if (!pepperRes.ok) return jsonError(503, pepperRes.error, cors.headers);

  const verified = await verifySigninOtpChallenge({
    challengeId,
    email,
    code,
    pepper: pepperRes.value,
    nowMs,
  });
  if (!verified.ok) return jsonError(verified.status, verified.message, cors.headers);

  if (getServiceSupabase()) {
    try {
      const claimed = await claimTestAccessIfNeeded({
        email: verified.email,
        testAccessToken: verified.testAccessToken,
        nowMs,
      });
      if (!claimed.ok) return jsonError(claimed.status, claimed.message, cors.headers);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not finalize test access.";
      console.error("[ROM verify-signin] claimTestAccess:", msg);
      return jsonError(500, msg, cors.headers);
    }
  }

  const sessionExpMs = nowMs + 8 * 60 * 60 * 1000;
  const sessionId = crypto.randomUUID();
  const token = signSession({ sid: sessionId, email: verified.email, exp: sessionExpMs });
  if (!token) {
    return NextResponse.json(
      {
        error:
          "ROM_SESSION_SECRET must be set to a strong secret (at least 24 characters) in production before sign-in can complete.",
      },
      { status: 503, headers: cors.headers },
    );
  }

  const redirect = postSignInRedirectPath(verified.email);
  const res = NextResponse.json({ ok: true, redirect }, { headers: cors.headers });
  res.cookies.set("rom_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return res;
}
