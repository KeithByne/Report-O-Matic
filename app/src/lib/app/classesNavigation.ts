import type { RomRole } from "@/lib/data/memberships";

/**
 * Canonical “school classes list” URL: dashboard workspace card for owners and department heads;
 * `/reports/...?panel=classes` for teachers (same TenantClassesPanel component).
 */
export function classesListHref(tenantId: string, role: RomRole): string {
  const id = encodeURIComponent(tenantId);
  if (role === "owner" || role === "department_head") {
    return `/dashboard?panel=classes&tenant=${id}`;
  }
  return `/reports/${id}?panel=classes`;
}

/** Canonical school timetable URL: dashboard workspace for leads; `/reports/...?panel=timetable` for teachers. */
export function timetableHref(tenantId: string, role: RomRole): string {
  const id = encodeURIComponent(tenantId);
  if (role === "owner" || role === "department_head") {
    return `/dashboard?panel=timetable&tenant=${id}`;
  }
  return `/reports/${id}?panel=timetable`;
}
