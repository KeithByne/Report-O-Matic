import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { verifyOtpChallenge } from "@/lib/auth/otpChallenge";
import { signSession } from "@/lib/auth/session";
import { ensureOwnerTenantForSignup } from "@/lib/data/memberships";
import { getServiceSupabase } from "@/lib/supabase/service";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { corsHeadersForRequest } from "@/lib/http/cors";

type VerifyCodeBody = {
  email?: unknown;
  challenge_id?: unknown;
  code?: unknown;
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
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

export async function OPTIONS(req: Request) {
  const cors = corsHeadersForRequest(req);
  if (!cors.ok) return new NextResponse(null, { status: 403, headers: cors.headers });
  return new NextResponse(null, { status: 204, headers: cors.headers });
}

export async function POST(req: Request) {
  const cors = corsHeadersForRequest(req);
  if (!cors.ok) return NextResponse.json({ error: "Origin not allowed." }, { status: 403, headers: cors.headers });
  const nowMs = Date.now();

  let body: VerifyCodeBody;
  try {
    body = (await req.json()) as VerifyCodeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: cors.headers });
  }

  const emailRaw = typeof body.email === "string" ? body.email : "";
  const challengeId = typeof body.challenge_id === "string" ? body.challenge_id : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  const email = normalizeEmail(emailRaw);
  if (!email || !challengeId || !code) {
    return NextResponse.json({ error: "Missing email, challenge_id, or code." }, { status: 400, headers: cors.headers });
  }
  if (!isUuid(challengeId)) return NextResponse.json({ error: "Invalid challenge id." }, { status: 400, headers: cors.headers });
  if (!/^\d{6,7}$/.test(code)) return NextResponse.json({ error: "Code must be 6 or 7 digits." }, { status: 400, headers: cors.headers });

  // Rate limit verification attempts.
  const ip = getClientIp(req);
  const rl = checkRateLimit({ key: `verify:${ip}:${email}`, limit: 12, windowMs: 60_000, nowMs });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429, headers: cors.headers });
  }

  const verified = await verifyOtpChallenge({
    challengeId,
    email,
    code,
    pepper: getPepper(),
    nowMs,
  });
  if (!verified.ok) return NextResponse.json({ error: verified.message }, { status: verified.status, headers: cors.headers });

  if (getServiceSupabase()) {
    try {
      if (verified.mode === "signup" && verified.schoolName) {
        await ensureOwnerTenantForSignup({
          email,
          schoolName: verified.schoolName,
          referralCode: verified.referralCode,
        });
      }

      if (verified.testAccessToken) {
        const supabase = getServiceSupabase();
        if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503, headers: cors.headers });

        const { data: link, error: lErr } = await supabase
          .from("test_access_links")
          .select("token, tenant_id, active")
          .eq("token", verified.testAccessToken)
          .maybeSingle();
        if (lErr) {
          return NextResponse.json({ error: lErr.message || "Could not claim test access." }, { status: 500, headers: cors.headers });
        }
        if (!link || !(link as any).active) {
          return NextResponse.json({ error: "Test access link is invalid or has already been used." }, { status: 400, headers: cors.headers });
        }

        // Mark link as claimed (one-time) and grant teacher access.
        const { error: claimErr } = await supabase
          .from("test_access_links")
          .update({ active: false, claimed_by_email: email, claimed_at: new Date(nowMs).toISOString() })
          .eq("token", verified.testAccessToken)
          .eq("active", true);
        if (claimErr) {
          return NextResponse.json({ error: claimErr.message || "Could not claim test access." }, { status: 500, headers: cors.headers });
        }

        const tenantId = String((link as any).tenant_id || "").trim();
        if (tenantId) {
          const { error: mErr } = await supabase.from("memberships").insert({
            tenant_id: tenantId,
            user_email: email,
            role: "teacher",
          });
          if (mErr && mErr.code !== "23505") {
            return NextResponse.json({ error: mErr.message || "Could not grant test access." }, { status: 500, headers: cors.headers });
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not finish signup.";
      console.error("[ROM verify-code] ensureOwnerTenantForSignup:", msg);
      return NextResponse.json({ error: msg }, { status: 500, headers: cors.headers });
    }
  }

  const sessionExpMs = nowMs + 8 * 60 * 60 * 1000; // 8 hours
  const sessionId = crypto.randomUUID();
  const token = signSession({ sid: sessionId, email, exp: sessionExpMs });
  const res = NextResponse.json({ ok: true }, { headers: cors.headers });
  res.cookies.set("rom_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return res;
}

