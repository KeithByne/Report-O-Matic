import { getServiceSupabase } from "@/lib/supabase/service";

export type RomRole = "owner" | "department_head" | "teacher";

export type MembershipWithTenant = {
  membershipId: string;
  tenantId: string;
  tenantName: string;
  role: RomRole;
};

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export async function getMembershipsForEmail(email: string): Promise<MembershipWithTenant[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];

  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("memberships")
    .select("id, role, tenant_id, tenants ( name )")
    .eq("user_email", normalized);

  if (error) throw new Error(formatErr(error));

  const rows = data ?? [];
  const out: MembershipWithTenant[] = [];
  for (const row of rows as {
    id: string;
    role: string;
    tenant_id: string;
    tenants: { name: string } | { name: string }[] | null;
  }[]) {
    const t = row.tenants;
    const name =
      Array.isArray(t) ? t[0]?.name : typeof t === "object" && t && "name" in t ? t.name : null;
    if (!name) continue;
    const role = row.role as RomRole;
    if (role !== "owner" && role !== "department_head" && role !== "teacher") continue;
    out.push({
      membershipId: row.id,
      tenantId: row.tenant_id,
      tenantName: name,
      role,
    });
  }
  return out;
}

/** Primary owner email for a school (first owner if several). Used for shared credit pool. */
export async function getOwnerEmailForTenant(tenantId: string): Promise<string | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("memberships")
    .select("user_email")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .order("user_email", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const e = typeof (data as { user_email?: string }).user_email === "string" ? (data as { user_email: string }).user_email : "";
  const n = e.trim().toLowerCase();
  return n || null;
}

export async function getRoleForTenant(email: string, tenantId: string): Promise<RomRole | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_email", normalized)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !data) return null;
  const r = data.role as string;
  if (r !== "owner" && r !== "department_head" && r !== "teacher") return null;

  return r as RomRole;
}

/** First/last name on the membership row for a user in a tenant (for class settings display, etc.). */
export async function getMembershipDisplayNameForEmail(
  tenantId: string,
  email: string,
): Promise<{ first_name: string | null; last_name: string | null } | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("memberships")
    .select("first_name, last_name")
    .eq("tenant_id", tenantId)
    .eq("user_email", normalized)
    .maybeSingle();
  if (error || !data) return null;
  return {
    first_name: typeof (data as { first_name?: unknown }).first_name === "string" ? (data as { first_name: string }).first_name : null,
    last_name: typeof (data as { last_name?: unknown }).last_name === "string" ? (data as { last_name: string }).last_name : null,
  };
}

export type TenantMemberRow = {
  user_email: string;
  role: RomRole;
  first_name: string | null;
  last_name: string | null;
};

/** All members of a school (for owner / department head dashboards). */
export async function listMembersForTenant(tenantId: string): Promise<TenantMemberRow[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("memberships")
    .select("user_email, role, first_name, last_name")
    .eq("tenant_id", tenantId)
    .order("role", { ascending: true })
    .order("user_email", { ascending: true });
  if (error) throw new Error(formatErr(error));
  const out: TenantMemberRow[] = [];
  for (const row of data ?? []) {
    const r = (row as { user_email: string; role: string }).role as RomRole;
    if (r !== "owner" && r !== "department_head" && r !== "teacher") continue;
    out.push({
      user_email: (row as { user_email: string }).user_email,
      role: r,
      first_name: typeof (row as { first_name?: unknown }).first_name === "string" ? (row as { first_name: string }).first_name : null,
      last_name: typeof (row as { last_name?: unknown }).last_name === "string" ? (row as { last_name: string }).last_name : null,
    } as TenantMemberRow);
  }
  return out;
}

export async function getTenantName(tenantId: string): Promise<string | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle();
  if (error || !data) return null;
  return (data as { name: string }).name;
}

export async function hasAnyMembership(email: string): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;
  const normalized = email.trim().toLowerCase();
  const { count, error } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_email", normalized);
  if (error) throw new Error(formatErr(error));
  return (count ?? 0) > 0;
}

/**
 * First-time signup: create a school (tenant) and owner membership. No-op if the email already has any membership.
 */
function isUniqueViolation(e: { message: string; code?: string }): boolean {
  return e.code === "23505" || /duplicate key|unique constraint/i.test(e.message);
}

/**
 * Invite by email before first sign-in.
 * - Owner: may add department heads or teachers.
 * - Department head: may add teachers only.
 */
export async function inviteMemberToTenant(opts: {
  tenantId: string;
  inviteeEmail: string;
  role: "department_head" | "teacher";
  inviterEmail: string;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return { ok: false, message: "Database is not configured.", status: 503 };
  }

  const inviter = opts.inviterEmail.trim().toLowerCase();
  const invitee = opts.inviteeEmail.trim().toLowerCase();
  if (!invitee || !invitee.includes("@")) {
    return { ok: false, message: "Please provide a valid invitee email.", status: 400 };
  }
  if (invitee === inviter) {
    return { ok: false, message: "You cannot invite your own email.", status: 400 };
  }

  const { data: inviterRow, error: oErr } = await supabase
    .from("memberships")
    .select("role")
    .eq("tenant_id", opts.tenantId)
    .eq("user_email", inviter)
    .maybeSingle();

  if (oErr) throw new Error(formatErr(oErr));
  if (!inviterRow) {
    return { ok: false, message: "You are not a member of this organisation.", status: 403 };
  }

  const inviterRole = inviterRow.role as RomRole;
  if (inviterRole === "teacher") {
    return { ok: false, message: "Teachers cannot invite members.", status: 403 };
  }
  if (inviterRole === "department_head") {
    if (opts.role !== "teacher") {
      return { ok: false, message: "Department heads can only invite teachers.", status: 403 };
    }
  }

  const fn = (opts.firstName ?? "").trim();
  const ln = (opts.lastName ?? "").trim();
  const { error: iErr } = await supabase.from("memberships").insert({
    tenant_id: opts.tenantId,
    user_email: invitee,
    role: opts.role,
    ...(fn ? { first_name: fn } : {}),
    ...(ln ? { last_name: ln } : {}),
  });

  if (iErr) {
    if (isUniqueViolation(iErr)) {
      return {
        ok: false,
        message: "That email already has access to this school.",
        status: 409,
      };
    }
    throw new Error(formatErr(iErr));
  }

  return { ok: true };
}

/** True if this email is an owner of at least one school (can add additional schools). */
export async function hasOwnerMembership(email: string): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_email", normalized)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

/** Create a new school and add the user as owner. Caller must verify the user is already an owner somewhere. */
export async function createAdditionalSchoolForOwner(opts: {
  ownerEmail: string;
  schoolName: string;
}): Promise<{ tenantId: string }> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const email = opts.ownerEmail.trim().toLowerCase();
  const schoolName = opts.schoolName.trim();
  if (!schoolName) throw new Error("School name is required.");

  const can = await hasOwnerMembership(email);
  if (!can) throw new Error("Only organisation owners can add a new school.");

  const { data: tenant, error: tErr } = await supabase.from("tenants").insert({ name: schoolName }).select("id").single();
  if (tErr) throw new Error(formatErr(tErr));

  const tenantId = tenant.id as string;
  const { error: mErr } = await supabase.from("memberships").insert({
    tenant_id: tenantId,
    user_email: email,
    role: "owner",
  });
  if (mErr) {
    await supabase.from("tenants").delete().eq("id", tenantId);
    throw new Error(formatErr(mErr));
  }
  return { tenantId };
}

export async function ensureOwnerTenantForSignup(opts: {
  email: string;
  schoolName: string;
  referralCode?: string | null;
}): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;

  const email = opts.email.trim().toLowerCase();
  const schoolName = opts.schoolName.trim();
  if (!email || !schoolName) return;

  const exists = await hasAnyMembership(email);
  if (exists) return;

  let referredByEmail: string | null = null;
  const code = (opts.referralCode ?? "").trim();
  if (code) {
    const { data: agent } = await supabase.from("agent_links").select("agent_email, active").eq("code", code).maybeSingle();
    if (agent && (agent as any).active) {
      referredByEmail = String((agent as any).agent_email || "").trim().toLowerCase() || null;
    }
  }

  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .insert({ name: schoolName, referral_code: code || null, referred_by_email: referredByEmail })
    .select("id")
    .single();
  if (tErr) throw new Error(formatErr(tErr));

  const tenantId = tenant.id as string;
  const { error: mErr } = await supabase.from("memberships").insert({
    tenant_id: tenantId,
    user_email: email,
    role: "owner",
  });
  if (mErr) {
    await supabase.from("tenants").delete().eq("id", tenantId);
    throw new Error(formatErr(mErr));
  }
}

export async function getMembershipRoleForEmail(
  tenantId: string,
  userEmail: string,
): Promise<RomRole | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const normalized = userEmail.trim().toLowerCase();
  const { data, error } = await supabase
    .from("memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_email", normalized)
    .maybeSingle();
  if (error || !data) return null;
  const r = (data as { role: string }).role as RomRole;
  if (r !== "owner" && r !== "department_head" && r !== "teacher") return null;
  return r;
}

export async function setMembershipRoleForTenant(
  tenantId: string,
  userEmail: string,
  role: "department_head" | "teacher",
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const normalized = userEmail.trim().toLowerCase();
  const { error } = await supabase
    .from("memberships")
    .update({ role })
    .eq("tenant_id", tenantId)
    .eq("user_email", normalized);
  if (error) throw new Error(formatErr(error));
}

export async function setMembershipDisplayNameForTenant(
  tenantId: string,
  userEmail: string,
  patch: { first_name?: string | null; last_name?: string | null },
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const normalized = userEmail.trim().toLowerCase();
  const row: { first_name?: string | null; last_name?: string | null } = {};
  if (patch.first_name !== undefined) row.first_name = patch.first_name;
  if (patch.last_name !== undefined) row.last_name = patch.last_name;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase
    .from("memberships")
    .update(row)
    .eq("tenant_id", tenantId)
    .eq("user_email", normalized);
  if (error) throw new Error(formatErr(error));
}

export async function deleteMembershipForEmail(tenantId: string, userEmail: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const normalized = userEmail.trim().toLowerCase();
  const { error } = await supabase.from("memberships").delete().eq("tenant_id", tenantId).eq("user_email", normalized);
  if (error) throw new Error(formatErr(error));
}

export async function deleteTenantById(tenantId: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { error } = await supabase.from("tenants").delete().eq("id", tenantId);
  if (error) throw new Error(formatErr(error));
}
