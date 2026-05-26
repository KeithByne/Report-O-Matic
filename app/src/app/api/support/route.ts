import { NextResponse } from "next/server";
import { getRomSessionEmail } from "@/lib/auth/getSession";
import {
  appendSupportMessage,
  countUnreadCasesForUser,
  createSupportCase,
  isSupportCategory,
  listCasesForUser,
  type SupportCategory,
} from "@/lib/data/supportMessaging";
import { getTenantName } from "@/lib/data/memberships";
import { formatDisplayNameFromProfile, getProfileForEmail } from "@/lib/data/userProfile";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET() {
  const email = await getRomSessionEmail();
  if (!email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const cases = await listCasesForUser(email);
    const unread = await countUnreadCasesForUser(email);
    return NextResponse.json({ cases, unread });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not load support cases.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const email = await getRomSessionEmail();
  if (!email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: {
    action?: unknown;
    subject?: unknown;
    category?: unknown;
    description?: unknown;
    tenant_id?: unknown;
    case_id?: unknown;
    message?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

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

  const action = typeof body.action === "string" ? body.action : "create_case";

  try {
    if (action === "message") {
      const caseId = typeof body.case_id === "string" ? body.case_id.trim() : "";
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!caseId || !isUuid(caseId)) return NextResponse.json({ error: "Valid case_id is required." }, { status: 400 });
      if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

      const { getCaseWithMessagesForUser, markCaseReadByUser } = await import("@/lib/data/supportMessaging");
      const existing = await getCaseWithMessagesForUser(email, caseId);
      if (!existing) return NextResponse.json({ error: "Case not found." }, { status: 404 });

      await appendSupportMessage({ caseId, senderRole: "user", senderEmail: email, body: message });
      await markCaseReadByUser(caseId);
      const full = await getCaseWithMessagesForUser(email, caseId);
      const unread = await countUnreadCasesForUser(email);
      const cases = await listCasesForUser(email);
      return NextResponse.json({ case: full, cases, unread });
    }

    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const categoryRaw = typeof body.category === "string" ? body.category.trim() : "other";
    const category: SupportCategory = isSupportCategory(categoryRaw) ? categoryRaw : "other";

    const created = await createSupportCase({
      userEmail: email,
      displayName: displayName || null,
      tenantId,
      tenantName,
      subject,
      category,
      description,
    });
    const unread = await countUnreadCasesForUser(email);
    const cases = await listCasesForUser(email);
    return NextResponse.json({ case: created, cases, unread });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not submit support request.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
