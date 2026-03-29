import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import { getRoleForTenant } from "@/lib/data/memberships";
import {
  downloadTenantLetterheadLogo,
  letterheadLogoObjectPath,
  removeTenantLetterheadLogoObject,
  uploadTenantLetterheadLogo,
} from "@/lib/data/tenantLetterheadLogo";
import { getTenantPdfLetterhead, setTenantLetterheadLogoPath } from "@/lib/data/tenantPdfLetterhead";
import { letterheadLogoAllowedMime } from "@/lib/pdf/letterheadLogoConstraints";
import { processLetterheadLogoUpload } from "@/lib/pdf/letterheadLogoProcess";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(_req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;

  const row = await getTenantPdfLetterhead(tenantId);
  const p = row.pdf_letterhead_logo_path?.trim();
  if (!p) return NextResponse.json({ error: "No logo uploaded." }, { status: 404 });

  const buf = await downloadTenantLetterheadLogo(p);
  if (!buf?.length) return NextResponse.json({ error: "Logo file missing." }, { status: 404 });

  const ext = p.split(".").pop()?.toLowerCase();
  const ct =
    ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "application/octet-stream";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": ct,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function POST(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the account owner can upload a letterhead logo." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = form.get("logo");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file field \"logo\"." }, { status: 400 });
  }

  const mime = (file as Blob).type || "";
  if (!letterheadLogoAllowedMime(mime)) {
    return NextResponse.json(
      { error: "Logo must be PNG, JPEG, or WebP (converted server-side for the PDF)." },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const processed = await processLetterheadLogoUpload(buf);
  if (!processed.ok) {
    return NextResponse.json({ error: processed.error }, { status: 400 });
  }

  const objectPath = letterheadLogoObjectPath(tenantId, processed.ext);
  const previous = await getTenantPdfLetterhead(tenantId);
  if (previous.pdf_letterhead_logo_path && previous.pdf_letterhead_logo_path !== objectPath) {
    await removeTenantLetterheadLogoObject(previous.pdf_letterhead_logo_path);
  }

  try {
    await uploadTenantLetterheadLogo(tenantId, objectPath, processed.buffer, processed.contentType);
    await setTenantLetterheadLogoPath(tenantId, objectPath);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Upload failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, has_logo: true });
}

export async function DELETE(_req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the account owner can remove the letterhead logo." }, { status: 403 });
  }

  const row = await getTenantPdfLetterhead(tenantId);
  const p = row.pdf_letterhead_logo_path?.trim();
  if (p) {
    try {
      await removeTenantLetterheadLogoObject(p);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to remove file.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
  await setTenantLetterheadLogoPath(tenantId, null);
  return NextResponse.json({ ok: true, has_logo: false });
}
