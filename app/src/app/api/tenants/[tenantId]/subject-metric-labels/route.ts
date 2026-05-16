import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { parseClassMetricLabelOverrides } from "@/lib/classMetricLabels";
import { getRoleForTenant } from "@/lib/data/memberships";
import { getTenantSubjectMetricLabelsMap, setSubjectSkillMetricLabels } from "@/lib/data/tenantSubjectMetricLabels";
import { resolveDefaultSubjectInputToStorage } from "@/lib/subjectFormResolve";

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
    return NextResponse.json({ error: "Only owners and department heads can load subject grade titles." }, { status: 403 });
  }
  try {
    const subject_metric_labels = await getTenantSubjectMetricLabelsMap(tenantId);
    return NextResponse.json({ subject_metric_labels });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load subject grade titles.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });
  if (role !== "owner" && role !== "department_head") {
    return NextResponse.json({ error: "Only owners and department heads can save subject grade titles." }, { status: 403 });
  }

  let body: { subject?: unknown; metric_labels?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const subjectRaw = typeof body.subject === "string" ? body.subject.trim() : "";
  if (!subjectRaw) return NextResponse.json({ error: "subject is required." }, { status: 400 });

  let storedSubject: string;
  try {
    storedSubject = resolveDefaultSubjectInputToStorage(subjectRaw);
  } catch {
    return NextResponse.json({ error: "Invalid subject." }, { status: 400 });
  }

  const metric_labels = parseClassMetricLabelOverrides(body.metric_labels);

  try {
    const subject_metric_labels = await setSubjectSkillMetricLabels(tenantId, storedSubject, metric_labels);
    return NextResponse.json({ ok: true, subject_metric_labels });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save subject grade titles.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
