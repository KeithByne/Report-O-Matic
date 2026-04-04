import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { listClasses } from "@/lib/data/classesDb";
import { getRoleForTenant, listMembersForTenant } from "@/lib/data/memberships";
import {
  getTimetableSettings,
  listTimetableSlots,
  listTimetableSlotsForClassIds,
  updateTimetableSettings,
} from "@/lib/data/timetableDb";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function teacherLabel(m: { first_name: string | null; last_name: string | null }): string {
  const fn = (m.first_name ?? "").trim();
  const ln = (m.last_name ?? "").trim();
  return `${fn} ${ln}`.trim();
}

export async function GET(_req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;

  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  try {
    const settings = await getTimetableSettings(tenantId);
    if (!settings) return NextResponse.json({ error: "School not found." }, { status: 404 });

    const classRows =
      role === "owner" || role === "department_head"
        ? await listClasses(tenantId)
        : await listClasses(tenantId, { viewerRole: role, viewerEmail: gate.email });

    let slots: Awaited<ReturnType<typeof listTimetableSlots>>;
    if (role === "teacher") {
      const myClassIds = classRows.map((c) => c.id);
      const assignedByClassId = new Map(classRows.map((c) => [c.id, c.assigned_teacher_email]));
      const viewerNorm = gate.email.trim().toLowerCase();
      const raw = await listTimetableSlotsForClassIds(tenantId, myClassIds);
      slots = raw.filter((s) => {
        const assigned = assignedByClassId.get(s.class_id)?.trim().toLowerCase() ?? "";
        const fallback = s.teacher_email.trim().toLowerCase();
        return (assigned || fallback) === viewerNorm;
      });
    } else {
      slots = await listTimetableSlots(tenantId);
    }

    const members = await listMembersForTenant(tenantId);
    /** Labels for any assigned email (owner / DH / teacher), not only teacher role — matches class assignee list. */
    const membersForLabels =
      role === "teacher"
        ? members.filter((m) => m.user_email.trim().toLowerCase() === gate.email.trim().toLowerCase())
        : members;
    const teachers = membersForLabels.map((m) => ({
      email: m.user_email.trim().toLowerCase(),
      label: teacherLabel(m),
    }));

    const classes = classRows.map((c) => ({
      id: c.id,
      name: c.name,
      assigned_teacher_email: c.assigned_teacher_email,
      active_weekdays: c.active_weekdays,
    }));

    return NextResponse.json({
      settings,
      slots,
      teachers,
      classes,
      viewerRole: role,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load timetable.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;

  const role = await getRoleForTenant(gate.email, tenantId);
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the account owner can change timetable room and period settings." }, { status: 403 });
  }

  let body: { room_count?: unknown; periods_am?: unknown; periods_pm?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: { room_count?: number; periods_am?: number; periods_pm?: number } = {};
  if (body.room_count !== undefined) {
    if (typeof body.room_count !== "number" || !Number.isFinite(body.room_count)) {
      return NextResponse.json({ error: "room_count must be a number." }, { status: 400 });
    }
    patch.room_count = Math.floor(body.room_count);
  }
  if (body.periods_am !== undefined) {
    if (typeof body.periods_am !== "number" || !Number.isFinite(body.periods_am)) {
      return NextResponse.json({ error: "periods_am must be a number." }, { status: 400 });
    }
    patch.periods_am = Math.floor(body.periods_am);
  }
  if (body.periods_pm !== undefined) {
    if (typeof body.periods_pm !== "number" || !Number.isFinite(body.periods_pm)) {
      return NextResponse.json({ error: "periods_pm must be a number." }, { status: 400 });
    }
    patch.periods_pm = Math.floor(body.periods_pm);
  }

  if (patch.room_count === undefined && patch.periods_am === undefined && patch.periods_pm === undefined) {
    return NextResponse.json({ error: "No changes supplied." }, { status: 400 });
  }

  try {
    const settings = await updateTimetableSettings(tenantId, patch);
    return NextResponse.json({ settings });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
