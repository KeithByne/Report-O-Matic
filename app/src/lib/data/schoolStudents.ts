import { getServiceSupabase } from "@/lib/supabase/service";
import type { Gender } from "@/lib/data/students";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export type SchoolStudentStatus = "active" | "inactive";

export type SchoolStudentRow = {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  gender: Gender | null;
  status: SchoolStudentStatus;
  inactivated_at: string | null;
  created_at: string;
};

export type SchoolStudentWithClasses = SchoolStudentRow & {
  class_names: string[];
  class_ids: string[];
  enrollment_ids: string[];
};

function displayFromParts(first: string, last: string): string {
  return `${first} ${last}`.trim();
}

export async function listSchoolStudents(
  tenantId: string,
  status: SchoolStudentStatus,
): Promise<SchoolStudentWithClasses[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("school_students")
    .select(
      "id, tenant_id, first_name, last_name, display_name, gender, status, inactivated_at, created_at, students ( id, class_id, enrollment_ended_at, classes ( name ) )",
    )
    .eq("tenant_id", tenantId)
    .eq("status", status)
    .order("display_name", { ascending: true });
  if (error) throw new Error(formatErr(error));

  return (data ?? []).map((row: Record<string, unknown>) => {
    const enrollments = (row.students as Record<string, unknown>[] | null) ?? [];
    const open = enrollments.filter((e) => !e.enrollment_ended_at);
    const class_names: string[] = [];
    const class_ids: string[] = [];
    const enrollment_ids: string[] = [];
    for (const e of open) {
      enrollment_ids.push(e.id as string);
      if (typeof e.class_id === "string") class_ids.push(e.class_id);
      const cls = e.classes as { name: string } | { name: string }[] | null;
      const name = Array.isArray(cls) ? cls[0]?.name : cls?.name;
      if (typeof name === "string" && name) class_names.push(name);
    }
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      first_name: row.first_name as string,
      last_name: row.last_name as string,
      display_name: row.display_name as string,
      gender: (row.gender as Gender | null) ?? null,
      status: row.status as SchoolStudentStatus,
      inactivated_at: (row.inactivated_at as string | null) ?? null,
      created_at: row.created_at as string,
      class_names,
      class_ids,
      enrollment_ids,
    };
  });
}

export async function getSchoolStudentInTenant(
  tenantId: string,
  schoolStudentId: string,
): Promise<SchoolStudentRow | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("school_students")
    .select("id, tenant_id, first_name, last_name, display_name, gender, status, inactivated_at, created_at")
    .eq("tenant_id", tenantId)
    .eq("id", schoolStudentId)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  return (data as SchoolStudentRow) ?? null;
}

export async function insertSchoolStudent(opts: {
  tenantId: string;
  firstName: string;
  lastName: string;
  gender?: Gender | null;
}): Promise<SchoolStudentRow> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const first = opts.firstName.trim();
  const last = opts.lastName.trim();
  if (!first || !last) throw new Error("First name and last name are required.");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("school_students")
    .insert({
      tenant_id: opts.tenantId,
      first_name: first,
      last_name: last,
      display_name: displayFromParts(first, last),
      gender: opts.gender ?? null,
      status: "active",
      updated_at: now,
    })
    .select("id, tenant_id, first_name, last_name, display_name, gender, status, inactivated_at, created_at")
    .single();
  if (error) throw new Error(formatErr(error));
  return data as SchoolStudentRow;
}

export async function updateSchoolStudent(
  tenantId: string,
  schoolStudentId: string,
  patch: { first_name?: string; last_name?: string; gender?: Gender | null },
): Promise<SchoolStudentRow> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.first_name !== undefined) row.first_name = patch.first_name.trim();
  if (patch.last_name !== undefined) row.last_name = patch.last_name.trim();
  if (patch.gender !== undefined) row.gender = patch.gender;
  if (patch.first_name !== undefined && patch.last_name !== undefined) {
    row.display_name = displayFromParts(patch.first_name.trim(), patch.last_name.trim());
  }
  const { data, error } = await supabase
    .from("school_students")
    .update(row)
    .eq("tenant_id", tenantId)
    .eq("id", schoolStudentId)
    .select("id, tenant_id, first_name, last_name, display_name, gender, status, inactivated_at, created_at")
    .single();
  if (error) throw new Error(formatErr(error));
  return data as SchoolStudentRow;
}

export async function inactivateSchoolStudent(opts: {
  tenantId: string;
  schoolStudentId: string;
  actorEmail: string;
}): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const now = new Date().toISOString();
  const { error: sErr } = await supabase
    .from("school_students")
    .update({
      status: "inactive",
      inactivated_at: now,
      inactivated_by_email: opts.actorEmail.trim().toLowerCase(),
      updated_at: now,
    })
    .eq("tenant_id", opts.tenantId)
    .eq("id", opts.schoolStudentId)
    .eq("status", "active");
  if (sErr) throw new Error(formatErr(sErr));

  const { error: eErr } = await supabase
    .from("students")
    .update({ enrollment_ended_at: now })
    .eq("tenant_id", opts.tenantId)
    .eq("school_student_id", opts.schoolStudentId)
    .is("enrollment_ended_at", null);
  if (eErr) throw new Error(formatErr(eErr));
}

export async function reactivateSchoolStudent(tenantId: string, schoolStudentId: string): Promise<SchoolStudentRow> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("school_students")
    .update({
      status: "active",
      inactivated_at: null,
      inactivated_by_email: null,
      updated_at: now,
    })
    .eq("tenant_id", tenantId)
    .eq("id", schoolStudentId)
    .eq("status", "inactive")
    .select("id, tenant_id, first_name, last_name, display_name, gender, status, inactivated_at, created_at")
    .single();
  if (error) throw new Error(formatErr(error));
  return data as SchoolStudentRow;
}

export async function hasOpenEnrollmentInClass(
  tenantId: string,
  schoolStudentId: string,
  classId: string,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("students")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("school_student_id", schoolStudentId)
    .eq("class_id", classId)
    .is("enrollment_ended_at", null)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  return Boolean(data);
}
