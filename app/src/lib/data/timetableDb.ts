import { getServiceSupabase } from "@/lib/supabase/service";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export type TimetableSettings = {
  room_count: number;
  periods_am: number;
  periods_pm: number;
};

export type TimetableSlotRow = {
  id: string;
  tenant_id: string;
  day_of_week: number;
  period_index: number;
  room_index: number;
  class_id: string;
  teacher_email: string;
  created_at: string;
  class_name: string | null;
};

const tenantTimetableSelect = "timetable_room_count, timetable_periods_am, timetable_periods_pm";

export async function getTimetableSettings(tenantId: string): Promise<TimetableSettings | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("tenants")
    .select(tenantTimetableSelect)
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  if (!data) return null;
  const row = data as {
    timetable_room_count: number;
    timetable_periods_am: number;
    timetable_periods_pm: number;
  };
  return {
    room_count: Number(row.timetable_room_count),
    periods_am: Number(row.timetable_periods_am),
    periods_pm: Number(row.timetable_periods_pm),
  };
}

export async function updateTimetableSettings(
  tenantId: string,
  patch: { room_count?: number; periods_am?: number; periods_pm?: number },
): Promise<TimetableSettings> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const current = await getTimetableSettings(tenantId);
  if (!current) throw new Error("School not found.");

  const room_count = patch.room_count ?? current.room_count;
  const periods_am = patch.periods_am ?? current.periods_am;
  const periods_pm = patch.periods_pm ?? current.periods_pm;

  if (room_count < 1 || room_count > 50) throw new Error("Rooms must be between 1 and 50.");
  if (periods_am < 1 || periods_am > 6) throw new Error("Morning periods must be between 1 and 6.");
  if (periods_pm < 1 || periods_pm > 6) throw new Error("Afternoon periods must be between 1 and 6.");

  const periodTotal = periods_am + periods_pm;

  const { error: upErr } = await supabase
    .from("tenants")
    .update({
      timetable_room_count: room_count,
      timetable_periods_am: periods_am,
      timetable_periods_pm: periods_pm,
    })
    .eq("id", tenantId);
  if (upErr) throw new Error(formatErr(upErr));

  const { error: d1 } = await supabase
    .from("timetable_slots")
    .delete()
    .eq("tenant_id", tenantId)
    .gte("room_index", room_count);
  if (d1) throw new Error(formatErr(d1));
  const { error: d2 } = await supabase
    .from("timetable_slots")
    .delete()
    .eq("tenant_id", tenantId)
    .gte("period_index", periodTotal);
  if (d2) throw new Error(formatErr(d2));

  return { room_count, periods_am, periods_pm };
}

function mapSlot(raw: Record<string, unknown>): TimetableSlotRow {
  const classes = raw.classes as { name?: string } | { name?: string }[] | null | undefined;
  const name =
    Array.isArray(classes) ? classes[0]?.name : typeof classes === "object" && classes && "name" in classes ? classes.name : null;
  return {
    id: raw.id as string,
    tenant_id: raw.tenant_id as string,
    day_of_week: Number(raw.day_of_week),
    period_index: Number(raw.period_index),
    room_index: Number(raw.room_index),
    class_id: raw.class_id as string,
    teacher_email: String(raw.teacher_email ?? "").trim().toLowerCase(),
    created_at: raw.created_at as string,
    class_name: typeof name === "string" ? name : null,
  };
}

/** When a class’s assigned teacher changes or is cleared, keep slots consistent (and delete slots if unassigned). */
export async function syncTimetableSlotsTeacherForClass(
  tenantId: string,
  classId: string,
  newTeacherEmail: string | null,
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  if (newTeacherEmail == null || !String(newTeacherEmail).trim()) {
    const { error } = await supabase.from("timetable_slots").delete().eq("tenant_id", tenantId).eq("class_id", classId);
    if (error) throw new Error(formatErr(error));
    return;
  }

  const normalized = String(newTeacherEmail).trim().toLowerCase();
  const { error: upErr } = await supabase
    .from("timetable_slots")
    .update({ teacher_email: normalized })
    .eq("tenant_id", tenantId)
    .eq("class_id", classId);
  if (upErr) throw new Error(formatErr(upErr));
}

export async function getTimetableSlot(slotId: string, tenantId: string): Promise<TimetableSlotRow | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("timetable_slots")
    .select("id, tenant_id, day_of_week, period_index, room_index, class_id, teacher_email, created_at, classes ( name )")
    .eq("id", slotId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  if (!data) return null;
  return mapSlot(data as Record<string, unknown>);
}

export async function getTimetableSlotClassId(slotId: string, tenantId: string): Promise<string | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("timetable_slots")
    .select("class_id")
    .eq("id", slotId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  if (!data) return null;
  return (data as { class_id: string }).class_id;
}

export async function listTimetableSlots(tenantId: string, opts?: { teacherEmail?: string }): Promise<TimetableSlotRow[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  let q = supabase
    .from("timetable_slots")
    .select("id, tenant_id, day_of_week, period_index, room_index, class_id, teacher_email, created_at, classes ( name )")
    .eq("tenant_id", tenantId)
    .order("day_of_week", { ascending: true })
    .order("period_index", { ascending: true })
    .order("room_index", { ascending: true });
  const te = opts?.teacherEmail?.trim().toLowerCase();
  if (te) q = q.eq("teacher_email", te);
  const { data, error } = await q;
  if (error) throw new Error(formatErr(error));
  return (data ?? []).map((row) => mapSlot(row as Record<string, unknown>));
}

/** Slots for the given classes only (e.g. teacher’s assigned classes). */
export async function listTimetableSlotsForClassIds(tenantId: string, classIds: string[]): Promise<TimetableSlotRow[]> {
  if (classIds.length === 0) return [];
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("timetable_slots")
    .select("id, tenant_id, day_of_week, period_index, room_index, class_id, teacher_email, created_at, classes ( name )")
    .eq("tenant_id", tenantId)
    .in("class_id", classIds)
    .order("day_of_week", { ascending: true })
    .order("period_index", { ascending: true })
    .order("room_index", { ascending: true });
  if (error) throw new Error(formatErr(error));
  return (data ?? []).map((row) => mapSlot(row as Record<string, unknown>));
}

export async function insertTimetableSlot(opts: {
  tenantId: string;
  day_of_week: number;
  period_index: number;
  room_index: number;
  class_id: string;
  teacher_email: string;
}): Promise<TimetableSlotRow> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const teacher_email = opts.teacher_email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("timetable_slots")
    .insert({
      tenant_id: opts.tenantId,
      day_of_week: opts.day_of_week,
      period_index: opts.period_index,
      room_index: opts.room_index,
      class_id: opts.class_id,
      teacher_email,
    })
    .select("id, tenant_id, day_of_week, period_index, room_index, class_id, teacher_email, created_at, classes ( name )")
    .single();
  if (error) throw new Error(formatErr(error));
  return mapSlot(data as Record<string, unknown>);
}

export async function updateTimetableSlot(
  slotId: string,
  tenantId: string,
  patch: {
    day_of_week?: number;
    period_index?: number;
    room_index?: number;
    class_id?: string;
    teacher_email?: string;
  },
): Promise<TimetableSlotRow> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const body: Record<string, unknown> = {};
  if (patch.day_of_week !== undefined) body.day_of_week = patch.day_of_week;
  if (patch.period_index !== undefined) body.period_index = patch.period_index;
  if (patch.room_index !== undefined) body.room_index = patch.room_index;
  if (patch.class_id !== undefined) body.class_id = patch.class_id;
  if (patch.teacher_email !== undefined) body.teacher_email = patch.teacher_email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("timetable_slots")
    .update(body)
    .eq("id", slotId)
    .eq("tenant_id", tenantId)
    .select("id, tenant_id, day_of_week, period_index, room_index, class_id, teacher_email, created_at, classes ( name )")
    .single();
  if (error) throw new Error(formatErr(error));
  return mapSlot(data as Record<string, unknown>);
}

export async function deleteTimetableSlot(slotId: string, tenantId: string): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { error, count } = await supabase.from("timetable_slots").delete({ count: "exact" }).eq("id", slotId).eq("tenant_id", tenantId);
  if (error) throw new Error(formatErr(error));
  return (count ?? 0) > 0;
}

export async function listTimetableSlotsAt(
  tenantId: string,
  classId: string,
  periodIndex: number,
  roomIndex: number,
  dayIndices: number[],
): Promise<TimetableSlotRow[]> {
  if (dayIndices.length === 0) return [];
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("timetable_slots")
    .select("id, tenant_id, day_of_week, period_index, room_index, class_id, teacher_email, created_at, classes ( name )")
    .eq("tenant_id", tenantId)
    .eq("class_id", classId)
    .eq("period_index", periodIndex)
    .eq("room_index", roomIndex)
    .in("day_of_week", dayIndices);
  if (error) throw new Error(formatErr(error));
  return (data ?? []).map((row) => mapSlot(row as Record<string, unknown>));
}

/** Remove slots matching class + period + room on the given days (mirror delete). */
export async function deleteTimetableSlotsMirrorKeys(
  tenantId: string,
  classId: string,
  periodIndex: number,
  roomIndex: number,
  dayIndices: number[],
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  if (dayIndices.length === 0) return;
  const { error } = await supabase
    .from("timetable_slots")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("class_id", classId)
    .eq("period_index", periodIndex)
    .eq("room_index", roomIndex)
    .in("day_of_week", dayIndices);
  if (error) throw new Error(formatErr(error));
}

export function isTimetableConflictError(message: string): "room" | "teacher" | null {
  const m = message.toLowerCase();
  if (m.includes("timetable_slots_room_occupancy") || m.includes("room_occupancy")) return "room";
  if (m.includes("timetable_slots_teacher_period_unique") || m.includes("teacher_period_unique")) return "teacher";
  return null;
}
