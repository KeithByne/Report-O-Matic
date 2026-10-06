import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { listClasses, type ClassRow } from "@/lib/data/classesDb";
import { getRoleForTenant } from "@/lib/data/memberships";
import { isUiLang } from "@/lib/i18n/uiStrings";
import { pdfExportResponse } from "@/lib/credits/exportPdf";
import { mergeRegisterPdfsForClassRows } from "@/lib/pdf/mergeRegistersForClasses";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "registers";
}

/** Accept `class_ids=a,b` and/or repeated `class_ids=a&class_ids=b`. */
function parseRequestedClassIds(url: URL): string[] {
  const raw: string[] = [];
  for (const v of url.searchParams.getAll("class_ids")) {
    for (const part of v.split(",")) {
      const id = part.trim();
      if (id) raw.push(id);
    }
  }
  const single = url.searchParams.get("class_id")?.trim();
  if (single) raw.push(single);
  return [...new Set(raw.filter(isUuid))];
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
  const requestedIds = parseRequestedClassIds(url);

  const allClasses = await listClasses(tenantId);
  if (allClasses.length === 0) {
    return NextResponse.json({ error: "No classes in this school." }, { status: 404 });
  }

  let classes: ClassRow[] = allClasses;
  if (requestedIds.length > 0) {
    const byId = new Map(allClasses.map((c) => [c.id, c]));
    classes = [];
    for (const id of requestedIds) {
      const row = byId.get(id);
      if (!row) {
        return NextResponse.json({ error: "One or more selected classes were not found." }, { status: 404 });
      }
      classes.push(row);
    }
  }

  try {
    const { pdf, tenantRecordName } = await mergeRegisterPdfsForClassRows(tenantId, classes, uiLang);
    const fname =
      requestedIds.length > 0
        ? `${safeFilename(tenantRecordName)}-selected-registers.pdf`
        : `${safeFilename(tenantRecordName)}-all-registers.pdf`;
    return pdfExportResponse(tenantId, pdf, { inline, filename: fname });
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message === "NO_PRINTABLE_REGISTERS" ? null : e instanceof Error ? e.message : null;
    if (msg === null) {
      return NextResponse.json(
        { error: "No printable registers — add at least one pupil to a selected class." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg || "Failed to build PDF." }, { status: 500 });
  }
}
