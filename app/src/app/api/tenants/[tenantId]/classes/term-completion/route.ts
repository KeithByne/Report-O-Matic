import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getRoleForTenant } from "@/lib/data/memberships";
import { listClasses } from "@/lib/data/classesDb";
import { listReportsForTenant } from "@/lib/data/reportsDb";
import { listStudents } from "@/lib/data/students";
import { reportTermReadyForClassesDashboard, type ReportPeriod } from "@/lib/reportInputs";

export const runtime = "nodejs";

const PERIODS: ReportPeriod[] = ["first", "second", "third"];

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

  const classes = await listClasses(tenantId, { viewerRole: role, viewerEmail: gate.email });
  const classIds = classes.map((c) => c.id);
  const students = classIds.length ? await listStudents(tenantId, undefined, { classIds }) : [];
  const allowedStudentIds = new Set(students.map((s) => s.id));

  let reports = await listReportsForTenant(tenantId);
  reports = reports.filter((r) => allowedStudentIds.has(r.student_id));

  if (role === "teacher") {
    const me = gate.email.trim().toLowerCase();
    reports = reports.filter((r) => r.author_email.trim().toLowerCase() === me);
  }

  const byStudent = new Map<string, typeof reports>();
  for (const r of reports) {
    const arr = byStudent.get(r.student_id) ?? [];
    arr.push(r);
    byStudent.set(r.student_id, arr);
  }

  const byClassId: Record<string, { first: boolean; second: boolean; third: boolean }> = {};

  for (const klass of classes) {
    const sids = students.filter((s) => s.class_id === klass.id).map((s) => s.id);
    const out: { first: boolean; second: boolean; third: boolean } = {
      first: false,
      second: false,
      third: false,
    };
    if (sids.length === 0) {
      out.first = out.second = out.third = true;
    } else {
      for (const period of PERIODS) {
        let ok = true;
        for (const sid of sids) {
          const rs = byStudent.get(sid) ?? [];
          const has = rs.some((r) => reportTermReadyForClassesDashboard(r, period));
          if (!has) {
            ok = false;
            break;
          }
        }
        out[period] = ok;
      }
    }
    byClassId[klass.id] = out;
  }

  return NextResponse.json({ byClassId });
}
