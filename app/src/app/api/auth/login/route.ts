import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { corsHeadersForRequest } from "@/lib/http/cors";
import { verifyTurnstileToken } from "@/lib/security/verifyTurnstile";
import { hashPassword, verifyPassword } from "@/lib/auth/passwordHash";
import { getPasswordHashForEmail, setPasswordHashIfMissing } from "@/lib/auth/passwordStore";
import { purgeOtpChallengesForEmail } from "@/lib/auth/purgeOtpChallengesForEmail";
import { ensureOwnerTenantForSignup, hasAnyMembership } from "@/lib/data/memberships";
import { getServiceSupabase } from "@/lib/supabase/service";
import { signSession } from "@/lib/auth/session";
import { postSignInRedirectPath } from "@/lib/auth/saasOwnerShared";

type LoginBody = {
  email?: unknown;
  password?: unknown;
  turnstile_token?: unknown;
  mode?: unknown;
  owner_name?: unknown;
  school_name?: unknown;
  referral_code?: unknown;
  test_access_token?: unknown;
  browser_language?: unknown;
};

function jsonError(status: number, message: string, headers: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const xrip = req.headers.get("x-real-ip");
  if (xrip) return xrip.trim();
  return "unknown";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function claimTestAccessIfNeeded(opts: {
  email: string;
  testAccessToken: string | null;
  nowMs: number;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const { email, testAccessToken, nowMs } = opts;
  if (!testAccessToken) return { ok: true };
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, status: 503, message: "Database not configured." };

  const { data: link, error: lErr } = await supabase
    .from("test_access_links")
    .select("token, tenant_id, active")
    .eq("token", testAccessToken)
    .maybeSingle();
  if (lErr) return { ok: false, status: 500, message: lErr.message || "Could not claim test access." };
  if (!link || !(link as { active?: boolean }).active) {
    return { ok: false, status: 400, message: "Test access link is invalid or has already been used." };
  }

  const tenantId = String((link as { tenant_id?: string }).tenant_id || "").trim();
  if (!tenantId) return { ok: false, status: 400, message: "Invalid test tenant." };

  const { error: mErr } = await supabase.from("memberships").insert({
    tenant_id: tenantId,
    user_email: email,
    role: "owner",
  });
  if (mErr) {
    if (mErr.code === "23505") {
      return {
        ok: false,
        status: 409,
        message: "This test link was already used with a different step. Request a new link.",
      };
    }
    return { ok: false, status: 500, message: mErr.message || "Could not grant test access." };
  }

  const { error: cErr } = await supabase.from("owner_credit_ledger").insert({
    owner_email: email,
    delta_credits: 50,
    reason: "manual_adjust",
    tenant_id: tenantId,
    report_id: null,
    stripe_event_id: null,
  });
  if (cErr) {
    await supabase.from("memberships").delete().eq("tenant_id", tenantId).eq("user_email", email).eq("role", "owner");
    return { ok: false, status: 500, message: cErr.message || "Could not grant test credits." };
  }

  const { error: claimErr } = await supabase
    .from("test_access_links")
    .update({ active: false, claimed_by_email: email, claimed_at: new Date(nowMs).toISOString() })
    .eq("token", testAccessToken)
    .eq("active", true);
  if (claimErr) {
    return { ok: false, status: 500, message: claimErr.message || "Could not finalize test access." };
  }
  return { ok: true };
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

  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return jsonError(400, "Invalid JSON body.", cors.headers);
  }

  const emailRaw = typeof body.email === "string" ? body.email : "";
  const email = normalizeEmail(emailRaw);
  if (!email || !email.includes("@") || email.length > 320) {
    return jsonError(400, "Please provide a valid email.", cors.headers);
  }

  const turnstileToken = typeof body.turnstile_token === "string" ? body.turnstile_token.trim() : "";
  const ipForTs = getClientIp(req);
  const ts = await verifyTurnstileToken({ token: turnstileToken, remoteIp: ipForTs });
  if (!ts.ok) return jsonError(ts.status, ts.message, cors.headers);

  const password = typeof body.password === "string" ? body.password : "";
  const pw = password.trim();
  if (!pw) {
    return NextResponse.json({ error: "Password required.", password_required: true }, { status: 400, headers: cors.headers });
  }
  if (pw.length < 8 || pw.length > 200) {
    return jsonError(400, "Password must be at least 8 characters.", cors.headers);
  }

  const mode = body.mode === "signup" ? "signup" : "signin";
  const testAccessTokenRaw = typeof body.test_access_token === "string" ? body.test_access_token.trim() : "";
  const testAccessToken = testAccessTokenRaw || null;

  if (testAccessToken) {
    const supabase = getServiceSupabase();
    if (!supabase) return jsonError(503, "Database not configured.", cors.headers);
    const { data: link, error: lErr } = await supabase
      .from("test_access_links")
      .select("token, active, tenant_id")
      .eq("token", testAccessToken)
      .maybeSingle();
    if (lErr) return jsonError(500, lErr.message || "Could not validate test access link.", cors.headers);
    if (!link || !(link as { active?: boolean }).active) {
      return jsonError(400, "Test access link is invalid or has already been used.", cors.headers);
    }
  }

  const ip = getClientIp(req);
  const rl1 = checkRateLimit({ key: `login:ip:${ip}`, limit: 12, windowMs: 60_000, nowMs });
  if (!rl1.ok) return jsonError(429, "Too many requests. Please wait and try again.", cors.headers);
  const rl2 = checkRateLimit({ key: `login:email:${email}`, limit: 8, windowMs: 60_000, nowMs });
  if (!rl2.ok) return jsonError(429, "Too many requests for this email. Please wait and try again.", cors.headers);

  let alreadyMember = false;
  if (getServiceSupabase()) {
    try {
      alreadyMember = await hasAnyMembership(email);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not verify account.";
      console.error("[ROM login] hasAnyMembership:", msg);
      return jsonError(500, msg, cors.headers);
    }
  }

  let schoolName: string | null = null;
  let referralCode: string | null = null;
  if (mode === "signup") {
    if (!alreadyMember) {
      const owner = typeof body.owner_name === "string" ? body.owner_name.trim() : "";
      const school = typeof body.school_name === "string" ? body.school_name.trim() : "";
      if (!owner || !school) {
        return jsonError(400, "Please provide your name and school name to create an account.", cors.headers);
      }
      schoolName = school;
      const ref = typeof body.referral_code === "string" ? body.referral_code.trim() : "";
      referralCode = ref || null;
    }
  }

  let passwordHash: string | null;
  try {
    passwordHash = await getPasswordHashForEmail(email);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not verify password.";
    console.error("[ROM login] getPasswordHashForEmail:", msg);
    return jsonError(500, msg, cors.headers);
  }

  if (mode === "signin") {
    if (!passwordHash) {
      if (!testAccessToken) {
        return jsonError(
          401,
          "No password on file for this email. Use Sign up to create a school account, or reset your password if you already have one.",
          cors.headers,
        );
      }
      await setPasswordHashIfMissing(email, hashPassword(pw));
    }
    const latestHash = await getPasswordHashForEmail(email);
    if (!latestHash || !verifyPassword(pw, latestHash)) {
      return jsonError(401, "Incorrect password.", cors.headers);
    }
  } else {
    // signup
    if (!passwordHash) {
      const created = await setPasswordHashIfMissing(email, hashPassword(pw));
      if (!created) {
        const again = await getPasswordHashForEmail(email);
        if (!again || !verifyPassword(pw, again)) {
          return jsonError(401, "Incorrect password.", cors.headers);
        }
      }
    } else if (!verifyPassword(pw, passwordHash)) {
      return jsonError(401, "Incorrect password.", cors.headers);
    }
  }

  if (getServiceSupabase()) {
    try {
      if (mode === "signup" && schoolName) {
        await ensureOwnerTenantForSignup({
          email,
          schoolName,
          referralCode,
        });
      }

      const claimed = await claimTestAccessIfNeeded({ email, testAccessToken, nowMs });
      if (!claimed.ok) return jsonError(claimed.status, claimed.message, cors.headers);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not finish sign-up.";
      console.error("[ROM login] post-auth:", msg);
      return jsonError(500, msg, cors.headers);
    }
  }

  try {
    await purgeOtpChallengesForEmail(email, nowMs);
  } catch (e: unknown) {
    console.warn("[ROM login] purge legacy otp_challenges:", e instanceof Error ? e.message : e);
  }

  const sessionExpMs = nowMs + 8 * 60 * 60 * 1000;
  const sessionId = crypto.randomUUID();
  const token = signSession({ sid: sessionId, email, exp: sessionExpMs });
  if (!token) {
    return NextResponse.json(
      {
        error:
          "ROM_SESSION_SECRET must be set to a strong secret (at least 24 characters) in production before sign-in can complete.",
      },
      { status: 503, headers: cors.headers },
    );
  }

  const redirect = postSignInRedirectPath(email);
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
