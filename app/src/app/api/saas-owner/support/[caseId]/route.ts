import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import {
  appendSupportMessage,
  getCaseWithMessagesById,
  markCaseReadByOwner,
  resolveSupportCase,
} from "@/lib/data/supportMessaging";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(_req: Request, context: { params: Promise<{ caseId: string }> }) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const { caseId } = await context.params;
  if (!isUuid(caseId)) return NextResponse.json({ error: "Invalid case id." }, { status: 400 });

  try {
    const supportCase = await getCaseWithMessagesById(caseId);
    if (!supportCase) return NextResponse.json({ error: "Case not found." }, { status: 404 });
    await markCaseReadByOwner(caseId);
    supportCase.unread_for_owner = false;
    return NextResponse.json({ case: supportCase });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not load case.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ caseId: string }> }) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const { caseId } = await context.params;
  if (!isUuid(caseId)) return NextResponse.json({ error: "Invalid case id." }, { status: 400 });

  let body: { message?: unknown };
  try {
    body = (await req.json()) as { message?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  try {
    const existing = await getCaseWithMessagesById(caseId);
    if (!existing) return NextResponse.json({ error: "Case not found." }, { status: 404 });
    if (existing.status === "resolved") {
      return NextResponse.json({ error: "Case is already resolved." }, { status: 400 });
    }

    await appendSupportMessage({
      caseId,
      senderRole: "owner",
      senderEmail: gate.email,
      body: message,
    });
    await markCaseReadByOwner(caseId);
    const supportCase = await getCaseWithMessagesById(caseId);
    return NextResponse.json({ case: supportCase });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not send reply.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ caseId: string }> }) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const { caseId } = await context.params;
  if (!isUuid(caseId)) return NextResponse.json({ error: "Invalid case id." }, { status: 400 });

  let body: { action?: unknown; note?: unknown };
  try {
    body = (await req.json()) as { action?: unknown; note?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (body.action !== "resolve") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.trim() : null;

  try {
    const supportCase = await resolveSupportCase({
      caseId,
      ownerEmail: gate.email,
      note,
    });
    return NextResponse.json({ case: supportCase });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not resolve case.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
