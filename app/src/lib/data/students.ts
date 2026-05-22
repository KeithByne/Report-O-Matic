import { getServiceSupabase } from "@/lib/supabase/service";
import { getSchoolStudentInTenant, insertSchoolStudent } from "@/lib/data/schoolStudents";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export type Gender = "male" | "female" | "non_binary";

export type StudentRow = {
  id: string;
  tenant_id: string;
  school_student_id: string;
  class_id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  gender: Gender | null;
  created_at: string;
};

export type StudentWithClass = StudentRow & { class_name: string };

function displayFromParts(first: string, last: string): string {
  return `${first} ${last}`.trim();
}

function mapStudentRow(row: Record<string, unknown>): StudentWithClass {
  const cls = row.classes as { name: string } | { name: string }[] | null;
  const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    school_student_id: row.school_student_id as string,
    class_id: row.class_id as string,
    display_name: row.display_name as string,
    first_name: (row.first_name as string | null) ?? null,
    last_name: (row.last_name as string | null) ?? null,
    gender: (row.gender as Gender | null) ?? null,
    created_at: row.created_at as string,
    class_name: typeof className === "string" ? className : "",
  };
}

const STUDENT_SELECT =
  "id, tenant_id, school_student_id, class_id, display_name, first_name, last_name, gender, created_at, classes ( name )";

export async function listStudents(
  tenantId: string,
  classId?: string,
  opts?: { classIds?: string[]; includeInactiveSchoolStudent?: boolean },
): Promise<StudentWithClass[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  let q = supabase
    .from("students")
    .select(STUDENT_SELECT)
    .eq("tenant_id", tenantId)
    .is("enrollment_ended_at", null)
    .order("display_name", { ascending: true });
  if (classId) q = q.eq("class_id", classId);
  else if (opts?.classIds?.length) q = q.in("class_id", opts.classIds);
  const { data, error } = await q;
  if (error) throw new Error(formatErr(error));
  let rows = (data ?? []).map((row) => mapStudentRow(row as Record<string, unknown>));
  if (!opts?.includeInactiveSchoolStudent) {
    const supabase2 = getServiceSupabase();
    if (!supabase2) return rows;
    const { data: activeRows, error: aErr } = await supabase2
      .from("school_students")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "active");
    if (aErr) throw new Error(formatErr(aErr));
    const activeIds = new Set((activeRows ?? []).map((r: { id: string }) => r.id));
    rows = rows.filter((r) => activeIds.has(r.school_student_id));
  }
  return rows;
}

export async function insertStudent(opts: {
  tenantId: string;
  classId: string;
  firstName: string;
  lastName: string;
  gender?: Gender | null;
  schoolStudentId?: string;
}): Promise<StudentWithClass> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const first = opts.firstName.trim();
  const last = opts.lastName.trim();
  if (!first || !last) throw new Error("First name and last name are required.");

  let schoolStudentId = opts.schoolStudentId?.trim() || "";
  if (schoolStudentId) {
    const existing = await getSchoolStudentInTenant(opts.tenantId, schoolStudentId);
    if (!existing || existing.status !== "active") {
      throw new Error("Active pupil not found on the school roster.");
    }
  } else {
    const created = await insertSchoolStudent({
      tenantId: opts.tenantId,
      firstName: first,
      lastName: last,
      gender: opts.gender,
    });
    schoolStudentId = created.id;
  }

  const display_name = displayFromParts(first, last);
  const { data, error } = await supabase
    .from("students")
    .insert({
      tenant_id: opts.tenantId,
      school_student_id: schoolStudentId,
      class_id: opts.classId,
      display_name,
      first_name: first,
      last_name: last,
      gender: opts.gender ?? null,
    })
    .select(STUDENT_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("This pupil is already in this class.");
    }
    throw new Error(formatErr(error));
  }
  return mapStudentRow(data as Record<string, unknown>);
}

export async function enrollSchoolStudentInClass(opts: {
  tenantId: string;
  schoolStudentId: string;
  classId: string;
}): Promise<StudentWithClass> {
  const school = await getSchoolStudentInTenant(opts.tenantId, opts.schoolStudentId);
  if (!school || school.status !== "active") {
    throw new Error("Active pupil not found on the school roster.");
  }
  return insertStudent({
    tenantId: opts.tenantId,
    classId: opts.classId,
    firstName: school.first_name,
    lastName: school.last_name,
    gender: school.gender,
    schoolStudentId: school.id,
  });
}

export async function updateStudent(
  tenantId: string,
  studentId: string,
  patch: { first_name?: string; last_name?: string; gender?: Gender | null },
): Promise<StudentWithClass> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const existing = await getStudentInTenant(tenantId, studentId);
  if (!existing) throw new Error("Student not found.");

  const row: Record<string, unknown> = {};
  const schoolPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.first_name !== undefined) {
    row.first_name = patch.first_name.trim();
    schoolPatch.first_name = row.first_name;
  }
  if (patch.last_name !== undefined) {
    row.last_name = patch.last_name.trim();
    schoolPatch.last_name = row.last_name;
  }
  if (patch.gender !== undefined) {
    row.gender = patch.gender;
    schoolPatch.gender = patch.gender;
  }
  if (patch.first_name !== undefined && patch.last_name !== undefined) {
    row.display_name = displayFromParts(patch.first_name.trim(), patch.last_name.trim());
    schoolPatch.display_name = row.display_name;
  }

  if (Object.keys(schoolPatch).length > 1) {
    const { error: sErr } = await supabase
      .from("school_students")
      .update(schoolPatch)
      .eq("tenant_id", tenantId)
      .eq("id", existing.school_student_id);
    if (sErr) throw new Error(formatErr(sErr));

    const sync: Record<string, unknown> = { ...row };
    if (row.display_name) sync.display_name = row.display_name;
    if (Object.keys(sync).length > 0) {
      const { error: allErr } = await supabase
        .from("students")
        .update(sync)
        .eq("tenant_id", tenantId)
        .eq("school_student_id", existing.school_student_id)
        .is("enrollment_ended_at", null);
      if (allErr) throw new Error(formatErr(allErr));
    }
  }

  const { data, error } = await supabase
    .from("students")
    .update(row)
    .eq("tenant_id", tenantId)
    .eq("id", studentId)
    .select(STUDENT_SELECT)
    .single();
  if (error) throw new Error(formatErr(error));
  return mapStudentRow(data as Record<string, unknown>);
}

export async function getStudentInTenant(
  tenantId: string,
  studentId: string,
): Promise<{
  id: string;
  school_student_id: string;
  class_id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  gender: Gender | null;
} | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("students")
    .select("id, school_student_id, class_id, display_name, first_name, last_name, gender")
    .eq("tenant_id", tenantId)
    .eq("id", studentId)
    .is("enrollment_ended_at", null)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  return (data as {
    id: string;
    school_student_id: string;
    class_id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    gender: Gender | null;
  }) ?? null;
}

/** Ends class enrollment; keeps school roster and reports. */
export async function endEnrollmentInTenant(tenantId: string, studentId: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("students")
    .update({ enrollment_ended_at: now })
    .eq("tenant_id", tenantId)
    .eq("id", studentId)
    .is("enrollment_ended_at", null);
  if (error) throw new Error(formatErr(error));
}

export async function deleteStudentInTenant(tenantId: string, studentId: string): Promise<void> {
  await endEnrollmentInTenant(tenantId, studentId);
}

export async function moveStudentToClass(opts: {
  tenantId: string;
  studentId: string;
  toClassId: string;
}): Promise<StudentWithClass> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { data, error } = await supabase
    .from("students")
    .update({ class_id: opts.toClassId })
    .eq("tenant_id", opts.tenantId)
    .eq("id", opts.studentId)
    .is("enrollment_ended_at", null)
    .select(STUDENT_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("This pupil already has an open enrollment in that class.");
    }
    throw new Error(formatErr(error));
  }
  return mapStudentRow(data as Record<string, unknown>);
}
