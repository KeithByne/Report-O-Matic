import { NextResponse } from "next/server";
import { canEditMemberDisplayName, canRemoveMember, canToggleDepartmentHeadTeacher } from "@/lib/auth/memberDeletePolicy";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import type { RomRole } from "@/lib/data/memberships";
import {
  deleteMembershipForEmail,
  getMembershipRoleForEmail,
  getRoleForTenant,
  listMembersForTenant,
  setMembershipDisplayNameForTenant,
  setMembershipRoleForTenant,
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
    const teachers = members
      .filter((m) => m.role === "teacher")
      .map((m) => ({
        email: m.user_email,
        first_name: m.first_name,
        last_name: m.last_name,
      }));
    return NextResponse.json({ members, teachers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load members.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Set role (owners only) and/or display name (owners + department heads, within policy). */
export async function PATCH(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;

  const actorRole = await getRoleForTenant(gate.email, tenantId);
  if (!actorRole) return NextResponse.json({ error: "No access." }, { status: 403 });

  let body: { user_email?: unknown; role?: unknown; first_name?: unknown; last_name?: unknown };
  try {
    body = (await req.json()) as { user_email?: unknown; role?: unknown; first_name?: unknown; last_name?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const rawEmail = typeof body.user_email === "string" ? body.user_email : "";
  const userEmail = normalizeEmail(rawEmail);
  if (!userEmail || !userEmail.includes("@")) {
    return NextResponse.json({ error: "user_email is required." }, { status: 400 });
  }

  const actorEmailNorm = normalizeEmail(gate.email);
  const targetIsActor = userEmail === actorEmailNorm;

  const namePatch: { first_name?: string | null; last_name?: string | null } = {};
  if (typeof body.first_name === "string") namePatch.first_name = body.first_name.trim() || null;
  if (typeof body.last_name === "string") namePatch.last_name = body.last_name.trim() || null;
  const hasNamePatch = Object.keys(namePatch).length > 0;

  const nextRoleRaw = typeof body.role === "string" ? body.role.trim().toLowerCase() : "";
  const hasRolePatch = nextRoleRaw === "department_head" || nextRoleRaw === "teacher";

  if (!hasNamePatch && !hasRolePatch) {
    return NextResponse.json(
      { error: "Provide role (department_head or teacher) and/or first_name and/or last_name." },
      { status: 400 },
    );
  }

  try {
    const currentRole = await getMembershipRoleForEmail(tenantId, userEmail);
    if (!currentRole) return NextResponse.json({ error: "Member not found." }, { status: 404 });

    if (hasNamePatch && !canEditMemberDisplayName(actorRole, currentRole, targetIsActor)) {
      return NextResponse.json({ error: "You are not allowed to change this member’s name." }, { status: 403 });
    }

    if (hasRolePatch) {
      if (actorRole !== "owner") {
        return NextResponse.json({ error: "Only the school owner can change member roles." }, { status: 403 });
      }
      if (targetIsActor) {
        return NextResponse.json({ error: "You cannot change your own role here." }, { status: 400 });
      }
      if (!canToggleDepartmentHeadTeacher(actorRole, currentRole)) {
        return NextResponse.json({ error: "This member’s role cannot be changed here." }, { status: 403 });
      }
      if (currentRole !== nextRoleRaw) {
        await setMembershipRoleForTenant(tenantId, userEmail, nextRoleRaw as "department_head" | "teacher");
      }
    }

    if (hasNamePatch) {
      await setMembershipDisplayNameForTenant(tenantId, userEmail, namePatch);
    }

    const nextRole = hasRolePatch ? (nextRoleRaw as RomRole) : currentRole;
    return NextResponse.json({ ok: true, role: nextRole, ...(hasNamePatch ? { name_updated: true } : {}) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update member.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
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
