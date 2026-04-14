import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { sha256Hex } from "@/lib/auth/devStore";
import { isSupabaseOtpEnabled, readActiveOtpChallengeForResend, rotateOtpChallengeCode } from "@/lib/auth/otpChallenge";
import { getOtpTtlMs } from "@/lib/auth/otpTtl";
import { verifyPassword } from "@/lib/auth/passwordHash";
import { getPasswordHashForEmail } from "@/lib/auth/passwordStore";
import { corsHeadersForRequest } from "@/lib/http/cors";
import { sendRomOtpEmail } from "@/lib/email/sendRomOtpEmail";
import { verifyTurnstileToken } from "@/lib/security/verifyTurnstile";

type Body = {
  email?: unknown;
  challenge_id?: unknown;
  password?: unknown;
  backup_email?: unknown;
  turnstile_token?: unknown;
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

function getPepper(): string {
  return process.env.ROM_OTP_PEPPER || "dev-change-me";
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function randomDigits(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += String(bytes[i] % 10);
  return out;
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
  const challengeId = typeof body.challenge_id === "string" ? body.challenge_id.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const backupRaw = typeof body.backup_email === "string" ? body.backup_email : "";
  const tsTokenRaw = body.turnstile_token;

  const email = normalizeEmail(emailRaw);
  const backupEmail = normalizeEmail(backupRaw.trim());
  const pw = password.trim();
  const turnstileToken = typeof tsTokenRaw === "string" ? tsTokenRaw.trim() : "";

  if (!email || !challengeId || !backupEmail || !pw) {
    return jsonError(400, "Missing email, challenge, backup email, or password.", cors.headers);
  }
  if (!isUuid(challengeId)) return jsonError(400, "Invalid challenge id.", cors.headers);
  if (!email.includes("@") || email.length > 320) return jsonError(400, "Please provide a valid email.", cors.headers);
  if (!backupEmail.includes("@") || backupEmail.length > 320) {
    return jsonError(400, "Please provide a valid backup email.", cors.headers);
  }
  if (backupEmail === email) {
    return jsonError(400, "Backup email must be different from your sign-in email.", cors.headers);
  }
  if (pw.length < 8 || pw.length > 200) {
    return jsonError(400, "Password must be at least 8 characters.", cors.headers);
  }

  const ip = getClientIp(req);
  const ts = await verifyTurnstileToken({ token: turnstileToken, remoteIp: ip });
  if (!ts.ok) return jsonError(ts.status, ts.message, cors.headers);

  const rl1 = checkRateLimit({ key: `resend-otp-backup:ip:${ip}`, limit: 8, windowMs: 60_000, nowMs });
  if (!rl1.ok) return jsonError(429, "Too many requests. Please wait and try again.", cors.headers);
  const rl2 = checkRateLimit({ key: `resend-otp-backup:email:${email}`, limit: 4, windowMs: 60_000, nowMs });
  if (!rl2.ok) return jsonError(429, "Too many requests for this account. Please wait and try again.", cors.headers);
  const rl3 = checkRateLimit({ key: `resend-otp-backup:backup:${backupEmail}`, limit: 4, windowMs: 60_000, nowMs });
  if (!rl3.ok) return jsonError(429, "Too many requests for this backup address. Please wait and try again.", cors.headers);

  const existing = await getPasswordHashForEmail(email);
  if (!existing || !verifyPassword(pw, existing)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401, headers: cors.headers });
  }

  const challenge = await readActiveOtpChallengeForResend({ challengeId, nowMs });
  if (!challenge.ok) return jsonError(challenge.status, challenge.message, cors.headers);
  if (challenge.email !== email) {
    return jsonError(400, "Email does not match this challenge.", cors.headers);
  }

  const code = randomDigits(6);
  const ttlMs = getOtpTtlMs();
  const expiresAtMs = nowMs + ttlMs;
  const codeHash = sha256Hex(`${getPepper()}:${challengeId}:${code}`);
  const rotated = await rotateOtpChallengeCode({
    challengeId,
    email,
    codeHash,
    expiresAtMs,
    nowMs,
  });
  if (!rotated.ok) return jsonError(rotated.status, rotated.message, cors.headers);

  const expiresInSeconds = Math.floor(ttlMs / 1000);
  const hasEmailConfig = Boolean(process.env.RESEND_API_KEY && process.env.ROM_FROM_EMAIL);

  if (hasEmailConfig) {
    try {
      console.log("[ROM resend-otp-backup] recipient:", backupEmail, "account:", email);
      await sendRomOtpEmail({
        to: backupEmail,
        code,
        mode: challenge.mode,
        expiresInSeconds,
        kind: "backup_resend",
        accountEmail: email,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not send email.";
      if (process.env.NODE_ENV === "production") return jsonError(500, msg, cors.headers);
      console.warn("[ROM resend-otp-backup] Email send failed in dev:", msg);
      if (!isSupabaseOtpEnabled()) {
        console.log(
          `[ROM DEV OTP backup-resend] account=${email} backup=${backupEmail} code=${code} expires_in_s=${expiresInSeconds} challenge=${challengeId}`,
        );
      }
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      return jsonError(500, "Email delivery is not configured.", cors.headers);
    }
    if (!isSupabaseOtpEnabled()) {
      console.log(
        `[ROM DEV OTP backup-resend] account=${email} backup=${backupEmail} code=${code} expires_in_s=${expiresInSeconds} challenge=${challengeId}`,
      );
    }
  }

  return NextResponse.json(
    {
      ok: true,
      expires_in_seconds: expiresInSeconds,
    },
    { headers: cors.headers },
  );
}
