import { getServiceSupabase } from "@/lib/supabase/service";

export const TENANT_LETTERHEAD_LOGOS_BUCKET = "tenant-letterhead-logos";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Storage error.";
}

export function letterheadLogoObjectPath(tenantId: string, ext: "png" | "jpg"): string {
  return `${tenantId}/logo.${ext}`;
}

export async function downloadTenantLetterheadLogo(path: string | null | undefined): Promise<Buffer | null> {
  const p = path?.trim();
  if (!p) return null;
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(TENANT_LETTERHEAD_LOGOS_BUCKET).download(p);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function uploadTenantLetterheadLogo(
  tenantId: string,
  objectPath: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { error } = await supabase.storage.from(TENANT_LETTERHEAD_LOGOS_BUCKET).upload(objectPath, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(formatErr(error));
}

export async function removeTenantLetterheadLogoObject(path: string | null | undefined): Promise<void> {
  const p = path?.trim();
  if (!p) return;
  const supabase = getServiceSupabase();
  if (!supabase) return;
  const { error } = await supabase.storage.from(TENANT_LETTERHEAD_LOGOS_BUCKET).remove([p]);
  if (error) throw new Error(formatErr(error));
}
