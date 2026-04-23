import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { isReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { isValidClassLevelForRubric } from "@/lib/classLevel";
import { insertClass, listClasses } from "@/lib/data/classesDb";
import { getRoleForTenant } from "@/lib/data/memberships";
import { mergeTenantCustomSubjectEntries } from "@/lib/data/tenantCustomSubjects";
import { parseGradeRubricProfile } from "@/lib/gradeRubricProfile";
import { resolveDefaultSubjectInputToStorage } from "@/lib/subjectFormResolve";
import { isSubjectCode } from "@/lib/subjects";
import { listStudents } from "@/lib/data/students";
import { getServiceSupabase } from "@/lib/supabase/service";

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
    default_subject_rubric_profile?: unknown;
    grade_rubric_profile?: unknown;
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
  if (name.length > 30) return NextResponse.json({ error: "Class name must be 30 characters or fewer." }, { status: 400 });

  /** Tenant school type is canonical; do not trust the client `grade_rubric_profile` (can be stale). */
  let tenantDefaultRubric = parseGradeRubricProfile(undefined, "language");
  try {
    const supabase = getServiceSupabase();
    if (supabase) {
      const { data: tenantRow, error: tenantErr } = await supabase
        .from("tenants")
        .select("default_grade_rubric_profile")
        .eq("id", tenantId)
        .maybeSingle();
      if (tenantErr) throw tenantErr;
      const rec = tenantRow as Record<string, unknown> | null;
      tenantDefaultRubric = parseGradeRubricProfile(rec?.default_grade_rubric_profile, "language");
    }
  } catch {
    tenantDefaultRubric = parseGradeRubricProfile(undefined, "language");
  }

  const scholasticYear = typeof body.scholastic_year === "string" ? body.scholastic_year.trim() : undefined;
  if (typeof scholasticYear === "string" && scholasticYear.length > 15) {
    return NextResponse.json({ error: "Scholastic year must be 15 characters or fewer." }, { status: 400 });
  }
  const cefrRaw = typeof body.cefr_level === "string" ? body.cefr_level.trim() : "";
  const cefrStored: string | null | undefined =
    typeof body.cefr_level !== "string" ? undefined : cefrRaw === "" ? null : cefrRaw;
  let default_subject: string | undefined;
  if (typeof body.default_subject === "string" && body.default_subject.trim()) {
    try {
      default_subject = resolveDefaultSubjectInputToStorage(body.default_subject);
    } catch {
      return NextResponse.json({ error: "Invalid default_subject." }, { status: 400 });
    }
    if (!isSubjectCode(default_subject.toLowerCase()) && default_subject.length > 40) {
      return NextResponse.json({ error: "Default subject must be 40 characters or fewer." }, { status: 400 });
    }
  }
  const normForRubric = default_subject ?? "efl";
  const explicitRubric =
    default_subject && !isSubjectCode(normForRubric.toLowerCase())
      ? parseGradeRubricProfile(body.default_subject_rubric_profile, tenantDefaultRubric)
      : undefined;
  if (cefrStored !== undefined && cefrStored !== null && !isValidClassLevelForRubric(cefrStored, tenantDefaultRubric)) {
    return NextResponse.json(
      { error: "Class level is not valid for this subject type (CEFR vs year group)." },
      { status: 400 },
    );
  }
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
      cefrLevel: cefrStored === undefined ? undefined : cefrStored,
      defaultSubject: default_subject,
      gradeRubricProfile: tenantDefaultRubric,
      defaultOutputLanguage: default_output_language,
      assignedTeacherEmail: assignedTeacher,
    });
    if (default_subject) {
      try {
        const mergeRubric =
          explicitRubric ?? parseGradeRubricProfile(body.default_subject_rubric_profile, tenantDefaultRubric);
        await mergeTenantCustomSubjectEntries(tenantId, [{ name: default_subject, rubric_profile: mergeRubric }]);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Could not update subject list.";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }
    return NextResponse.json({ class: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create class.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
