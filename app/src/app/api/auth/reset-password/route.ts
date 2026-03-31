import { NextResponse } from "next/server";
import { corsHeadersForRequest } from "@/lib/http/cors";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { verifyPasswordResetChallenge } from "@/lib/auth/passwordResetChallenge";
import { hashPassword } from "@/lib/auth/passwordHash";
import { setPasswordHash } from "@/lib/auth/passwordStore";

type Body = { email?: unknown; challenge_id?: unknown; code?: unknown; new_password?: unknown };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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

function getPepper(): string {
  return process.env.ROM_OTP_PEPPER || "dev-change-me";
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
  const rl = checkRateLimit({ key: `pwreset:confirm:${ip}`, limit: 12, windowMs: 60_000, nowMs });
  if (!rl.ok) return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429, headers: cors.headers });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: cors.headers });
  }

  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const challengeId = typeof body.challenge_id === "string" ? body.challenge_id.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const newPassword = typeof body.new_password === "string" ? body.new_password : "";

  if (!email || !email.includes("@") || email.length > 320) {
    return NextResponse.json({ error: "Please provide a valid email." }, { status: 400, headers: cors.headers });
  }
  if (!challengeId || !isUuid(challengeId)) {
    return NextResponse.json({ error: "Invalid challenge id." }, { status: 400, headers: cors.headers });
  }
  if (!/^\d{6,7}$/.test(code)) {
    return NextResponse.json({ error: "Reset code must be 6 or 7 digits." }, { status: 400, headers: cors.headers });
  }
  const pw = newPassword.trim();
  if (pw.length < 8 || pw.length > 200) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400, headers: cors.headers });
  }

  const verified = await verifyPasswordResetChallenge({ challengeId, email, code, pepper: getPepper(), nowMs });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.message }, { status: verified.status, headers: cors.headers });
  }

  await setPasswordHash(email, hashPassword(pw));
  return NextResponse.json({ ok: true }, { headers: cors.headers });
}

