import { NextResponse } from "next/server";
import { getRomSessionEmail } from "@/lib/auth/getSession";
import {
  appendSupportMessage,
  countUnreadForUser,
  ensureThreadForUser,
  getThreadWithMessagesForUser,
  markThreadReadByUser,
} from "@/lib/data/supportMessaging";
import { getTenantName } from "@/lib/data/memberships";
import { formatDisplayNameFromProfile, getProfileForEmail } from "@/lib/data/userProfile";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(req: Request) {
  const email = await getRomSessionEmail();
  if (!email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const url = new URL(req.url);
  const markRead = url.searchParams.get("markRead") === "1";

  try {
    const thread = await getThreadWithMessagesForUser(email);
    if (thread && markRead) {
      await markThreadReadByUser(thread.id);
      thread.unread_for_user = false;
    }
    const unread = await countUnreadForUser(email);
    return NextResponse.json({ thread, unread });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not load support messages.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const email = await getRomSessionEmail();
  if (!email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { message?: unknown; tenant_id?: unknown };
  try {
    body = (await req.json()) as { message?: unknown; tenant_id?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  if (message.length > 4000) return NextResponse.json({ error: "Message is too long." }, { status: 400 });

  const tenantId = typeof body.tenant_id === "string" && isUuid(body.tenant_id) ? body.tenant_id : null;
  let tenantName: string | null = null;
  if (tenantId) {
    try {
      tenantName = (await getTenantName(tenantId)) || null;
    } catch {
      tenantName = null;
    }
  }

  let displayName = "";
  try {
    displayName = formatDisplayNameFromProfile(await getProfileForEmail(email));
  } catch {
    displayName = "";
  }

  try {
    const thread = await ensureThreadForUser({
      userEmail: email,
      displayName: displayName || null,
      tenantId,
      tenantName,
    });
    await appendSupportMessage({
      threadId: thread.id,
      senderRole: "user",
      senderEmail: email,
      body: message,
    });
    await markThreadReadByUser(thread.id);
    const full = await getThreadWithMessagesForUser(email);
    const unread = await countUnreadForUser(email);
    return NextResponse.json({ thread: full, unread });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not send message.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
