import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { listClasses } from "@/lib/data/classesDb";
import { getRoleForTenant } from "@/lib/data/memberships";
import { isUiLang } from "@/lib/i18n/uiStrings";
import { mergeRegisterPdfsForClassRows } from "@/lib/pdf/mergeRegistersForClasses";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "registers";
}

export async function GET(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });

  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (role !== "owner" && role !== "department_head") {
    return NextResponse.json({ error: "Only owners and department heads can download all school registers." }, { status: 403 });
  }

  const url = new URL(req.url);
  const langParam = (url.searchParams.get("lang") || "en").trim();
  const uiLang = isUiLang(langParam) ? langParam : "en";
  const inline = url.searchParams.get("inline") === "1";

  const classes = await listClasses(tenantId);
  if (classes.length === 0) {
    return NextResponse.json({ error: "No classes in this school." }, { status: 404 });
  }

  try {
    const { pdf, tenantRecordName } = await mergeRegisterPdfsForClassRows(tenantId, classes, uiLang);
    const fname = `${safeFilename(tenantRecordName)}-all-registers.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fname}"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message === "NO_PRINTABLE_REGISTERS" ? null : e instanceof Error ? e.message : null;
    if (msg === null) {
      return NextResponse.json(
        { error: "No printable registers — add at least one pupil to a class." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg || "Failed to build PDF." }, { status: 500 });
  }
}
