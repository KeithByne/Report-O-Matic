import * as XLSX from "xlsx";
import type { ClassRow } from "@/lib/data/classesDb";
import type { StudentWithClass } from "@/lib/data/students";
import type { ReportRow } from "@/lib/data/reportsDb";
import type { TenantMemberRow } from "@/lib/data/memberships";
import type { ClassScholasticArchiveRow } from "@/lib/data/classArchives";

export type TenantExportData = {
  tenant: { id: string; name: string | null };
  members: TenantMemberRow[];
  classes: ClassRow[];
  students: StudentWithClass[];
  reports: ReportRow[];
  archives: (ClassScholasticArchiveRow & { payload_json?: string | null })[];
};

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

export function buildTenantExportWorkbook(data: TenantExportData): Buffer {
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: `Report-O-Matic export${data.tenant.name ? ` — ${data.tenant.name}` : ""}`,
    Subject: "Tenant data export",
    Author: "Report-O-Matic",
    CreatedDate: new Date(),
  };

  const meta = XLSX.utils.json_to_sheet([
    {
      tenant_id: data.tenant.id,
      tenant_name: data.tenant.name ?? "",
      exported_at: new Date().toISOString(),
      members_count: data.members.length,
      classes_count: data.classes.length,
      students_count: data.students.length,
      reports_count: data.reports.length,
      archives_count: data.archives.length,
    },
  ]);
  XLSX.utils.book_append_sheet(wb, meta, "Meta");

  const members = XLSX.utils.json_to_sheet(
    data.members.map((m) => ({
      user_email: m.user_email,
      role: m.role,
    })),
  );
  XLSX.utils.book_append_sheet(wb, members, "Members");

  const classes = XLSX.utils.json_to_sheet(
    data.classes.map((c) => ({
      id: c.id,
      name: c.name,
      scholastic_year: c.scholastic_year ?? "",
      cefr_level: c.cefr_level ?? "",
      default_subject: c.default_subject,
      default_output_language: c.default_output_language,
      assigned_teacher_email: c.assigned_teacher_email ?? "",
      created_at: c.created_at,
    })),
  );
  XLSX.utils.book_append_sheet(wb, classes, "Classes");

  const students = XLSX.utils.json_to_sheet(
    data.students.map((s) => ({
      id: s.id,
      display_name: s.display_name,
      first_name: s.first_name ?? "",
      last_name: s.last_name ?? "",
      gender: s.gender ?? "",
      class_id: s.class_id,
      class_name: s.class_name,
      created_at: s.created_at,
    })),
  );
  XLSX.utils.book_append_sheet(wb, students, "Students");

  const reports = XLSX.utils.json_to_sheet(
    data.reports.map((r) => ({
      id: r.id,
      student_id: r.student_id,
      author_email: r.author_email,
      title: r.title ?? "",
      status: r.status,
      output_language: r.output_language,
      teacher_preview_language: r.teacher_preview_language,
      updated_at: r.updated_at,
      created_at: r.created_at,
      report_period: r.inputs?.report_period ?? "",
      subject_code: r.inputs?.subject_code ?? "",
      has_body: String(r.body || "").trim() ? "yes" : "no",
      has_teacher_preview: String(r.body_teacher_preview || "").trim() ? "yes" : "no",
      inputs_json: safeJson(r.inputs),
      body: r.body,
      body_teacher_preview: r.body_teacher_preview,
    })),
  );
  XLSX.utils.book_append_sheet(wb, reports, "Reports");

  const archives = XLSX.utils.json_to_sheet(
    data.archives.map((a) => ({
      id: a.id,
      class_id: a.class_id,
      scholastic_year_label: a.scholastic_year_label,
      archived_at: a.archived_at,
      payload_json: a.payload_json ?? "",
    })),
  );
  XLSX.utils.book_append_sheet(wb, archives, "Archives");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

