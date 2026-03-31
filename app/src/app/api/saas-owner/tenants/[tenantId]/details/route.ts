import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(_req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const { tenantId } = await ctx.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid tenant id." }, { status: 400 });

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  try {
    const [{ data: tenant, error: tErr }, { data: memberships, error: mErr }] = await Promise.all([
      supabase.from("tenants").select("id, name, referral_code, referred_by_email, created_at").eq("id", tenantId).maybeSingle(),
      supabase
        .from("memberships")
        .select("user_email, role")
        .eq("tenant_id", tenantId)
        .order("role", { ascending: true })
        .order("user_email", { ascending: true }),
    ]);
    if (tErr) throw new Error(tErr.message);
    if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    if (mErr) throw new Error(mErr.message);

    const [
      { count: classCount, error: cCountErr },
      { count: studentCount, error: sCountErr },
      { count: reportCount, error: rCountErr },
      { data: classes, error: cErr },
      { data: students, error: sErr },
      { data: reports, error: rErr },
    ] = await Promise.all([
      supabase.from("classes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase
        .from("classes")
        .select("id, name, assigned_teacher_email, scholastic_year, cefr_level, created_at")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true })
        .limit(500),
      supabase
        .from("students")
        .select("id, display_name, class_id, created_at")
        .eq("tenant_id", tenantId)
        .order("display_name", { ascending: true })
        .limit(200),
      supabase
        .from("reports")
        .select("id, student_id, author_email, status, title, updated_at, created_at")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);
    if (cCountErr) throw new Error(cCountErr.message);
    if (sCountErr) throw new Error(sCountErr.message);
    if (rCountErr) throw new Error(rCountErr.message);
    if (cErr) throw new Error(cErr.message);
    if (sErr) throw new Error(sErr.message);
    if (rErr) throw new Error(rErr.message);

    return NextResponse.json({
      tenant,
      memberships: memberships ?? [],
      counts: {
        classes: classCount ?? 0,
        students: studentCount ?? 0,
        reports: reportCount ?? 0,
      },
      classes: classes ?? [],
      students: students ?? [],
      reports: reports ?? [],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

