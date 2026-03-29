import { NextResponse } from "next/server";
import { canRemoveMember } from "@/lib/auth/memberDeletePolicy";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import {
  deleteMembershipForEmail,
  getMembershipRoleForEmail,
  getRoleForTenant,
  listMembersForTenant,
} from "@/lib/data/memberships";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** List school members (owner + department head only). */
export async function GET(_req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;

  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role || (role !== "owner" && role !== "department_head")) {
    return NextResponse.json({ error: "Only owners and department heads can view the full team list." }, { status: 403 });
  }

  try {
    const members = await listMembersForTenant(tenantId);
    const teachers = members.filter((m) => m.role === "teacher").map((m) => m.user_email);
    return NextResponse.json({ members, teachers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load members.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Remove a teacher or department head from the school (not yourself). Owners may remove DHs and teachers; DHs may remove teachers only. */
export async function DELETE(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;

  const actorRole = await getRoleForTenant(gate.email, tenantId);
  if (!actorRole) return NextResponse.json({ error: "No access." }, { status: 403 });

  let body: { user_email?: unknown };
  try {
    body = (await req.json()) as { user_email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const raw = typeof body.user_email === "string" ? body.user_email : "";
  const userEmail = normalizeEmail(raw);
  if (!userEmail || !userEmail.includes("@")) {
    return NextResponse.json({ error: "user_email is required." }, { status: 400 });
  }
  if (userEmail === normalizeEmail(gate.email)) {
    return NextResponse.json({ error: "You cannot remove your own account from the school." }, { status: 400 });
  }

  try {
    const targetRole = await getMembershipRoleForEmail(tenantId, userEmail);
    if (!targetRole) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    if (!canRemoveMember(actorRole, targetRole)) {
      return NextResponse.json({ error: "You are not allowed to remove this member." }, { status: 403 });
    }
    await deleteMembershipForEmail(tenantId, userEmail);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to remove member.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
