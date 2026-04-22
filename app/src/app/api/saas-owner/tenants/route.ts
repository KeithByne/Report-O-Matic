import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { getServiceSupabase } from "@/lib/supabase/service";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export async function GET(req: Request) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const url = new URL(req.url);
  const q = norm(url.searchParams.get("q") ?? "");

  try {
    // Load tenants (limit to keep UI fast).
    const { data: tenants, error: tErr } = await supabase
      .from("tenants")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(200);
    if (tErr) throw new Error(tErr.message);

    const tenantIds = (tenants ?? []).map((t) => (t as { id: string }).id);
    const { data: owners, error: oErr } = tenantIds.length
      ? await supabase
          .from("memberships")
          .select("tenant_id, user_email, role")
          .in("tenant_id", tenantIds)
          .eq("role", "owner")
      : { data: [], error: null };
    if (oErr) throw new Error(oErr.message);

    const ownersByTenant = new Map<string, string[]>();
    for (const row of (owners ?? []) as { tenant_id: string; user_email: string }[]) {
      const tid = row.tenant_id;
      if (!ownersByTenant.has(tid)) ownersByTenant.set(tid, []);
      ownersByTenant.get(tid)!.push(row.user_email);
    }

    const primaryOwners = new Set<string>();
    for (const [, emails] of ownersByTenant) {
      const ordered = [...emails].sort((a, b) => a.localeCompare(b));
      if (ordered[0]) primaryOwners.add(ordered[0]);
    }

    const creditsByOwner = new Map<string, number>();
    const primaryOwnerList = [...primaryOwners];
    if (primaryOwnerList.length > 0) {
      const { data: ledgerRows, error: lErr } = await supabase
        .from("owner_credit_ledger")
        .select("owner_email, delta_credits")
        .in("owner_email", primaryOwnerList);
      if (lErr) throw new Error(lErr.message);
      for (const row of (ledgerRows ?? []) as { owner_email: string; delta_credits: number }[]) {
        const key = norm(row.owner_email);
        creditsByOwner.set(key, (creditsByOwner.get(key) ?? 0) + (Number(row.delta_credits) || 0));
      }
    }

    const out = (tenants ?? []).map((t) => {
      const tid = (t as { id: string }).id;
      const name = (t as { name: string | null }).name ?? "";
      const ownerEmails = (ownersByTenant.get(tid) ?? []).sort((a, b) => a.localeCompare(b));
      const primaryOwner = ownerEmails[0] ? norm(ownerEmails[0]) : "";
      const reportCreditsRemaining = primaryOwner ? creditsByOwner.get(primaryOwner) ?? 0 : 0;
      return {
        tenant_id: tid,
        tenant_name: name,
        owner_emails: ownerEmails,
        report_credits_remaining: reportCreditsRemaining,
      };
    });

    const filtered = q
      ? out.filter((x) => {
          const hay = `${norm(x.tenant_name)}\n${x.owner_emails.map(norm).join("\n")}`;
          return hay.includes(q);
        })
      : out;

    return NextResponse.json({ tenants: filtered });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

