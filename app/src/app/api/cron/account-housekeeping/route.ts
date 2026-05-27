import { NextResponse } from "next/server";
import { runOwnerAccountHousekeeping } from "@/lib/data/ownerLifecycle";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runOwnerAccountHousekeeping();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Housekeeping failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
