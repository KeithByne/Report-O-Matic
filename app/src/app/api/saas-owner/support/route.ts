import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { countOwnerUnreadCases, listCasesForOwner } from "@/lib/data/supportMessaging";

export async function GET() {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  try {
    const cases = await listCasesForOwner();
    const unreadCases = await countOwnerUnreadCases();
    return NextResponse.json({ cases, unreadCases });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not load support inbox.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
