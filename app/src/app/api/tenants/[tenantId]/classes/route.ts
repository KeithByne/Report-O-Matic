import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { isReportLanguageCode } from "@/lib/i18n/reportLanguages";
import type { CefrLevel } from "@/lib/data/classesDb";
import { insertClass, listClasses } from "@/lib/data/classesDb";
import { getRoleForTenant } from "@/lib/data/memberships";
import { isSubjectCode } from "@/lib/subjects";
import { listStudents } from "@/lib/data/students";

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
  try {
    const classes = await listClasses(tenantId, { viewerRole: role, viewerEmail: gate.email });
    let students;
    if (role === "teacher") {
      const ids = classes.map((c) => c.id);
      students = ids.length ? await listStudents(tenantId, undefined, { classIds: ids }) : [];
    } else {
      students = await listStudents(tenantId);
    }
    const countByClass = new Map<string, number>();
    for (const s of students) {
      countByClass.set(s.class_id, (countByClass.get(s.class_id) ?? 0) + 1);
    }
    const classesWithCounts = classes.map((c) => ({
      ...c,
      student_count: countByClass.get(c.id) ?? 0,
    }));
    return NextResponse.json({ classes: classesWithCounts });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load classes.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const inviterRole = await getRoleForTenant(gate.email, tenantId);
  if (!inviterRole) return NextResponse.json({ error: "No access." }, { status: 403 });
  if (inviterRole === "teacher") {
    return NextResponse.json({ error: "Only owners and department heads can create classes." }, { status: 403 });
  }

  let body: {
    name?: unknown;
    scholastic_year?: unknown;
    cefr_level?: unknown;
    default_subject?: unknown;
    default_output_language?: unknown;
    assigned_teacher_email?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });

  const scholasticYear = typeof body.scholastic_year === "string" ? body.scholastic_year.trim() : undefined;
  const cefrRaw = typeof body.cefr_level === "string" ? body.cefr_level.trim() : "";
  const cefr_level: CefrLevel | null | undefined =
    cefrRaw === ""
      ? undefined
      : ["A1", "A2", "B1", "B2", "C1", "C2"].includes(cefrRaw)
        ? (cefrRaw as CefrLevel)
        : null;
  if (cefr_level === null && cefrRaw !== "") {
    return NextResponse.json({ error: "cefr_level must be A1–C2 or empty." }, { status: 400 });
  }
  const default_subject =
    typeof body.default_subject === "string" && isSubjectCode(body.default_subject)
      ? body.default_subject
      : undefined;
  const default_output_language =
    typeof body.default_output_language === "string" && isReportLanguageCode(body.default_output_language)
      ? (body.default_output_language as ReportLanguageCode)
      : undefined;

  let assignedTeacher: string | null | undefined = undefined;
  if (body.assigned_teacher_email !== undefined) {
    if (inviterRole !== "owner" && inviterRole !== "department_head") {
      return NextResponse.json({ error: "Only owners and department heads can assign a teacher when creating a class." }, { status: 403 });
    }
    if (body.assigned_teacher_email === null) assignedTeacher = null;
    else if (typeof body.assigned_teacher_email === "string") {
      assignedTeacher = body.assigned_teacher_email.trim().toLowerCase() || null;
    }
  }

  try {
    const row = await insertClass({
      tenantId,
      name,
      scholasticYear: scholasticYear ?? null,
      cefrLevel: cefr_level === undefined ? undefined : cefr_level,
      defaultSubject: default_subject,
      defaultOutputLanguage: default_output_language,
      assignedTeacherEmail: assignedTeacher,
    });
    return NextResponse.json({ class: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create class.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
