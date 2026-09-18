/**
 * Seed an inhabited demo school (classes, pupils, one final report ready for PDF).
 *
 * Usage (from repo app/ folder):
 *
 *   cd C:\dev\Report-O-Matic\app\Report-O-Matic\app
 *   $env:SUPABASE_URL="…"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="…"
 *   $env:DEMO_OWNER_EMAIL="you@example.com"
 *   node --env-file=.env.local scripts/seed-demo-school.mjs
 *
 * Or without --env-file if the three vars are already in the shell.
 *
 * DEMO_OWNER_EMAIL must already be able to sign in (existing account).
 * The script attaches that email as owner of the new demo school.
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

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
];

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name}. Set it in the shell or app/.env.local then re-run.`);
    process.exit(1);
  }
  return v;
}

function emptyTerm() {
  const t = {};
  for (const k of METRIC_KEYS) t[k] = null;
  return t;
}

function filledTerm(seed = 7) {
  const t = {};
  let i = 0;
  for (const k of METRIC_KEYS) {
    t[k] = Math.min(10, Math.max(5, seed + ((i++ % 4) - 1)));
  }
  return t;
}

function displayName(first, last) {
  return `${first} ${last}`.trim();
}

const DEMO_BODY = `Alex has made steady progress this term. Attendance and punctuality have been excellent, and homework is usually complete and on time.

In class, Alex listens carefully, joins activities willingly, and works well with classmates. Reading and listening are particular strengths; speaking and writing are developing with growing confidence.

Pronunciation is clearer than earlier in the year, and vocabulary is expanding through classroom topics. With continued practice at home, Alex is well placed for a strong next term.`;

async function main() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const ownerEmail = (process.env.DEMO_OWNER_EMAIL || process.env.ROM_DEMO_OWNER_EMAIL || "")
    .trim()
    .toLowerCase();
  if (!ownerEmail) {
    console.error("Missing DEMO_OWNER_EMAIL (sign-in email that will own the demo school).");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const schoolName = `Demo School (${stamp})`;

  console.log("Creating tenant…", schoolName);
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .insert({
      name: schoolName,
      is_test_access: true,
      test_credits_remaining: 50,
    })
    .select("id, name")
    .single();
  if (tErr) throw new Error(tErr.message);
  const tenantId = tenant.id;

  console.log("Attaching owner membership…", ownerEmail);
  const { error: mErr } = await supabase.from("memberships").insert({
    tenant_id: tenantId,
    user_email: ownerEmail,
    role: "owner",
  });
  if (mErr) throw new Error(mErr.message);

  console.log("Granting demo credits…");
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
  const classDefs = [
    { name: "A2 English — Tuesday", cefr: "A2", subject: "efl" },
    { name: "B1 Conversation — Thursday", cefr: "B1", subject: "efl" },
    { name: "Year 5 Primary English", cefr: "Year 5", subject: "english", rubric: "primary" },
  ];

  const classIds = [];
  for (const c of classDefs) {
    console.log("Creating class…", c.name);
    const row = {
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
      active_weekdays: ["tue", "thu"],
    };
    const { data: cls, error: clErr } = await supabase.from("classes").insert(row).select("id, name").single();
    if (clErr) throw new Error(`${c.name}: ${clErr.message}`);
    classIds.push(cls.id);
  }

  const pupils = [
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

  let showcaseStudentId = null;
  for (const p of pupils) {
    const classId = classIds[p.classIdx];
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
      .select("id, display_name")
      .single();
    if (eErr) throw new Error(`students ${p.first}: ${eErr.message}`);
    if (p.first === "Alex" && p.last === "Martinez") showcaseStudentId = enr.id;
    console.log("  pupil", enr.display_name);
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

  console.log("Creating final report for Alex Martinez…");
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
    })
    .select("id")
    .single();
  if (rErr) throw new Error(rErr.message);

  const { error: uErr } = await supabase
    .from("reports")
    .update({ status: "final", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", report.id);
  if (uErr) throw new Error(uErr.message);

  const classUrl = `https://report-o-matic.online/reports/${tenantId}/classes/${classIds[0]}?panel=students`;
  const reportUrl = `https://report-o-matic.online/reports/${tenantId}/classes/${classIds[0]}/reports/${report.id}`;
  const pdfUrl = `https://report-o-matic.online/api/tenants/${tenantId}/reports/${report.id}/pdf?lang=en`;

  console.log("\nDemo school ready.");
  console.log("  tenant_id:", tenantId);
  console.log("  school:   ", schoolName);
  console.log("  owner:    ", ownerEmail);
  console.log("  class:    ", classUrl);
  console.log("  report:   ", reportUrl);
  console.log("  pdf:      ", pdfUrl);
  console.log("\nSign in as the owner email, open the demo school, then Print / PDF on Alex’s Term 1 report.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
