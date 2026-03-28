import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { sha256Hex } from "@/lib/auth/devStore";
import { isSupabaseOtpEnabled, newChallengeId, saveOtpChallenge } from "@/lib/auth/otpChallenge";
import { hasAnyMembership } from "@/lib/data/memberships";
import { Resend } from "resend";

type SendCodeBody = {
  email?: unknown;
  mode?: unknown;
  owner_name?: unknown;
  school_name?: unknown;
  browser_language?: unknown;
};

const CORS_HEADERS: Record<string, string> = {
  // Allow calling from standalone file:// landing page during local dev.
  // In production, your landing page should be served from the same origin (report-o-matic.online),
  // and you can lock this down to that origin.
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: CORS_HEADERS });
}

function getClientIp(req: Request): string {
  // In production behind Vercel, you’ll typically use x-forwarded-for.
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

function randomDigits(length: number): string {
  // cryptographically strong digits
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += String(bytes[i] % 10);
  return out;
}

function getFromEmail(): string | null {
  const v = process.env.ROM_FROM_EMAIL;
  if (!v) return null;
  return v.trim();
}

async function sendOtpEmail(opts: {
  to: string;
  code: string;
  mode: "signin" | "signup";
  expiresInSeconds: number;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromEmail();
  if (!apiKey) throw new Error("Missing RESEND_API_KEY.");
  if (!from) throw new Error("Missing ROM_FROM_EMAIL.");

  const resend = new Resend(apiKey);
  const actionLabel = opts.mode === "signup" ? "create your account" : "sign in";
  const subject = `Your Report-O-Matic security code: ${opts.code}`;

  const text = [
    `Your Report-O-Matic security code is: ${opts.code}`,
    ``,
    `It expires in ${opts.expiresInSeconds} seconds.`,
    ``,
    `Use this code to ${actionLabel}. If you didn’t request this, you can ignore this email.`,
  ].join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#0b1220;">
      <h2 style="margin:0 0 12px;">Report-O-Matic security code</h2>
      <p style="margin:0 0 14px; font-size:14px; line-height:1.6;">
        Your security code is:
      </p>
      <div style="display:inline-block; padding:12px 14px; border:1px solid #e5e7eb; border-radius:12px; background:#f9fafb; font-size:22px; letter-spacing:4px; font-weight:700;">
        ${opts.code}
      </div>
      <p style="margin:14px 0 0; font-size:13px; color:#334155; line-height:1.6;">
        Expires in ${opts.expiresInSeconds} seconds.
      </p>
      <p style="margin:10px 0 0; font-size:12px; color:#64748b; line-height:1.6;">
        If you didn’t request this, you can ignore this email.
      </p>
    </div>
  `.trim();

  const result = await resend.emails.send({
    from,
    to: opts.to,
    subject,
    text,
    html,
  });

  // Resend returns { data, error }. We only care about error here.
  if ("error" in result && result.error) {
    throw new Error(`Email send failed: ${result.error.message || "unknown error"}`);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const nowMs = Date.now();

  let body: SendCodeBody;
  try {
    body = (await req.json()) as SendCodeBody;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const emailRaw = typeof body.email === "string" ? body.email : "";
  const email = normalizeEmail(emailRaw);
  if (!email || !email.includes("@") || email.length > 320) return jsonError(400, "Please provide a valid email.");

  const mode = body.mode === "signup" ? "signup" : "signin";

  let ownerName: string | null = null;
  let schoolName: string | null = null;
  if (mode === "signup") {
    let alreadyMember = false;
    if (isSupabaseOtpEnabled()) {
      try {
        alreadyMember = await hasAnyMembership(email);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Could not verify account.";
        console.error("[ROM send-code] hasAnyMembership:", msg);
        return jsonError(500, msg);
      }
    }
    if (!alreadyMember) {
      const owner = typeof body.owner_name === "string" ? body.owner_name.trim() : "";
      const school = typeof body.school_name === "string" ? body.school_name.trim() : "";
      if (!owner || !school) {
        return jsonError(400, "Please provide your name and school name to create an account.");
      }
      ownerName = owner;
      schoolName = school;
    }
  }

  const ip = getClientIp(req);

  // Rate limit (dev-only in-memory).
  // Tight enough to prevent spam during testing; production will be stricter + durable.
  const rl1 = checkRateLimit({ key: `ip:${ip}`, limit: 10, windowMs: 60_000, nowMs });
  if (!rl1.ok) return jsonError(429, "Too many requests. Please wait and try again.");
  const rl2 = checkRateLimit({ key: `email:${email}`, limit: 5, windowMs: 60_000, nowMs });
  if (!rl2.ok) return jsonError(429, "Too many requests for this email. Please wait and try again.");

  const challengeId = newChallengeId();
  const code = randomDigits(6);
  // Dev usability: longer TTL locally when not using production NODE_ENV. Production remains 180 seconds.
  const ttlMs = process.env.NODE_ENV === "production" ? 180_000 : 600_000;
  const expiresAtMs = nowMs + ttlMs;
  const codeHash = sha256Hex(`${getPepper()}:${challengeId}:${code}`);

  try {
    await saveOtpChallenge({
      challengeId,
      email,
      codeHash,
      expiresAtMs,
      mode,
      ownerName,
      schoolName,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not create challenge.";
    console.error("[ROM send-code] saveOtpChallenge failed:", msg);
    return jsonError(500, msg);
  }

  const expiresInSeconds = Math.floor(ttlMs / 1000);

  // If Resend is configured, send a real email (works in dev and prod).
  // Otherwise, fall back to terminal log (dev-only).
  if (process.env.RESEND_API_KEY && process.env.ROM_FROM_EMAIL) {
    try {
      console.log("[ROM send-code] OTP email recipient:", email);
      await sendOtpEmail({ to: email, code, mode, expiresInSeconds });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not send email.";
      // In production, fail closed (don’t claim “sent” if we didn’t send).
      if (process.env.NODE_ENV === "production") return jsonError(500, msg);
      console.warn("[ROM] Email send failed in dev:", msg);
      if (!isSupabaseOtpEnabled()) {
        console.log(
          `[ROM DEV OTP] email=${email} mode=${mode} code=${code} expires_in_s=${expiresInSeconds} challenge=${challengeId}`,
        );
      }
    }
  } else {
    if (!isSupabaseOtpEnabled()) {
      console.log(`[ROM DEV OTP] email=${email} mode=${mode} code=${code} expires_in_s=${expiresInSeconds} challenge=${challengeId}`);
    }
  }

  return NextResponse.json(
    {
      ok: true,
      challenge_id: challengeId,
      expires_in_seconds: expiresInSeconds,
    },
    { headers: CORS_HEADERS },
  );
}

