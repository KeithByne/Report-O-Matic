import { NextResponse } from "next/server";
import { getRomSessionEmail } from "@/lib/auth/getSession";

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export function isSaasOwnerEmail(email: string): boolean {
  const allow = process.env.ROM_SAAS_OWNER_EMAILS ?? "";
  const list = allow
    .split(",")
    .map((x) => normalizeEmail(x))
    .filter(Boolean);
  if (list.length === 0) return false;
  return list.includes(normalizeEmail(email));
}

export async function requireSaasOwner(): Promise<{ ok: true; email: string } | { ok: false; res: NextResponse }> {
  const email = await getRomSessionEmail();
  if (!email) return { ok: false, res: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (!isSaasOwnerEmail(email)) {
    return { ok: false, res: NextResponse.json({ error: "Not authorised." }, { status: 403 }) };
  }
  return { ok: true, email };
}

