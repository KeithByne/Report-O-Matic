import type { RomRole } from "@/lib/data/memberships";

/** Owners may switch a member between department head and teacher (not owners). */
export function canToggleDepartmentHeadTeacher(actor: RomRole, targetRole: RomRole): boolean {
  return actor === "owner" && (targetRole === "department_head" || targetRole === "teacher");
}

/** Update membership display name (first/last) shown across timetable, class picks, exports, etc. */
export function canEditMemberDisplayName(actor: RomRole, targetRole: RomRole, targetIsActor: boolean): boolean {
  if (actor === "teacher") return false;
  if (targetIsActor) return true;
  if (targetRole === "owner") return false;
  if (targetRole === "department_head") return actor === "owner";
  if (targetRole === "teacher") return actor === "owner" || actor === "department_head";
  return false;
}

/** Removing another member from a school (not the signed-in user). */
export function canRemoveMember(actor: RomRole, targetRole: RomRole): boolean {
  if (targetRole === "owner") return false;
  if (targetRole === "department_head") return actor === "owner";
  if (targetRole === "teacher") return actor === "owner" || actor === "department_head";
  return false;
}
