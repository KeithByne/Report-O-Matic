import { NextResponse } from "next/server";
import { requireTenantMember } from "@/lib/auth/tenantApi";
import {
  getTenantDefaultReportLanguage,
  setTenantDefaultReportLanguage,
} from "@/lib/data/tenantLanguage";
import {
  getTenantPdfLetterhead,
  setTenantPdfLetterhead,
  type TenantPdfLetterheadPatch,
} from "@/lib/data/tenantPdfLetterhead";
import { getRoleForTenant } from "@/lib/data/memberships";
import { isReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { getServiceSupabase } from "@/lib/supabase/service";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

const MAX_SHORT = 500;
const MAX_ADDRESS = 2000;

function clampField(s: unknown, max: number): string | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

export async function GET(_req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  try {
    const supabase = getServiceSupabase();
    if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

    const { data, error } = await supabase
      .from("tenants")
      .select(
        "default_report_language, pdf_letterhead_name, pdf_letterhead_tagline, pdf_letterhead_address, pdf_letterhead_contact, pdf_letterhead_logo_path",
      )
      .eq("id", tenantId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const row = data as Record<string, unknown> | null;
    if (!row) return NextResponse.json({ error: "Organisation not found." }, { status: 404 });

    const rawLang = row.default_report_language;
    const default_report_language =
      typeof rawLang === "string" && isReportLanguageCode(rawLang.trim()) ? rawLang.trim() : "en";
    const logoPath = typeof row.pdf_letterhead_logo_path === "string" ? row.pdf_letterhead_logo_path.trim() : "";
    const lh = {
      name: typeof row.pdf_letterhead_name === "string" ? row.pdf_letterhead_name : null,
      tagline: typeof row.pdf_letterhead_tagline === "string" ? row.pdf_letterhead_tagline : null,
      address: typeof row.pdf_letterhead_address === "string" ? row.pdf_letterhead_address : null,
      contact: typeof row.pdf_letterhead_contact === "string" ? row.pdf_letterhead_contact : null,
      has_logo: logoPath.length > 0,
    };

    return NextResponse.json({
      default_report_language,
      pdf_letterhead: lh,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load settings.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  if (!isUuid(tenantId)) return NextResponse.json({ error: "Invalid organisation id." }, { status: 400 });
  const gate = await requireTenantMember(tenantId);
  if (!gate.ok) return gate.res;
  const role = await getRoleForTenant(gate.email, tenantId);
  if (!role) return NextResponse.json({ error: "No access." }, { status: 403 });

  let body: {
    default_report_language?: unknown;
    pdf_letterhead?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const hasLang = typeof body.default_report_language === "string" && body.default_report_language.trim().length > 0;
  const hasLh = body.pdf_letterhead !== undefined && body.pdf_letterhead !== null;

  if (!hasLang && !hasLh) {
    return NextResponse.json({ error: "No recognised fields to update." }, { status: 400 });
  }

  if (hasLang && role !== "owner" && role !== "department_head") {
    return NextResponse.json({ error: "Only owners and department heads can change the default language." }, { status: 403 });
  }

  if (hasLh && role !== "owner") {
    return NextResponse.json({ error: "Only the account owner can edit PDF letterhead." }, { status: 403 });
  }

  try {
    let default_report_language: Awaited<ReturnType<typeof getTenantDefaultReportLanguage>> = "en";
    if (hasLang) {
      const raw = String(body.default_report_language).trim();
      if (!isReportLanguageCode(raw)) {
        return NextResponse.json(
          { error: "default_report_language must be a supported code (en, fr, es, de, it, pt)." },
          { status: 400 },
        );
      }
      default_report_language = await setTenantDefaultReportLanguage(tenantId, raw);
    } else {
      default_report_language = await getTenantDefaultReportLanguage(tenantId);
    }

    let pdf_letterhead = await getTenantPdfLetterhead(tenantId);
    if (hasLh) {
      const o = body.pdf_letterhead;
      if (typeof o !== "object" || o === null || Array.isArray(o)) {
        return NextResponse.json({ error: "pdf_letterhead must be an object." }, { status: 400 });
      }
      const raw = o as Record<string, unknown>;
      const patch: TenantPdfLetterheadPatch = {
        pdf_letterhead_name: clampField(raw.name, MAX_SHORT),
        pdf_letterhead_tagline: clampField(raw.tagline, MAX_SHORT),
        pdf_letterhead_address: clampField(raw.address, MAX_ADDRESS),
        pdf_letterhead_contact: clampField(raw.contact, MAX_SHORT),
      };
      pdf_letterhead = await setTenantPdfLetterhead(tenantId, patch);
    }

    return NextResponse.json({
      default_report_language,
      pdf_letterhead: {
        name: pdf_letterhead.pdf_letterhead_name,
        tagline: pdf_letterhead.pdf_letterhead_tagline,
        address: pdf_letterhead.pdf_letterhead_address,
        contact: pdf_letterhead.pdf_letterhead_contact,
        has_logo: Boolean(pdf_letterhead.pdf_letterhead_logo_path?.trim()),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save settings.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
