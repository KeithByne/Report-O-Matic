import type { TenantRole } from "@/lib/data/memberships";

/** School-wide active/inactive pupil roster (not class-scoped). */
export function canManageSchoolRoster(role: TenantRole | null): boolean {
  return role === "owner" || role === "department_head";
}
