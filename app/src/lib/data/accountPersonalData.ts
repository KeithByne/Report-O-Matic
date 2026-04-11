import crypto from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/service";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type SoleOwnerBlockError = {
  code: "sole_owner";
  message: string;
};

/**
 * If the user is the only owner of any school, account self-service closure is blocked until another owner exists
 * or the organisation is wound down separately.
 */
export async function assertAccountClosureAllowed(email: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database is not configured.");
  const e = normalizeEmail(email);

  const { data: ownerRows, error: oErr } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_email", e)
    .eq("role", "owner");
  if (oErr) throw new Error(formatErr(oErr));

  for (const row of ownerRows ?? []) {
    const tenantId = String((row as { tenant_id?: string }).tenant_id || "").trim();
    if (!tenantId) continue;
    const { count, error: cErr } = await supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role", "owner");
    if (cErr) throw new Error(formatErr(cErr));
    if ((count ?? 0) <= 1) {
      const err: SoleOwnerBlockError = {
        code: "sole_owner",
        message:
          "You are the only owner of at least one school. Add another owner or delete that organisation first, then try again.",
      };
      throw err;
    }
  }
}

function anonymizedEmail(): string {
  return `redacted-${crypto.randomUUID()}@account-closed.invalid`;
}

/**
 * Erases or anonymises personal data held for this sign-in identity while preserving school records where the law
 * allows (e.g. reports stay as school documents with author redacted).
 */
export async function closePersonalAccount(email: string): Promise<void> {
  await assertAccountClosureAllowed(email);

  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database is not configured.");
  const e = normalizeEmail(email);
  const anon = anonymizedEmail();

  const run = async (label: string, promise: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await promise;
    if (error) throw new Error(`${label}: ${formatErr(error)}`);
  };

  await run("otp_challenges", supabase.from("otp_challenges").delete().eq("email", e));
  await run("password_reset_challenges", supabase.from("password_reset_challenges").delete().eq("email", e));

  await run(
    "classes_assigned_teacher",
    supabase.from("classes").update({ assigned_teacher_email: null }).eq("assigned_teacher_email", e),
  );

  await run("reports_author", supabase.from("reports").update({ author_email: anon }).eq("author_email", e));

  await run("timetable_slots_teacher", supabase.from("timetable_slots").delete().eq("teacher_email", e));

  await run("student_events_actor", supabase.from("student_events").update({ actor_email: anon }).eq("actor_email", e));

  await run(
    "openai_usage_actor",
    supabase.from("openai_usage_events").update({ actor_email: anon }).eq("actor_email", e),
  );

  await run(
    "agent_links",
    supabase
      .from("agent_links")
      .update({
        agent_email: anon,
        display_name: null,
        payout_name: null,
        payout_contact_email: null,
        payout_stripe_account_id: null,
        active: false,
      })
      .eq("agent_email", e),
  );

  await run(
    "referral_earnings_agent",
    supabase.from("referral_earnings").update({ agent_email: anon }).eq("agent_email", e),
  );

  await run(
    "tenants_referred_by",
    supabase.from("tenants").update({ referred_by_email: null }).eq("referred_by_email", e),
  );

  await run(
    "test_access_claimed",
    supabase.from("test_access_links").update({ claimed_by_email: null }).eq("claimed_by_email", e),
  );
  await run(
    "test_access_created",
    supabase.from("test_access_links").update({ created_by_email: null }).eq("created_by_email", e),
  );

  await run("owner_credit_ledger", supabase.from("owner_credit_ledger").delete().eq("owner_email", e));

  await run(
    "platform_payments_customer",
    supabase.from("platform_payments").update({ customer_email: null }).eq("customer_email", e),
  );

  await run("memberships", supabase.from("memberships").delete().eq("user_email", e));
  await run("auth_passwords", supabase.from("auth_passwords").delete().eq("email", e));
}

export async function buildPersonalDataExport(email: string): Promise<Record<string, unknown>> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database is not configured.");
  const e = normalizeEmail(email);
  const exportedAt = new Date().toISOString();

  const safeSelect = async <T>(
    label: string,
    promise: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  ) => {
    const { data, error } = await promise;
    if (error) throw new Error(`${label}: ${formatErr(error)}`);
    return data ?? null;
  };

  const [
    memberships,
    reports,
    classesAssigned,
    studentEvents,
    openAiUsage,
    timetableSlots,
    agentLinks,
    referralEarnings,
    ownerCreditLedger,
    testLinksCreated,
    testLinksClaimed,
    platformPayments,
  ] = await Promise.all([
    safeSelect(
      "memberships",
      supabase
        .from("memberships")
        .select("id, tenant_id, role, first_name, last_name, created_at, tenants ( id, name, created_at )")
        .eq("user_email", e),
    ),
    safeSelect(
      "reports",
      supabase
        .from("reports")
        .select(
          "id, tenant_id, student_id, author_email, title, body, body_teacher_preview, teacher_preview_language, status, output_language, inputs, created_at, updated_at",
        )
        .eq("author_email", e),
    ),
    safeSelect(
      "classes",
      supabase
        .from("classes")
        .select("id, tenant_id, name, assigned_teacher_email, created_at")
        .eq("assigned_teacher_email", e),
    ),
    safeSelect("student_events", supabase.from("student_events").select("*").eq("actor_email", e)),
    safeSelect("openai_usage_events", supabase.from("openai_usage_events").select("*").eq("actor_email", e)),
    safeSelect("timetable_slots", supabase.from("timetable_slots").select("*").eq("teacher_email", e)),
    safeSelect("agent_links", supabase.from("agent_links").select("*").eq("agent_email", e)),
    safeSelect("referral_earnings", supabase.from("referral_earnings").select("*").eq("agent_email", e)),
    safeSelect("owner_credit_ledger", supabase.from("owner_credit_ledger").select("*").eq("owner_email", e)),
    safeSelect("test_access_links_created", supabase.from("test_access_links").select("*").eq("created_by_email", e)),
    safeSelect("test_access_links_claimed", supabase.from("test_access_links").select("*").eq("claimed_by_email", e)),
    safeSelect("platform_payments", supabase.from("platform_payments").select("*").eq("customer_email", e)),
  ]);

  return {
    exportSchemaVersion: 1,
    exportedAt,
    subjectEmail: e,
    note:
      "This package contains personal data we associate with your sign-in email in Report-O-Matic. It may not include data held only by third-party processors (e.g. your card issuer or a payment processor when enabled); see the privacy notice.",
    memberships,
    reportsAuthored: reports,
    classesWhereAssignedTeacher: classesAssigned,
    studentEventsByActor: studentEvents,
    openAiUsageEvents: openAiUsage,
    timetableSlotsAsTeacher: timetableSlots,
    agentLinks,
    referralEarnings,
    ownerCreditLedger,
    testAccessLinksCreated: testLinksCreated,
    testAccessLinksClaimed: testLinksClaimed,
    platformPaymentRowsWithCustomerEmail: platformPayments,
  };
}

export function isSoleOwnerBlock(err: unknown): err is SoleOwnerBlockError {
  return typeof err === "object" && err !== null && (err as SoleOwnerBlockError).code === "sole_owner";
}
