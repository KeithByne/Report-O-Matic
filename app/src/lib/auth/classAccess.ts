import type { ClassRow } from "@/lib/data/classesDb";
import type { RomRole } from "@/lib/data/memberships";

/** Teachers only access classes explicitly assigned to them. Owners and department heads see all classes. */
export function canAccessClass(opts: { role: RomRole; viewerEmail: string; klass: ClassRow }): boolean {
  if (opts.role === "owner" || opts.role === "department_head") return true;
  if (opts.role !== "teacher") return false;
  const want = opts.klass.assigned_teacher_email?.trim().toLowerCase();
  if (!want) return false;
  return want === opts.viewerEmail.trim().toLowerCase();
}

/**
 * Any school member (owner, department head, or teacher) may add pupils to a class in that school.
 * Viewing/editing the class still uses canAccessClass.
 */
export function canAddStudentsToClass(opts: { role: RomRole }): boolean {
  return opts.role === "owner" || opts.role === "department_head" || opts.role === "teacher";
}
