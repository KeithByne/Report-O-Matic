import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getRoleForTenant } from "@/lib/data/memberships";
import { listTenantCustomSubjectNames } from "@/lib/data/tenantCustomSubjects";
import { REPORT_SUBJECTS } from "@/lib/subjects";

export const runtime = "nodejs";

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
    return NextResponse.json({
      built_in: REPORT_SUBJECTS.map((s) => s.code),
      custom,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load subject options.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
