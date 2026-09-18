import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const METRIC_KEYS = [
  "attendance",
  "punctuality",
  "completes_homework",
  "submits_homework_on_time",
  "pays_attention_to_teacher",
  "avoids_distraction",
  "takes_part_in_activities",
  "interacts_with_peers",
  "reading",
  "writing",
  "listening",
  "speaking",
  "pronunciation",
  "grammar",
  "vocabulary",
  "reading_comprehension",
] as const;

const DEMO_BODY = `Alex has made steady progress this term. Attendance and punctuality have been excellent, and homework is usually complete and on time.

In class, Alex listens carefully, joins activities willingly, and works well with classmates. Reading and listening are particular strengths; speaking and writing are developing with growing confidence.

Pronunciation is clearer than earlier in the year, and vocabulary is expanding through classroom topics. With continued practice at home, Alex is well placed for a strong next term.`;

function emptyTerm(): Record<string, number | null> {
  const t: Record<string, number | null> = {};
  for (const k of METRIC_KEYS) t[k] = null;
  return t;
}

function filledTerm(seed = 7): Record<string, number | null> {
  const t: Record<string, number | null> = {};
  let i = 0;
  for (const k of METRIC_KEYS) {
    t[k] = Math.min(10, Math.max(5, seed + ((i++ % 4) - 1)));
  }
  return t;
}

function displayName(first: string, last: string) {
  return `${first} ${last}`.trim();
}

export type SeedInhabitedDemoSchoolResult = {
  tenant_id: string;
  school_name: string;
  owner_email: string;
  class_id: string;
  report_id: string;
  class_url: string;
  report_url: string;
  pdf_url: string;
};

/**
 * Creates a sandbox demo school: 3 classes, 12 pupils, one final Term 1 report (PDF-ready).
 * Owner membership + 50 credits are attached to `ownerEmail` (must be a sign-in email).
 */
export async function seedInhabitedDemoSchool(
  supabase: SupabaseClient,
  opts: { ownerEmail: string; publicBaseUrl: string },
): Promise<SeedInhabitedDemoSchoolResult> {
  const ownerEmail = opts.ownerEmail.trim().toLowerCase();
  if (!ownerEmail) throw new Error("Owner email is required.");

  const base = opts.publicBaseUrl.replace(/\/$/, "");
  const stamp = new Date().toISOString().slice(0, 10);
  const schoolName = `Demo School (${stamp})`;

  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .insert({
      name: schoolName,
      is_test_access: true,
      test_credits_remaining: 50,
      test_closed_at: null,
    })
    .select("id, name")
    .single();
  if (tErr) throw new Error(tErr.message);
  const tenantId = String(tenant.id);

  const { error: mErr } = await supabase.from("memberships").insert({
    tenant_id: tenantId,
    user_email: ownerEmail,
    role: "owner",
  });
  if (mErr) throw new Error(mErr.message);

  const { error: cErr } = await supabase.from("owner_credit_ledger").insert({
    owner_email: ownerEmail,
    delta_credits: 50,
    reason: "manual_adjust",
    tenant_id: tenantId,
    report_id: null,
    stripe_event_id: `demo-seed-${randomUUID()}`,
  });
  if (cErr) throw new Error(cErr.message);

  const year = "2025-2026";
  const classDefs: Array<{
    name: string;
    cefr: string;
    subject: string;
    rubric?: string;
    weekdays: string[];
  }> = [
    { name: "A2 English — Tuesday", cefr: "A2", subject: "efl", weekdays: ["tue"] },
    { name: "B1 Conversation — Thursday", cefr: "B1", subject: "efl", weekdays: ["thu"] },
    {
      name: "Year 5 Primary English",
      cefr: "Year 5",
      subject: "english",
      rubric: "primary",
      weekdays: ["mon", "tue", "wed", "thu", "fri"],
    },
  ];

  const classIds: string[] = [];
  for (const c of classDefs) {
    const { data: cls, error: clErr } = await supabase
      .from("classes")
      .insert({
        tenant_id: tenantId,
        name: c.name,
        scholastic_year: year,
        cefr_level: c.cefr,
        default_subject: c.subject,
        default_output_language: "en",
        default_new_report_kind: "standard",
        default_new_report_period: "first",
        grade_rubric_profile: c.rubric || "language",
        assigned_teacher_email: ownerEmail,
        active_weekdays: c.weekdays,
      })
      .select("id")
      .single();
    if (clErr) throw new Error(`${c.name}: ${clErr.message}`);
    classIds.push(String(cls.id));
  }

  const pupils: Array<{
    first: string;
    last: string;
    gender: "male" | "female" | "non_binary";
    classIdx: number;
  }> = [
    { first: "Alex", last: "Martinez", gender: "non_binary", classIdx: 0 },
    { first: "Sofia", last: "Chen", gender: "female", classIdx: 0 },
    { first: "Noah", last: "Patel", gender: "male", classIdx: 0 },
    { first: "Mia", last: "Rossi", gender: "female", classIdx: 0 },
    { first: "Lucas", last: "Nguyen", gender: "male", classIdx: 1 },
    { first: "Emma", last: "Kowalski", gender: "female", classIdx: 1 },
    { first: "Omar", last: "Hassan", gender: "male", classIdx: 1 },
    { first: "Isla", last: "Brown", gender: "female", classIdx: 1 },
    { first: "Theo", last: "Garcia", gender: "male", classIdx: 2 },
    { first: "Ava", last: "Silva", gender: "female", classIdx: 2 },
    { first: "Leo", last: "Ivanov", gender: "male", classIdx: 2 },
    { first: "Nina", last: "Dubois", gender: "female", classIdx: 2 },
  ];

  let showcaseStudentId: string | null = null;
  for (const p of pupils) {
    const classId = classIds[p.classIdx]!;
    const { data: school, error: sErr } = await supabase
      .from("school_students")
      .insert({
        tenant_id: tenantId,
        first_name: p.first,
        last_name: p.last,
        display_name: displayName(p.first, p.last),
        gender: p.gender,
        status: "active",
      })
      .select("id")
      .single();
    if (sErr) throw new Error(`school_students ${p.first}: ${sErr.message}`);

    const { data: enr, error: eErr } = await supabase
      .from("students")
      .insert({
        tenant_id: tenantId,
        school_student_id: school.id,
        class_id: classId,
        display_name: displayName(p.first, p.last),
        first_name: p.first,
        last_name: p.last,
        gender: p.gender,
      })
      .select("id")
      .single();
    if (eErr) throw new Error(`students ${p.first}: ${eErr.message}`);
    if (p.first === "Alex" && p.last === "Martinez") showcaseStudentId = String(enr.id);
  }

  if (!showcaseStudentId) throw new Error("Showcase pupil missing.");

  const inputs = {
    schema_version: 2,
    report_kind: "standard",
    terms: [filledTerm(8), emptyTerm(), emptyTerm()],
    report_period: "first",
    subject_code: "efl",
    optional_teacher_notes: "Demo seed — first term complete.",
    comment_generated_for_terms: [true, false, false],
    grade_rubric_profile: "language",
  };

  const { data: report, error: rErr } = await supabase
    .from("reports")
    .insert({
      tenant_id: tenantId,
      student_id: showcaseStudentId,
      author_email: ownerEmail,
      title: "Term 1 report",
      body: DEMO_BODY,
      body_teacher_preview: DEMO_BODY,
      teacher_preview_language: "en",
      status: "draft",
      output_language: "en",
      inputs,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (rErr) throw new Error(rErr.message);

  const reportId = String(report.id);
  const { error: uErr } = await supabase
    .from("reports")
    .update({ status: "final", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", reportId);
  if (uErr) throw new Error(uErr.message);

  const classId = classIds[0]!;
  return {
    tenant_id: tenantId,
    school_name: schoolName,
    owner_email: ownerEmail,
    class_id: classId,
    report_id: reportId,
    class_url: `${base}/reports/${tenantId}/classes/${classId}?panel=students`,
    report_url: `${base}/reports/${tenantId}/classes/${classId}/reports/${reportId}`,
    pdf_url: `${base}/api/tenants/${tenantId}/reports/${reportId}/pdf?lang=en`,
  };
}
