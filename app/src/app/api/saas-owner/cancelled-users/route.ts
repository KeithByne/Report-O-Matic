import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { listCancelledUsers } from "@/lib/data/cancelledUsers";

export async function GET() {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;
  try {
    const cancelled_users = await listCancelledUsers();
    return NextResponse.json({ cancelled_users }, { headers: { "cache-control": "no-store" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
