import {
  classBulkPdfRowReadyForPeriod,
  focusTermComplete,
  isShortCourseReport,
  parseReportInputs,
  pickClassBulkReportRowForPeriod,
  reportCommentTextForBulkPdf,
  reportReadyForClassBulkPdf,
  reportTermReadyForClassesDashboard,
  termHasAnyRecordedGrades,
  type ReportPeriod,
} from "@/lib/reportInputs";

export type ClassBulkPdfIncompleteReason =
  | "no_report"
  | "no_term_report"
  | "no_comment"
  | "no_grades"
  | "not_finished";

export type ClassBulkPdfIncompleteEntry = {
  studentName: string;
  className?: string;
  period?: ReportPeriod;
  shortCourse?: boolean;
  reason: ClassBulkPdfIncompleteReason;
};

const REASON_LABEL: Record<ClassBulkPdfIncompleteReason, string> = {
  no_report: "no report saved",
  no_term_report: "no report for the selected term",
  no_comment: "comment not generated",
  no_grades: "grades not saved",
  not_finished: "report not finished (comment or grades incomplete)",
};

const TERM_LABEL: Record<ReportPeriod, string> = {
  first: "Term 1",
  second: "Term 2",
  third: "Term 3",
};

function periodLabel(entry: ClassBulkPdfIncompleteEntry): string {
  if (entry.shortCourse) return "Short course";
  if (entry.period) return TERM_LABEL[entry.period];
  return "Report";
}

function classifyRowFailure(r: {
  status: "draft" | "final";
  body: string;
  body_teacher_preview?: string | null;
  inputs: unknown;
}): ClassBulkPdfIncompleteReason {
  const comment = reportCommentTextForBulkPdf(r);
  if (!comment) return "no_comment";
  const inputs = parseReportInputs(r.inputs);
  if (r.status !== "final" && !focusTermComplete(inputs)) return "no_grades";
  return "not_finished";
}

type BulkPdfReportRow = {
  student_id: string;
  updated_at: string;
  status: "draft" | "final";
  body: string;
  body_teacher_preview?: string | null;
  inputs: unknown;
};

/** Why a pupil's report for one term is not ready for class/school bulk PDF. */
export function classBulkPdfIncompleteEntryForStudent<T extends BulkPdfReportRow>(
  reports: T[],
  student: { id: string; display_name: string; class_name?: string },
  period: ReportPeriod,
): ClassBulkPdfIncompleteEntry | null {
  const hasAny = reports.some((r) => r.student_id === student.id);
  const row = pickClassBulkReportRowForPeriod(reports, student.id, period);
  if (!row) {
    return {
      studentName: student.display_name,
      className: student.class_name,
      period,
      reason: hasAny ? "no_term_report" : "no_report",
    };
  }
  if (classBulkPdfRowReadyForPeriod(row, period)) return null;

  const inputs = parseReportInputs(row.inputs);
  const comment = reportCommentTextForBulkPdf(row);
  let reason: ClassBulkPdfIncompleteReason = "not_finished";
  if (!comment) reason = "no_comment";
  else if (!reportTermReadyForClassesDashboard({ inputs, body: comment }, period)) reason = "no_comment";
  else if (!termHasAnyRecordedGrades(inputs, period)) reason = "no_grades";

  return {
    studentName: student.display_name,
    className: student.class_name,
    period: isShortCourseReport(inputs) ? undefined : period,
    shortCourse: isShortCourseReport(inputs),
    reason,
  };
}

/** Incomplete rows when merging every report in a class (`term=all`). */
export function listClassBulkPdfIncompleteAll<
  T extends {
    student_id: string;
    status: "draft" | "final";
    body: string;
    body_teacher_preview?: string | null;
    inputs: unknown;
  },
>(
  students: { id: string; display_name: string }[],
  reports: T[],
): ClassBulkPdfIncompleteEntry[] {
  const out: ClassBulkPdfIncompleteEntry[] = [];
  const byStudent = new Map<string, T[]>();
  for (const r of reports) {
    const arr = byStudent.get(r.student_id) ?? [];
    arr.push(r);
    byStudent.set(r.student_id, arr);
  }

  for (const s of students) {
    const rs = byStudent.get(s.id);
    if (!rs?.length) {
      out.push({ studentName: s.display_name, reason: "no_report" });
      continue;
    }
    for (const r of rs) {
      if (reportReadyForClassBulkPdf({ status: r.status, body: r.body, inputs: r.inputs })) continue;
      const inputs = parseReportInputs(r.inputs);
      out.push({
        studentName: s.display_name,
        period: isShortCourseReport(inputs) ? undefined : inputs.report_period,
        shortCourse: isShortCourseReport(inputs),
        reason: classifyRowFailure(r),
      });
    }
  }

  out.sort((a, b) => {
    const n = a.studentName.localeCompare(b.studentName, undefined, { sensitivity: "base" });
    if (n !== 0) return n;
    return periodLabel(a).localeCompare(periodLabel(b));
  });
  return out;
}

export function listClassBulkPdfIncompleteForTerm<T extends BulkPdfReportRow>(
  students: { id: string; display_name: string; class_name?: string }[],
  reports: T[],
  period: ReportPeriod,
): ClassBulkPdfIncompleteEntry[] {
  const out: ClassBulkPdfIncompleteEntry[] = [];
  for (const s of students) {
    const entry = classBulkPdfIncompleteEntryForStudent(reports, s, period);
    if (entry) out.push(entry);
  }
  out.sort((a, b) => a.studentName.localeCompare(b.studentName, undefined, { sensitivity: "base" }));
  return out;
}

export function formatBulkPdfIncompleteError(baseMessage: string, incomplete: ClassBulkPdfIncompleteEntry[]): string {
  if (incomplete.length === 0) return baseMessage;
  const lines = incomplete.map((e) => {
    const who = e.className ? `${e.studentName} (${e.className})` : e.studentName;
    return `• ${who} — ${periodLabel(e)}: ${REASON_LABEL[e.reason]}`;
  });
  return `${baseMessage}\n\nNot complete:\n${lines.join("\n")}`;
}

export function bulkPdfIncompleteResponse(baseMessage: string, incomplete: ClassBulkPdfIncompleteEntry[]) {
  return {
    error: formatBulkPdfIncompleteError(baseMessage, incomplete),
    incomplete,
  };
}
