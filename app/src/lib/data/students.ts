import { getServiceSupabase } from "@/lib/supabase/service";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export type Gender = "male" | "female" | "non_binary";

export type StudentRow = {
  id: string;
  tenant_id: string;
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

export async function listStudents(
  tenantId: string,
  classId?: string,
  opts?: { classIds?: string[] },
): Promise<StudentWithClass[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  let q = supabase
    .from("students")
    .select(
      "id, tenant_id, class_id, display_name, first_name, last_name, gender, created_at, classes ( name )",
    )
    .eq("tenant_id", tenantId)
    .order("display_name", { ascending: true });
  if (classId) q = q.eq("class_id", classId);
  else if (opts?.classIds?.length) q = q.in("class_id", opts.classIds);
  const { data, error } = await q;
  if (error) throw new Error(formatErr(error));
  const rows = data ?? [];
  return rows.map((row: Record<string, unknown>) => {
    const cls = row.classes as { name: string } | { name: string }[] | null;
    const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      class_id: row.class_id as string,
      display_name: row.display_name as string,
      first_name: (row.first_name as string | null) ?? null,
      last_name: (row.last_name as string | null) ?? null,
      gender: (row.gender as Gender | null) ?? null,
      created_at: row.created_at as string,
      class_name: typeof className === "string" ? className : "",
    };
  });
}

export async function insertStudent(opts: {
  tenantId: string;
  classId: string;
  firstName: string;
  lastName: string;
  gender?: Gender | null;
}): Promise<StudentWithClass> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const first = opts.firstName.trim();
  const last = opts.lastName.trim();
  if (!first || !last) throw new Error("First name and last name are required.");
  const display_name = displayFromParts(first, last);
  const { data, error } = await supabase
    .from("students")
    .insert({
      tenant_id: opts.tenantId,
      class_id: opts.classId,
      display_name,
      first_name: first,
      last_name: last,
      gender: opts.gender ?? null,
    })
    .select("id, tenant_id, class_id, display_name, first_name, last_name, gender, created_at, classes ( name )")
    .single();
  if (error) throw new Error(formatErr(error));
  const row = data as Record<string, unknown>;
  const cls = row.classes as { name: string } | null;
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    class_id: row.class_id as string,
    display_name: row.display_name as string,
    first_name: row.first_name as string | null,
    last_name: row.last_name as string | null,
    gender: row.gender as Gender | null,
    created_at: row.created_at as string,
    class_name: cls?.name ?? "",
  };
}

export async function updateStudent(
  tenantId: string,
  studentId: string,
  patch: { first_name?: string; last_name?: string; gender?: Gender | null },
): Promise<StudentWithClass> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const row: Record<string, unknown> = {};
  if (patch.first_name !== undefined) row.first_name = patch.first_name.trim();
  if (patch.last_name !== undefined) row.last_name = patch.last_name.trim();
  if (patch.gender !== undefined) row.gender = patch.gender;
  if (patch.first_name !== undefined && patch.last_name !== undefined) {
    row.display_name = displayFromParts(patch.first_name.trim(), patch.last_name.trim());
  }
  const { data, error } = await supabase
    .from("students")
    .update(row)
    .eq("tenant_id", tenantId)
    .eq("id", studentId)
    .select("id, tenant_id, class_id, display_name, first_name, last_name, gender, created_at, classes ( name )")
    .single();
  if (error) throw new Error(formatErr(error));
  const r = data as Record<string, unknown>;
  const cls = r.classes as { name: string } | null;
  return {
    id: r.id as string,
    tenant_id: r.tenant_id as string,
    class_id: r.class_id as string,
    display_name: r.display_name as string,
    first_name: r.first_name as string | null,
    last_name: r.last_name as string | null,
    gender: r.gender as Gender | null,
    created_at: r.created_at as string,
    class_name: cls?.name ?? "",
  };
}

export async function getStudentInTenant(
  tenantId: string,
  studentId: string,
): Promise<{
  id: string;
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
    .select("id, class_id, display_name, first_name, last_name, gender")
    .eq("tenant_id", tenantId)
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  return (data as {
    id: string;
    class_id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    gender: Gender | null;
  }) ?? null;
}

export async function deleteStudentInTenant(tenantId: string, studentId: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { error } = await supabase.from("students").delete().eq("tenant_id", tenantId).eq("id", studentId);
  if (error) throw new Error(formatErr(error));
}
