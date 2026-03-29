import type { RomRole } from "@/lib/data/memberships";

/** Removing another member from a school (not the signed-in user). */
export function canRemoveMember(actor: RomRole, targetRole: RomRole): boolean {
  if (targetRole === "owner") return false;
  if (targetRole === "department_head") return actor === "owner";
  if (targetRole === "teacher") return actor === "owner" || actor === "department_head";
  return false;
}
