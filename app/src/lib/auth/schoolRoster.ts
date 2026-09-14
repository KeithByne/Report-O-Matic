import type { RomRole } from "@/lib/data/memberships";

/** Any school member may view/add on the school-wide pupil roster. */
export function canUseSchoolRoster(role: RomRole | null): role is RomRole {
  return role === "owner" || role === "department_head" || role === "teacher";
}

/** Archive / re-activate / remove from active list — leads only. */
export function canManageSchoolRoster(role: RomRole | null): role is RomRole {
  return role === "owner" || role === "department_head";
}
