import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import {
  builtInSubjectCodes,
  listTenantCustomSubjectNames,
  removeTenantCustomSubjectName,
  renameTenantCustomSubjectName,
} from "@/lib/data/tenantCustomSubjects";
import { getRoleForTenant } from "@/lib/data/memberships";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(_req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });
  if (role !== "owner" && role !== "department_head") {
    return NextResponse.json({ error: "Only owners and department heads can load subject options." }, { status: 403 });
  }
  try {
    const custom = await listTenantCustomSubjectNames(tenantId);
    return NextResponse.json({ built_in: builtInSubjectCodes(), custom });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load subject options.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function requireLead(role: string | null): role is "owner" | "department_head" {
  return role === "owner" || role === "department_head";
}

export async function PATCH(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });
  if (!requireLead(role)) {
    return NextResponse.json({ error: "Only owners and department heads can rename subjects." }, { status: 403 });
  }

  let body: { old_name?: unknown; new_name?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const old_name = typeof body.old_name === "string" ? body.old_name.trim() : "";
  const new_name = typeof body.new_name === "string" ? body.new_name.trim() : "";
  if (!old_name || !new_name) {
    return NextResponse.json({ error: "old_name and new_name are required." }, { status: 400 });
  }

  try {
    await renameTenantCustomSubjectName(tenantId, old_name, new_name);
    const custom = await listTenantCustomSubjectNames(tenantId);
    return NextResponse.json({ ok: true, built_in: builtInSubjectCodes(), custom });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to rename subject.";
    const status = /not in school list|Invalid source/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });
  if (!requireLead(role)) {
    return NextResponse.json({ error: "Only owners and department heads can delete subjects." }, { status: 403 });
  }

  const name = new URL(req.url).searchParams.get("name")?.trim() ?? "";
  if (!name) return NextResponse.json({ error: "Query parameter name is required." }, { status: 400 });

  try {
    await removeTenantCustomSubjectName(tenantId, name);
    const custom = await listTenantCustomSubjectNames(tenantId);
    return NextResponse.json({ ok: true, built_in: builtInSubjectCodes(), custom });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete subject.";
    const status = /not in school list|Invalid subject/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
