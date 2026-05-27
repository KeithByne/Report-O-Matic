import { getServiceSupabase } from "@/lib/supabase/service";

function formatErr(e: { message: string }): string {
  return e.message || "Database error.";
}

export const SUPPORT_CATEGORIES = [
  "missing",
  "how_to",
  "training",
  "billing",
  "reports",
  "account",
  "technical",
  "other",
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export function isSupportCategory(s: string): s is SupportCategory {
  return (SUPPORT_CATEGORIES as readonly string[]).includes(s);
}

export type SupportCaseStatus = "open" | "resolved";

export type SupportMessageRow = {
  id: string;
  case_id: string;
  sender_role: "user" | "owner" | "system";
  sender_email: string;
  body: string;
  created_at: string;
};

export type SupportCaseRow = {
  id: string;
  case_number: number;
  user_email: string;
  display_name: string | null;
  tenant_id: string | null;
  tenant_name_snapshot: string | null;
  subject: string;
  category: SupportCategory;
  description: string;
  status: SupportCaseStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  owner_last_read_at: string;
  user_last_read_at: string;
};

export type SupportCaseWithMessages = SupportCaseRow & {
  messages: SupportMessageRow[];
  unread_for_user: boolean;
  unread_for_owner: boolean;
};

export function formatSupportCaseNumber(caseNumber: number, createdAt?: string): string {
  const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
  return `ROM-${year}-${String(caseNumber).padStart(4, "0")}`;
}

function rowCase(raw: Record<string, unknown>): SupportCaseRow {
  const cat = String(raw.category ?? "other");
  return {
    id: raw.id as string,
    case_number: Number(raw.case_number),
    user_email: raw.user_email as string,
    display_name: (raw.display_name as string | null) ?? null,
    tenant_id: (raw.tenant_id as string | null) ?? null,
    tenant_name_snapshot: (raw.tenant_name_snapshot as string | null) ?? null,
    subject: String(raw.subject ?? "Support request").trim() || "Support request",
    category: isSupportCategory(cat) ? cat : "other",
    description: String(raw.description ?? "").trim(),
    status: raw.status === "resolved" ? "resolved" : "open",
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    resolved_at: (raw.resolved_at as string | null) ?? null,
    owner_last_read_at: raw.owner_last_read_at as string,
    user_last_read_at: raw.user_last_read_at as string,
  };
}

function rowMessage(raw: Record<string, unknown>): SupportMessageRow {
  const role = raw.sender_role as string;
  return {
    id: raw.id as string,
    case_id: raw.case_id as string,
    sender_role: role === "owner" || role === "system" ? role : "user",
    sender_email: raw.sender_email as string,
    body: raw.body as string,
    created_at: raw.created_at as string,
  };
}

async function caseHasUnreadForUser(
  c: SupportCaseRow,
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("case_id", c.id)
    .in("sender_role", ["owner", "system"])
    .gt("created_at", c.user_last_read_at);
  if (error) throw new Error(formatErr(error));
  return (count ?? 0) > 0;
}

async function caseHasUnreadForOwner(
  c: SupportCaseRow,
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
): Promise<boolean> {
  if (c.status === "resolved") return false;
  const { count, error } = await supabase
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("case_id", c.id)
    .eq("sender_role", "user")
    .gt("created_at", c.owner_last_read_at);
  if (error) throw new Error(formatErr(error));
  return (count ?? 0) > 0;
}

async function attachMessagesAndUnread(
  c: SupportCaseRow,
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
): Promise<SupportCaseWithMessages> {
  const { data: msgs, error: mErr } = await supabase
    .from("support_messages")
    .select("*")
    .eq("case_id", c.id)
    .order("created_at", { ascending: true });
  if (mErr) throw new Error(formatErr(mErr));
  return {
    ...c,
    messages: (msgs ?? []).map((m) => rowMessage(m as Record<string, unknown>)),
    unread_for_user: await caseHasUnreadForUser(c, supabase),
    unread_for_owner: await caseHasUnreadForOwner(c, supabase),
  };
}

export async function countUnreadCasesForUser(userEmail: string): Promise<number> {
  const supabase = getServiceSupabase();
  if (!supabase) return 0;
  const email = userEmail.trim().toLowerCase();
  const { data, error } = await supabase.from("support_cases").select("*").eq("user_email", email);
  if (error) throw new Error(formatErr(error));
  let n = 0;
  for (const row of data ?? []) {
    const c = rowCase(row as Record<string, unknown>);
    if (await caseHasUnreadForUser(c, supabase)) n++;
  }
  return n;
}

export async function countOwnerUnreadCases(): Promise<number> {
  const supabase = getServiceSupabase();
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from("support_cases")
    .select("*")
    .eq("status", "open")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(formatErr(error));
  let n = 0;
  for (const row of data ?? []) {
    const c = rowCase(row as Record<string, unknown>);
    if (await caseHasUnreadForOwner(c, supabase)) n++;
  }
  return n;
}

export async function listCasesForUser(userEmail: string): Promise<(SupportCaseRow & { unread_for_user: boolean })[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const email = userEmail.trim().toLowerCase();
  const { data, error } = await supabase
    .from("support_cases")
    .select("*")
    .eq("user_email", email)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(formatErr(error));
  const out: (SupportCaseRow & { unread_for_user: boolean })[] = [];
  for (const row of data ?? []) {
    const c = rowCase(row as Record<string, unknown>);
    out.push({ ...c, unread_for_user: await caseHasUnreadForUser(c, supabase) });
  }
  return out;
}

export async function listCasesForOwner(): Promise<(SupportCaseRow & { unread_for_owner: boolean })[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("support_cases").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(formatErr(error));
  const out: (SupportCaseRow & { unread_for_owner: boolean })[] = [];
  for (const row of data ?? []) {
    const c = rowCase(row as Record<string, unknown>);
    out.push({ ...c, unread_for_owner: await caseHasUnreadForOwner(c, supabase) });
  }
  return out;
}

export async function getCaseWithMessagesById(caseId: string): Promise<SupportCaseWithMessages | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("support_cases").select("*").eq("id", caseId).maybeSingle();
  if (error) throw new Error(formatErr(error));
  if (!data) return null;
  return attachMessagesAndUnread(rowCase(data as Record<string, unknown>), supabase);
}

export async function getCaseWithMessagesForUser(
  userEmail: string,
  caseId: string,
): Promise<SupportCaseWithMessages | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const email = userEmail.trim().toLowerCase();
  const { data, error } = await supabase
    .from("support_cases")
    .select("*")
    .eq("id", caseId)
    .eq("user_email", email)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  if (!data) return null;
  return attachMessagesAndUnread(rowCase(data as Record<string, unknown>), supabase);
}

export async function createSupportCase(opts: {
  userEmail: string;
  displayName?: string | null;
  tenantId?: string | null;
  tenantName?: string | null;
  subject: string;
  category: SupportCategory;
  description: string;
}): Promise<SupportCaseWithMessages> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const subject = opts.subject.trim();
  const description = opts.description.trim();
  if (!subject) throw new Error("Subject is required.");
  if (!description) throw new Error("Please describe the issue.");
  if (!isSupportCategory(opts.category)) throw new Error("Invalid category.");

  const now = new Date().toISOString();
  const email = opts.userEmail.trim().toLowerCase();

  const { data, error } = await supabase
    .from("support_cases")
    .insert({
      user_email: email,
      display_name: opts.displayName?.trim() || null,
      tenant_id: opts.tenantId ?? null,
      tenant_name_snapshot: opts.tenantName?.trim() || null,
      subject,
      category: opts.category,
      description,
      status: "open",
      updated_at: now,
      owner_last_read_at: new Date(0).toISOString(),
      user_last_read_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(formatErr(error));
  const created = rowCase(data as Record<string, unknown>);

  await appendSupportMessage({
    caseId: created.id,
    senderRole: "user",
    senderEmail: email,
    body: description,
  });

  const full = await getCaseWithMessagesById(created.id);
  if (!full) throw new Error("Could not load new case.");
  return full;
}

export async function appendSupportMessage(opts: {
  caseId: string;
  senderRole: "user" | "owner" | "system";
  senderEmail: string;
  body: string;
}): Promise<SupportMessageRow> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const body = opts.body.trim();
  if (!body) throw new Error("Message cannot be empty.");

  const { data: caseRow, error: cErr } = await supabase
    .from("support_cases")
    .select("status")
    .eq("id", opts.caseId)
    .maybeSingle();
  if (cErr) throw new Error(formatErr(cErr));
  if (!caseRow) throw new Error("Case not found.");
  if (caseRow.status === "resolved" && opts.senderRole === "user") {
    throw new Error("This case is resolved. Open a new issue if you need more help.");
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      case_id: opts.caseId,
      sender_role: opts.senderRole,
      sender_email: opts.senderEmail.trim().toLowerCase(),
      body,
    })
    .select("*")
    .single();
  if (error) throw new Error(formatErr(error));
  await supabase.from("support_cases").update({ updated_at: now }).eq("id", opts.caseId);
  return rowMessage(data as Record<string, unknown>);
}

export async function markCaseReadByUser(caseId: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const now = new Date().toISOString();
  const { error } = await supabase.from("support_cases").update({ user_last_read_at: now }).eq("id", caseId);
  if (error) throw new Error(formatErr(error));
}

export async function markCaseReadByOwner(caseId: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const now = new Date().toISOString();
  const { error } = await supabase.from("support_cases").update({ owner_last_read_at: now }).eq("id", caseId);
  if (error) throw new Error(formatErr(error));
}

export async function resolveSupportCase(opts: {
  caseId: string;
  ownerEmail: string;
  note?: string | null;
}): Promise<SupportCaseWithMessages> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");

  const existing = await getCaseWithMessagesById(opts.caseId);
  if (!existing) throw new Error("Case not found.");
  if (existing.status === "resolved") return existing;

  const caseLabel = formatSupportCaseNumber(existing.case_number, existing.created_at);
  const note = opts.note?.trim();
  const body = [
    `Your support case ${caseLabel} has been marked as resolved.`,
    note ? `\n\n${note}` : "",
    "\n\nIf you need further help, open a new issue from Contact.",
  ].join("");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("support_cases")
    .update({ status: "resolved", resolved_at: now, updated_at: now })
    .eq("id", opts.caseId);
  if (error) throw new Error(formatErr(error));

  await appendSupportMessage({
    caseId: opts.caseId,
    senderRole: "system",
    senderEmail: opts.ownerEmail.trim().toLowerCase(),
    body,
  });

  const full = await getCaseWithMessagesById(opts.caseId);
  if (!full) throw new Error("Could not load resolved case.");
  return full;
}
