import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth/session";
import { sendMemberAddedEmail } from "@/lib/email/memberInviteEmail";
import { getTenantName, inviteMemberToTenant } from "@/lib/data/memberships";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

type Body = {
  email?: unknown;
  role?: unknown;
  first_name?: unknown;
  last_name?: unknown;
};

export async function POST(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!tenantId || !isUuid(tenantId)) {
    return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  }

  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const emailRaw = typeof body.email === "string" ? body.email : "";
  const email = emailRaw.trim().toLowerCase();
  const roleRaw = body.role === "department_head" ? "department_head" : body.role === "teacher" ? "teacher" : "";
  const firstName = typeof body.first_name === "string" ? body.first_name.trim() : "";
  const lastName = typeof body.last_name === "string" ? body.last_name.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
  }
  if (roleRaw !== "department_head" && roleRaw !== "teacher") {
    return NextResponse.json({ error: "Role must be department_head or teacher." }, { status: 400 });
  }
  if (roleRaw === "teacher" && (!firstName || !lastName)) {
    return NextResponse.json({ error: "Teacher first name and surname are required." }, { status: 400 });
  }

  try {
    const result = await inviteMemberToTenant({
      tenantId,
      inviteeEmail: email,
      role: roleRaw,
      inviterEmail: session.email,
      firstName: firstName || null,
      lastName: lastName || null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invite failed.";
    console.error("[ROM invites]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const schoolName = (await getTenantName(tenantId)) || "your school";
  const roleLabel = roleRaw === "department_head" ? "a department head" : "a teacher";
  const signInUrl = new URL("/landing.html", req.url).toString();
  const inviteEmail = await sendMemberAddedEmail({
    to: email,
    schoolName,
    roleLabel,
    signInUrl,
  });

  return NextResponse.json({
    ok: true,
    invite_email_sent: inviteEmail.sent,
    ...(inviteEmail.sent ? {} : { invite_email_error: inviteEmail.error }),
  });
}
