import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { corsHeadersForRequest } from "@/lib/http/cors";
import { getPasswordHashForEmail } from "@/lib/auth/passwordStore";
import { newResetChallengeId, savePasswordResetChallenge } from "@/lib/auth/passwordResetChallenge";
import { sha256Hex } from "@/lib/auth/devStore";
import { Resend } from "resend";
import { CODE_DELIVERY_NOTE_TEXT_LINE, codeDeliveryNoteHtml } from "@/lib/email/codeDeliveryNote";

type Body = { email?: unknown; turnstile_token?: unknown };

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

function getPepper(): string {
  return process.env.ROM_OTP_PEPPER || "dev-change-me";
}

function getOtpTtlMs(): number {
  const raw = process.env.ROM_OTP_TTL_SECONDS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 60 && n <= 3600) return n * 1000;
  }
  return process.env.NODE_ENV === "production" ? 180_000 : 600_000;
}

function randomDigits(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += String(bytes[i] % 10);
  return out;
}

function getFromEmail(): string | null {
  const v = process.env.ROM_FROM_EMAIL;
  return v ? v.trim() : null;
}

async function sendResetEmail(opts: { to: string; code: string; expiresInSeconds: number }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromEmail();
  if (!apiKey) throw new Error("Missing RESEND_API_KEY.");
  if (!from) throw new Error("Missing ROM_FROM_EMAIL.");
  const resend = new Resend(apiKey);
  const subject = `Report-O-Matic password reset code: ${opts.code}`;
  const text = [
    `Use this code to reset your Report-O-Matic password: ${opts.code}`,
    ``,
    `It expires in ${opts.expiresInSeconds} seconds.`,
    ``,
    CODE_DELIVERY_NOTE_TEXT_LINE,
    ``,
    `If you didn’t request this, you can ignore this email. Your account is still safe.`,
  ].join("\n");
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#0b1220;">
      <h2 style="margin:0 0 12px;">Reset your Report-O-Matic password</h2>
      <p style="margin:0 0 14px; font-size:14px; line-height:1.6;">
        Use this code to reset your password:
      </p>
      <div style="display:inline-block; padding:12px 14px; border:1px solid #e5e7eb; border-radius:12px; background:#f9fafb; font-size:22px; letter-spacing:4px; font-weight:700;">
        ${opts.code}
      </div>
      <p style="margin:14px 0 0; font-size:13px; color:#334155; line-height:1.6;">
        Expires in ${opts.expiresInSeconds} seconds.
      </p>
      ${codeDeliveryNoteHtml()}
      <p style="margin:10px 0 0; font-size:12px; color:#64748b; line-height:1.6;">
        If you didn’t request this, you can ignore this email.
      </p>
    </div>
  `.trim();
  const result = await resend.emails.send({ from, to: opts.to, subject, text, html });
  if ("error" in result && result.error) throw new Error(`Email send failed: ${result.error.message || "unknown error"}`);
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
  const ip = getClientIp(req);

  const rl1 = checkRateLimit({ key: `pwreset:ip:${ip}`, limit: 8, windowMs: 60_000, nowMs });
  if (!rl1.ok) return NextResponse.json({ error: "Too many requests. Please wait and try again." }, { status: 429, headers: cors.headers });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: cors.headers });
  }

  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  if (!email || !email.includes("@") || email.length > 320) {
    return NextResponse.json({ error: "Please provide a valid email." }, { status: 400, headers: cors.headers });
  }

  // Always require Turnstile
  const token = typeof body.turnstile_token === "string" ? body.turnstile_token.trim() : "";
  if (!token) return NextResponse.json({ error: "Human verification required." }, { status: 400, headers: cors.headers });
  const tsSecret = process.env.TURNSTILE_SECRET_KEY;
  if (!tsSecret) return NextResponse.json({ error: "Human verification is not configured." }, { status: 500, headers: cors.headers });

  try {
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: tsSecret, response: token, remoteip: ip }),
    });
    const verifyJson = (await verifyRes.json()) as { success?: boolean };
    if (!verifyJson.success) return NextResponse.json({ error: "Human verification failed." }, { status: 403, headers: cors.headers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not verify human check.";
    return NextResponse.json({ error: msg }, { status: 500, headers: cors.headers });
  }

  // Avoid leaking whether an email exists: always respond ok.
  const hasPw = await getPasswordHashForEmail(email).catch(() => null);
  if (!hasPw) {
    return NextResponse.json({ ok: true }, { headers: cors.headers });
  }

  const challengeId = newResetChallengeId();
  const code = randomDigits(6);
  const ttlMs = getOtpTtlMs();
  const expiresAtMs = nowMs + ttlMs;
  const codeHash = sha256Hex(`${getPepper()}:${challengeId}:${code}`);

  try {
    await savePasswordResetChallenge({ challengeId, email, codeHash, expiresAtMs });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not create reset challenge.";
    return NextResponse.json({ error: msg }, { status: 500, headers: cors.headers });
  }

  const expiresInSeconds = Math.floor(ttlMs / 1000);
  try {
    await sendResetEmail({ to: email, code, expiresInSeconds });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not send email.";
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: msg }, { status: 500, headers: cors.headers });
  }

  return NextResponse.json({ ok: true, challenge_id: challengeId, expires_in_seconds: expiresInSeconds }, { headers: cors.headers });
}

