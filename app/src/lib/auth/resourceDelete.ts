import type { RomRole } from "@/lib/data/memberships";

export function canDeleteSchool(actor: RomRole): boolean {
  return actor === "owner";
}

export function canDeleteClass(actor: RomRole): boolean {
  return actor === "owner" || actor === "department_head";
}

export function canDeleteStudent(actor: RomRole): boolean {
  return actor === "owner" || actor === "department_head" || actor === "teacher";
}
