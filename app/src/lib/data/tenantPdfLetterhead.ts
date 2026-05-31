import { getServiceSupabase } from "@/lib/supabase/service";
import type { LetterheadContactLayout } from "@/lib/pdf/letterheadContact";
import { parseLetterheadContactLayout } from "@/lib/pdf/letterheadContact";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export type TenantPdfLetterheadRow = {
  pdf_letterhead_name: string | null;
  pdf_letterhead_tagline: string | null;
  pdf_letterhead_address: string | null;
  pdf_letterhead_contact: string | null;
  pdf_letterhead_contact_layout: LetterheadContactLayout;
  pdf_letterhead_phone: string | null;
  pdf_letterhead_mobile: string | null;
  pdf_letterhead_email: string | null;
  pdf_letterhead_logo_path: string | null;
};

const select =
  "pdf_letterhead_name, pdf_letterhead_tagline, pdf_letterhead_address, pdf_letterhead_contact, pdf_letterhead_contact_layout, pdf_letterhead_phone, pdf_letterhead_mobile, pdf_letterhead_email, pdf_letterhead_logo_path";

function rowFromDb(row: Record<string, unknown> | null): TenantPdfLetterheadRow {
  return {
    pdf_letterhead_name: typeof row?.pdf_letterhead_name === "string" ? row.pdf_letterhead_name : null,
    pdf_letterhead_tagline: typeof row?.pdf_letterhead_tagline === "string" ? row.pdf_letterhead_tagline : null,
    pdf_letterhead_address: typeof row?.pdf_letterhead_address === "string" ? row.pdf_letterhead_address : null,
    pdf_letterhead_contact: typeof row?.pdf_letterhead_contact === "string" ? row.pdf_letterhead_contact : null,
    pdf_letterhead_contact_layout: parseLetterheadContactLayout(
      typeof row?.pdf_letterhead_contact_layout === "string" ? row.pdf_letterhead_contact_layout : null,
    ),
    pdf_letterhead_phone: typeof row?.pdf_letterhead_phone === "string" ? row.pdf_letterhead_phone : null,
    pdf_letterhead_mobile: typeof row?.pdf_letterhead_mobile === "string" ? row.pdf_letterhead_mobile : null,
    pdf_letterhead_email: typeof row?.pdf_letterhead_email === "string" ? row.pdf_letterhead_email : null,
    pdf_letterhead_logo_path: typeof row?.pdf_letterhead_logo_path === "string" ? row.pdf_letterhead_logo_path : null,
  };
}

export async function getTenantPdfLetterhead(tenantId: string): Promise<TenantPdfLetterheadRow> {
  const empty: TenantPdfLetterheadRow = {
    pdf_letterhead_name: null,
    pdf_letterhead_tagline: null,
    pdf_letterhead_address: null,
    pdf_letterhead_contact: null,
    pdf_letterhead_contact_layout: "inline",
    pdf_letterhead_phone: null,
    pdf_letterhead_mobile: null,
    pdf_letterhead_email: null,
    pdf_letterhead_logo_path: null,
  };
  const supabase = getServiceSupabase();
  if (!supabase) return empty;
  const { data, error } = await supabase.from("tenants").select(select).eq("id", tenantId).maybeSingle();
  if (error) throw new Error(formatErr(error));
  return rowFromDb(data as Record<string, unknown> | null);
}

export type TenantPdfLetterheadPatch = {
  pdf_letterhead_name?: string | null;
  pdf_letterhead_tagline?: string | null;
  pdf_letterhead_address?: string | null;
  pdf_letterhead_contact?: string | null;
  pdf_letterhead_contact_layout?: LetterheadContactLayout;
  pdf_letterhead_phone?: string | null;
  pdf_letterhead_mobile?: string | null;
  pdf_letterhead_email?: string | null;
};

function normNullable(s: unknown): string | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

export async function setTenantPdfLetterhead(tenantId: string, patch: TenantPdfLetterheadPatch): Promise<TenantPdfLetterheadRow> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const row: Record<string, unknown> = {};
  if ("pdf_letterhead_name" in patch) row.pdf_letterhead_name = normNullable(patch.pdf_letterhead_name);
  if ("pdf_letterhead_tagline" in patch) row.pdf_letterhead_tagline = normNullable(patch.pdf_letterhead_tagline);
  if ("pdf_letterhead_address" in patch) row.pdf_letterhead_address = normNullable(patch.pdf_letterhead_address);
  if ("pdf_letterhead_contact" in patch) row.pdf_letterhead_contact = normNullable(patch.pdf_letterhead_contact);
  if ("pdf_letterhead_contact_layout" in patch) {
    row.pdf_letterhead_contact_layout = parseLetterheadContactLayout(patch.pdf_letterhead_contact_layout);
  }
  if ("pdf_letterhead_phone" in patch) row.pdf_letterhead_phone = normNullable(patch.pdf_letterhead_phone);
  if ("pdf_letterhead_mobile" in patch) row.pdf_letterhead_mobile = normNullable(patch.pdf_letterhead_mobile);
  if ("pdf_letterhead_email" in patch) row.pdf_letterhead_email = normNullable(patch.pdf_letterhead_email);

  const { data, error } = await supabase.from("tenants").update(row).eq("id", tenantId).select(select).single();
  if (error) throw new Error(formatErr(error));
  return rowFromDb(data as Record<string, unknown>);
}

export async function setTenantLetterheadLogoPath(tenantId: string, path: string | null): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { error } = await supabase
    .from("tenants")
    .update({ pdf_letterhead_logo_path: path })
    .eq("id", tenantId);
  if (error) throw new Error(formatErr(error));
}

/** API / dashboard letterhead contact shape. */
export function letterheadContactFromRow(row: TenantPdfLetterheadRow) {
  return {
    contact_layout: row.pdf_letterhead_contact_layout,
    phone: row.pdf_letterhead_phone,
    mobile: row.pdf_letterhead_mobile,
    email: row.pdf_letterhead_email,
  };
}
