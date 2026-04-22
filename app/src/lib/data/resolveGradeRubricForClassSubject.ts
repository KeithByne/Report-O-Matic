import { listTenantCustomSubjects, rubricMapFromCustomSubjects } from "@/lib/data/tenantCustomSubjects";
import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import { gradeRubricForClassDefaultSubject } from "@/lib/gradeRubricProfile";
import { isSubjectCode } from "@/lib/subjects";

/**
 * Rubric implied by the class default subject and tenant custom-subject list.
 * Use `explicitCustomRubric` when the subject is not yet on the tenant list (e.g. POST create before merge).
 */
export async function resolveGradeRubricForClassSubject(
  tenantId: string,
  normalizedDefaultSubject: string,
  opts?: { explicitCustomRubric?: GradeRubricProfile },
): Promise<GradeRubricProfile> {
  const low = normalizedDefaultSubject.trim().toLowerCase();
  if (isSubjectCode(low)) return "language";
  if (opts?.explicitCustomRubric !== undefined) return opts.explicitCustomRubric;
  const rows = await listTenantCustomSubjects(tenantId);
  return gradeRubricForClassDefaultSubject(normalizedDefaultSubject, rubricMapFromCustomSubjects(rows));
}
