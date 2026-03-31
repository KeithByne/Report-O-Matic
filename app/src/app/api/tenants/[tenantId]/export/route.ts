import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getRoleForTenant, getTenantName, listMembersForTenant } from "@/lib/data/memberships";
import { listClasses } from "@/lib/data/classesDb";
import { listStudents } from "@/lib/data/students";
import { listReportsForTenant } from "@/lib/data/reportsDb";
import { getServiceSupabase } from "@/lib/supabase/service";
import { buildTenantExportWorkbook } from "@/lib/export/tenantExcelExport";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function safeFileToken(s: string): string {
  return (s || "")
    .trim()
    .replace(/[^\w\s-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64)
    .replace(/\s/g, "_")
    .toLowerCase();
}

export async function GET(_req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;

  const role = await getRoleForTenant(gate.email, tenantId);
  if (role !== "owner") {
    return NextResponse.json({ error: "Only organisation owners can export full school data." }, { status: 403 });
  }

  try {
    const [tenantName, members, classes, students, reports] = await Promise.all([
      getTenantName(tenantId),
      listMembersForTenant(tenantId),
      listClasses(tenantId),
      listStudents(tenantId),
      listReportsForTenant(tenantId),
    ]);

    // Archives: include metadata + payload JSON (can be large).
    const supabase = getServiceSupabase();
    const { data: archiveRows, error: aErr } = supabase
      ? await supabase
          .from("class_scholastic_archives")
          .select("id, tenant_id, class_id, scholastic_year_label, archived_at, payload")
          .eq("tenant_id", tenantId)
          .order("archived_at", { ascending: false })
      : { data: [], error: null };
    if (aErr) throw new Error(aErr.message);

    const archives = (archiveRows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      class_id: r.class_id as string,
      scholastic_year_label: r.scholastic_year_label as string,
      archived_at: r.archived_at as string,
      payload_json: (() => {
        try {
          return JSON.stringify(r.payload ?? null);
        } catch {
          return "";
        }
      })(),
    }));

    const buf = buildTenantExportWorkbook({
      tenant: { id: tenantId, name: tenantName },
      members,
      classes,
      students,
      reports,
      archives,
    });

    const today = new Date().toISOString().slice(0, 10);
    const nameToken = safeFileToken(tenantName ?? "school");
    const filename = `report-o-matic_${nameToken || "school"}_${today}.xlsx`;

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to export data.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

