import { getServiceSupabase } from "@/lib/supabase/service";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export type StudentEventType = "added" | "deleted" | "moved";

export async function logStudentEvent(opts: {
  tenantId: string;
  actorEmail: string;
  type: StudentEventType;
  studentId: string | null;
  fromClassId: string | null;
  toClassId: string | null;
}): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("student_events").insert({
    tenant_id: opts.tenantId,
    actor_email: opts.actorEmail.trim().toLowerCase(),
    event_type: opts.type,
    student_id: opts.studentId,
    from_class_id: opts.fromClassId,
    to_class_id: opts.toClassId,
  });
  if (error) throw new Error(formatErr(error));
}

export type TeacherStudentEventCounts = { added: number; deleted: number; moved: number };

export async function listStudentEventCountsByActor(opts: {
  tenantId: string;
  actorEmails: string[];
  sinceIso?: string;
}): Promise<Record<string, TeacherStudentEventCounts>> {
  const supabase = getServiceSupabase();
  const out: Record<string, TeacherStudentEventCounts> = {};
  for (const e of opts.actorEmails) out[e] = { added: 0, deleted: 0, moved: 0 };
  if (!supabase || opts.actorEmails.length === 0) return out;

  let q = supabase
    .from("student_events")
    .select("actor_email, event_type, created_at")
    .eq("tenant_id", opts.tenantId)
    .in(
      "actor_email",
      opts.actorEmails.map((x) => x.trim().toLowerCase()),
    );
  if (opts.sinceIso) q = q.gte("created_at", opts.sinceIso);
  const { data, error } = await q;
  if (error) throw new Error(formatErr(error));

  for (const row of (data ?? []) as { actor_email: string; event_type: string }[]) {
    const email = String(row.actor_email || "").trim().toLowerCase();
    const t = row.event_type as StudentEventType;
    if (!out[email]) out[email] = { added: 0, deleted: 0, moved: 0 };
    if (t === "added") out[email].added += 1;
    else if (t === "deleted") out[email].deleted += 1;
    else if (t === "moved") out[email].moved += 1;
  }
  return out;
}

