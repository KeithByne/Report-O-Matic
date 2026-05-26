import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import {
  appendSupportMessage,
  getThreadWithMessagesById,
  markThreadReadByOwner,
} from "@/lib/data/supportMessaging";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(_req: Request, context: { params: Promise<{ threadId: string }> }) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const { threadId } = await context.params;
  if (!isUuid(threadId)) return NextResponse.json({ error: "Invalid thread id." }, { status: 400 });

  try {
    const thread = await getThreadWithMessagesById(threadId);
    if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    await markThreadReadByOwner(threadId);
    thread.unread_for_owner = false;
    return NextResponse.json({ thread });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not load thread.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ threadId: string }> }) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const { threadId } = await context.params;
  if (!isUuid(threadId)) return NextResponse.json({ error: "Invalid thread id." }, { status: 400 });

  let body: { message?: unknown };
  try {
    body = (await req.json()) as { message?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  try {
    const existing = await getThreadWithMessagesById(threadId);
    if (!existing) return NextResponse.json({ error: "Thread not found." }, { status: 404 });

    await appendSupportMessage({
      threadId,
      senderRole: "owner",
      senderEmail: gate.email,
      body: message,
    });
    await markThreadReadByOwner(threadId);
    const thread = await getThreadWithMessagesById(threadId);
    return NextResponse.json({ thread });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not send reply.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
