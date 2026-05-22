import type { RomRole } from "@/lib/data/memberships";

/** School-wide active/inactive pupil roster (not class-scoped). */
export function canManageSchoolRoster(role: RomRole | null): role is RomRole {
  return role === "owner" || role === "department_head";
}
