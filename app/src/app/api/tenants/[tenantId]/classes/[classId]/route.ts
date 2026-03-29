import { NextResponse } from "next/server";
import { canAccessClass } from "@/lib/auth/classAccess";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import type { CefrLevel } from "@/lib/data/classesDb";
import { canDeleteClass } from "@/lib/auth/resourceDelete";
import { archiveScholasticYearAndResetReports } from "@/lib/data/classArchives";
import { deleteClassInTenant, getClassInTenant, updateClass } from "@/lib/data/classesDb";
import { getRoleForTenant } from "@/lib/data/memberships";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { isReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { isSubjectCode } from "@/lib/subjects";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function normalizeScholasticYear(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function GET(_req: Request, context: { params: Promise<{ tenantId: string; classId: string }> }) {
  const { tenantId, classId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(classId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });
  try {
    const klass = await getClassInTenant(tenantId, classId);
    if (!klass) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    if (!canAccessClass({ role, viewerEmail: gate.email, klass })) {
      return NextResponse.json({ error: "You do not have access to this class." }, { status: 403 });
    }
    return NextResponse.json({ class: klass });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load class.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ tenantId: string; classId: string }> }) {
  const { tenantId, classId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(classId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const isLead = role === "owner" || role === "department_head";

  const patch: Parameters<typeof updateClass>[2] = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (isLead && (body.scholastic_year === null || typeof body.scholastic_year === "string")) {
    patch.scholastic_year = body.scholastic_year === null ? null : (body.scholastic_year as string).trim() || null;
  }
  if (body.cefr_level === null || typeof body.cefr_level === "string") {
    if (body.cefr_level === null || (typeof body.cefr_level === "string" && body.cefr_level.trim() === "")) {
      patch.cefr_level = null;
    } else if (typeof body.cefr_level === "string" && ["A1", "A2", "B1", "B2", "C1", "C2"].includes(body.cefr_level)) {
      patch.cefr_level = body.cefr_level as CefrLevel;
    } else {
      return NextResponse.json({ error: "Invalid cefr_level." }, { status: 400 });
    }
  }
  if (typeof body.default_subject === "string" && isSubjectCode(body.default_subject)) {
    patch.default_subject = body.default_subject;
  }
  if (typeof body.default_output_language === "string" && isReportLanguageCode(body.default_output_language)) {
    patch.default_output_language = body.default_output_language as ReportLanguageCode;
  }
  if (body.assigned_teacher_email !== undefined) {
    if (role !== "owner" && role !== "department_head") {
      return NextResponse.json({ error: "Only owners and department heads can assign teachers to a class." }, { status: 403 });
    }
    if (body.assigned_teacher_email === null) patch.assigned_teacher_email = null;
    else if (typeof body.assigned_teacher_email === "string") {
      patch.assigned_teacher_email = body.assigned_teacher_email.trim().toLowerCase() || null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    const existing = await getClassInTenant(tenantId, classId);
    if (!existing) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    if (!canAccessClass({ role, viewerEmail: gate.email, klass: existing })) {
      return NextResponse.json({ error: "You do not have access to this class." }, { status: 403 });
    }

    if (
      isLead &&
      patch.scholastic_year !== undefined &&
      normalizeScholasticYear(patch.scholastic_year) !== normalizeScholasticYear(existing.scholastic_year)
    ) {
      const endingLabel = existing.scholastic_year?.trim() || "Year not specified";
      await archiveScholasticYearAndResetReports({
        tenantId,
        classId,
        className: existing.name,
        endingScholasticYearLabel: endingLabel,
      });
    }

    const klass = await updateClass(tenantId, classId, patch);
    return NextResponse.json({ class: klass });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update class.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ tenantId: string; classId: string }> }) {
  const { tenantId, classId } = await context.params;
  if (!isUuid(tenantId) || !isUuid(classId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });
  if (!canDeleteClass(role)) {
    return NextResponse.json({ error: "Only owners and department heads can delete classes." }, { status: 403 });
  }

  try {
    const existing = await getClassInTenant(tenantId, classId);
    if (!existing) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    if (!canAccessClass({ role, viewerEmail: gate.email, klass: existing })) {
      return NextResponse.json({ error: "You do not have access to this class." }, { status: 403 });
    }
    await deleteClassInTenant(tenantId, classId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete class.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
