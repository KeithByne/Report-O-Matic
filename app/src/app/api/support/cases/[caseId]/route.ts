import { NextResponse } from "next/server";
import { getRomSessionEmail } from "@/lib/auth/getSession";
import {
  countUnreadCasesForUser,
  getCaseWithMessagesForUser,
  markCaseReadByUser,
} from "@/lib/data/supportMessaging";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(_req: Request, context: { params: Promise<{ caseId: string }> }) {
  const email = await getRomSessionEmail();
  if (!email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { caseId } = await context.params;
  if (!isUuid(caseId)) return NextResponse.json({ error: "Invalid case id." }, { status: 400 });

  try {
    const supportCase = await getCaseWithMessagesForUser(email, caseId);
    if (!supportCase) return NextResponse.json({ error: "Case not found." }, { status: 404 });
    await markCaseReadByUser(caseId);
    supportCase.unread_for_user = false;
    const unread = await countUnreadCasesForUser(email);
    return NextResponse.json({ case: supportCase, unread });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not load case.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
