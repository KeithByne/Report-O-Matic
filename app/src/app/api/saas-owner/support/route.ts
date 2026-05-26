import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { countOwnerUnreadThreads, listThreadsForOwner } from "@/lib/data/supportMessaging";

export async function GET() {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  try {
    const threads = await listThreadsForOwner();
    const unreadThreads = await countOwnerUnreadThreads();
    return NextResponse.json({ threads, unreadThreads });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not load support inbox.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
