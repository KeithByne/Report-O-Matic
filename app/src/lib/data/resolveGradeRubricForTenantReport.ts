import { listTenantCustomSubjects, rubricMapFromCustomSubjects } from "@/lib/data/tenantCustomSubjects";
import type { GradeRubricProfile } from "@/lib/gradeRubricProfile";
import { gradeRubricForReport, parseReportInputs } from "@/lib/reportInputs";

export async function resolveGradeRubricForTenantReport(
  tenantId: string,
  inputs: unknown,
  classDefaultSubject: string,
  classStoredRubric?: GradeRubricProfile | null,
): Promise<GradeRubricProfile> {
  const parsed = parseReportInputs(inputs);
  const rows = await listTenantCustomSubjects(tenantId);
  const map = rubricMapFromCustomSubjects(rows);
  return gradeRubricForReport(parsed, classDefaultSubject, map, classStoredRubric);
}
