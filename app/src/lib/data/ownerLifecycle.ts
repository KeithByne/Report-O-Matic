import { getServiceSupabase } from "@/lib/supabase/service";
import { deleteTenantById, getMembershipsForEmail, getOwnerEmailForTenant } from "@/lib/data/memberships";
import { getOwnerCreditBalance } from "@/lib/data/credits";
import { sendInactiveAccountReminderEmail } from "@/lib/email/inactiveAccountReminderEmail";
import { getStoredUiLanguageForEmail } from "@/lib/data/userUiLanguage";

const REMINDER_INTERVAL_DAYS = 20;
const INACTIVE_AFTER_DAYS = 100;

function formatErr(e: { message: string }): string {
  return e.message || "Database error.";
}

function normalizeOwnerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function syncOwnerLifecycleOnBalance(ownerEmail: string, balance: number): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;
  const owner = normalizeOwnerEmail(ownerEmail);
  if (!owner) return;
  const now = new Date().toISOString();

  if (balance > 0) {
    await supabase.from("owner_account_lifecycle").upsert(
      {
        owner_email: owner,
        zero_balance_since: null,
        updated_at: now,
      },
      { onConflict: "owner_email" },
    );
    return;
  }

  const { data: existing } = await supabase
    .from("owner_account_lifecycle")
    .select("zero_balance_since")
    .eq("owner_email", owner)
    .maybeSingle();

  if (!existing?.zero_balance_since) {
    await supabase.from("owner_account_lifecycle").upsert(
      {
        owner_email: owner,
        zero_balance_since: now,
        updated_at: now,
      },
      { onConflict: "owner_email" },
    );
  }
}

export async function runOwnerAccountHousekeeping(): Promise<{
  remindersSent: number;
  accountsMarkedInactive: number;
  tenantsDeleted: number;
}> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const { data: rows, error } = await supabase
    .from("owner_account_lifecycle")
    .select("owner_email, zero_balance_since, last_inactivity_reminder_at, marked_inactive_at")
    .not("zero_balance_since", "is", null)
    .is("marked_inactive_at", null);
  if (error) throw new Error(formatErr(error));

  let remindersSent = 0;
  let accountsMarkedInactive = 0;
  let tenantsDeleted = 0;
  const now = Date.now();

  for (const row of rows ?? []) {
    const owner = String(row.owner_email || "").trim().toLowerCase();
    if (!owner) continue;

    const balance = await getOwnerCreditBalance(owner);
    if (balance > 0) {
      await syncOwnerLifecycleOnBalance(owner, balance);
      continue;
    }

    const since = new Date(String(row.zero_balance_since)).getTime();
    const daysAtZero = Math.floor((now - since) / (24 * 60 * 60 * 1000));

    if (daysAtZero >= INACTIVE_AFTER_DAYS) {
      const memberships = await getMembershipsForEmail(owner);
      const ownerTenants = memberships.filter((m) => m.role === "owner");
      for (const m of ownerTenants) {
        try {
          await deleteTenantById(m.tenantId);
          tenantsDeleted += 1;
        } catch (e: unknown) {
          console.warn("[ROM housekeeping] tenant delete failed:", m.tenantId, e);
        }
      }
      await supabase
        .from("owner_account_lifecycle")
        .update({ marked_inactive_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("owner_email", owner);
      accountsMarkedInactive += 1;
      continue;
    }

    const lastReminder = row.last_inactivity_reminder_at
      ? new Date(String(row.last_inactivity_reminder_at)).getTime()
      : 0;
    const daysSinceReminder = lastReminder
      ? Math.floor((now - lastReminder) / (24 * 60 * 60 * 1000))
      : REMINDER_INTERVAL_DAYS;

    if (daysSinceReminder < REMINDER_INTERVAL_DAYS) continue;

    const memberships = await getMembershipsForEmail(owner);
    const billingTenantId = memberships.find((m) => m.role === "owner")?.tenantId;
    const billingUrl = billingTenantId
      ? `${process.env.NEXT_PUBLIC_APP_URL || "https://www.report-o-matic.online"}/reports/${encodeURIComponent(billingTenantId)}/billing`
      : undefined;
    const lang = (await getStoredUiLanguageForEmail(owner)) || "en";
    const daysRemaining = Math.max(0, INACTIVE_AFTER_DAYS - daysAtZero);

    try {
      await sendInactiveAccountReminderEmail({
        to: owner,
        language: lang,
        daysAtZero,
        daysRemaining,
        billingUrl,
      });
      await supabase
        .from("owner_account_lifecycle")
        .update({
          last_inactivity_reminder_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("owner_email", owner);
      remindersSent += 1;
    } catch (e: unknown) {
      console.warn("[ROM housekeeping] reminder email failed:", owner, e);
    }
  }

  return { remindersSent, accountsMarkedInactive, tenantsDeleted };
}

export async function syncLifecycleForTenantOwner(tenantId: string): Promise<void> {
  const owner = await getOwnerEmailForTenant(tenantId);
  if (!owner) return;
  const balance = await getOwnerCreditBalance(owner);
  await syncOwnerLifecycleOnBalance(owner, balance);
}
