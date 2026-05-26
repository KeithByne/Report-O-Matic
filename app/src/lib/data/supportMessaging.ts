import { getServiceSupabase } from "@/lib/supabase/service";

function formatErr(e: { message: string }): string {
  return e.message || "Database error.";
}

export type SupportMessageRow = {
  id: string;
  thread_id: string;
  sender_role: "user" | "owner";
  sender_email: string;
  body: string;
  created_at: string;
};

export type SupportThreadRow = {
  id: string;
  user_email: string;
  display_name: string | null;
  tenant_id: string | null;
  tenant_name_snapshot: string | null;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  owner_last_read_at: string;
  user_last_read_at: string;
};

export type SupportThreadWithMessages = SupportThreadRow & {
  messages: SupportMessageRow[];
  unread_for_user: boolean;
  unread_for_owner: boolean;
};

function rowThread(raw: Record<string, unknown>): SupportThreadRow {
  return {
    id: raw.id as string,
    user_email: raw.user_email as string,
    display_name: (raw.display_name as string | null) ?? null,
    tenant_id: (raw.tenant_id as string | null) ?? null,
    tenant_name_snapshot: (raw.tenant_name_snapshot as string | null) ?? null,
    status: raw.status as "open" | "closed",
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    owner_last_read_at: raw.owner_last_read_at as string,
    user_last_read_at: raw.user_last_read_at as string,
  };
}

function rowMessage(raw: Record<string, unknown>): SupportMessageRow {
  return {
    id: raw.id as string,
    thread_id: raw.thread_id as string,
    sender_role: raw.sender_role as "user" | "owner",
    sender_email: raw.sender_email as string,
    body: raw.body as string,
    created_at: raw.created_at as string,
  };
}

async function threadHasUnreadForUser(thread: SupportThreadRow, supabase: NonNullable<ReturnType<typeof getServiceSupabase>>): Promise<boolean> {
  const { count, error } = await supabase
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", thread.id)
    .eq("sender_role", "owner")
    .gt("created_at", thread.user_last_read_at);
  if (error) throw new Error(formatErr(error));
  return (count ?? 0) > 0;
}

async function threadHasUnreadForOwner(thread: SupportThreadRow, supabase: NonNullable<ReturnType<typeof getServiceSupabase>>): Promise<boolean> {
  const { count, error } = await supabase
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", thread.id)
    .eq("sender_role", "user")
    .gt("created_at", thread.owner_last_read_at);
  if (error) throw new Error(formatErr(error));
  return (count ?? 0) > 0;
}

export async function countUnreadForUser(userEmail: string): Promise<number> {
  const supabase = getServiceSupabase();
  if (!supabase) return 0;
  const email = userEmail.trim().toLowerCase();
  const { data, error } = await supabase.from("support_threads").select("*").eq("user_email", email).maybeSingle();
  if (error) throw new Error(formatErr(error));
  if (!data) return 0;
  const thread = rowThread(data as Record<string, unknown>);
  return (await threadHasUnreadForUser(thread, supabase)) ? 1 : 0;
}

export async function countOwnerUnreadThreads(): Promise<number> {
  const supabase = getServiceSupabase();
  if (!supabase) return 0;
  const { data, error } = await supabase.from("support_threads").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(formatErr(error));
  let n = 0;
  for (const row of data ?? []) {
    const thread = rowThread(row as Record<string, unknown>);
    if (await threadHasUnreadForOwner(thread, supabase)) n++;
  }
  return n;
}

export async function listThreadsForOwner(): Promise<(SupportThreadRow & { unread_for_owner: boolean })[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("support_threads").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(formatErr(error));
  const out: (SupportThreadRow & { unread_for_owner: boolean })[] = [];
  for (const row of data ?? []) {
    const thread = rowThread(row as Record<string, unknown>);
    out.push({
      ...thread,
      unread_for_owner: await threadHasUnreadForOwner(thread, supabase),
    });
  }
  return out;
}

export async function getThreadWithMessagesForUser(userEmail: string): Promise<SupportThreadWithMessages | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const email = userEmail.trim().toLowerCase();
  const { data: threadRow, error: tErr } = await supabase.from("support_threads").select("*").eq("user_email", email).maybeSingle();
  if (tErr) throw new Error(formatErr(tErr));
  if (!threadRow) return null;
  const thread = rowThread(threadRow as Record<string, unknown>);
  const { data: msgs, error: mErr } = await supabase
    .from("support_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });
  if (mErr) throw new Error(formatErr(mErr));
  return {
    ...thread,
    messages: (msgs ?? []).map((m) => rowMessage(m as Record<string, unknown>)),
    unread_for_user: await threadHasUnreadForUser(thread, supabase),
    unread_for_owner: await threadHasUnreadForOwner(thread, supabase),
  };
}

export async function getThreadWithMessagesById(threadId: string): Promise<SupportThreadWithMessages | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data: threadRow, error: tErr } = await supabase.from("support_threads").select("*").eq("id", threadId).maybeSingle();
  if (tErr) throw new Error(formatErr(tErr));
  if (!threadRow) return null;
  const thread = rowThread(threadRow as Record<string, unknown>);
  const { data: msgs, error: mErr } = await supabase
    .from("support_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });
  if (mErr) throw new Error(formatErr(mErr));
  return {
    ...thread,
    messages: (msgs ?? []).map((m) => rowMessage(m as Record<string, unknown>)),
    unread_for_user: await threadHasUnreadForUser(thread, supabase),
    unread_for_owner: await threadHasUnreadForOwner(thread, supabase),
  };
}

export async function ensureThreadForUser(opts: {
  userEmail: string;
  displayName?: string | null;
  tenantId?: string | null;
  tenantName?: string | null;
}): Promise<SupportThreadRow> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const email = opts.userEmail.trim().toLowerCase();
  const existing = await getThreadWithMessagesForUser(email);
  if (existing) {
    const patch: Record<string, unknown> = {};
    if (opts.displayName?.trim()) patch.display_name = opts.displayName.trim();
    if (opts.tenantId) patch.tenant_id = opts.tenantId;
    if (opts.tenantName?.trim()) patch.tenant_name_snapshot = opts.tenantName.trim();
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString();
      await supabase.from("support_threads").update(patch).eq("id", existing.id);
      return { ...existing, ...patch } as SupportThreadRow;
    }
    const { messages: _m, unread_for_user: _u, unread_for_owner: _o, ...thread } = existing;
    return thread;
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("support_threads")
    .insert({
      user_email: email,
      display_name: opts.displayName?.trim() || null,
      tenant_id: opts.tenantId ?? null,
      tenant_name_snapshot: opts.tenantName?.trim() || null,
      updated_at: now,
      owner_last_read_at: now,
      user_last_read_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(formatErr(error));
  return rowThread(data as Record<string, unknown>);
}

export async function appendSupportMessage(opts: {
  threadId: string;
  senderRole: "user" | "owner";
  senderEmail: string;
  body: string;
}): Promise<SupportMessageRow> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const body = opts.body.trim();
  if (!body) throw new Error("Message cannot be empty.");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      thread_id: opts.threadId,
      sender_role: opts.senderRole,
      sender_email: opts.senderEmail.trim().toLowerCase(),
      body,
    })
    .select("*")
    .single();
  if (error) throw new Error(formatErr(error));
  await supabase.from("support_threads").update({ updated_at: now }).eq("id", opts.threadId);
  return rowMessage(data as Record<string, unknown>);
}

export async function markThreadReadByUser(threadId: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const now = new Date().toISOString();
  const { error } = await supabase.from("support_threads").update({ user_last_read_at: now }).eq("id", threadId);
  if (error) throw new Error(formatErr(error));
}

export async function markThreadReadByOwner(threadId: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const now = new Date().toISOString();
  const { error } = await supabase.from("support_threads").update({ owner_last_read_at: now }).eq("id", threadId);
  if (error) throw new Error(formatErr(error));
}
