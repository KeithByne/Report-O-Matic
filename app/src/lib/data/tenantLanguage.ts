import { getServiceSupabase } from "@/lib/supabase/service";
import type { ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import { isReportLanguageCode } from "@/lib/i18n/reportLanguages";

function formatErr(e: { message: string; details?: string | null; hint?: string | null }): string {
  const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x && String(x).trim()));
  return parts.join(" — ") || "Database error.";
}

export async function getTenantDefaultReportLanguage(tenantId: string): Promise<ReportLanguageCode> {
  const supabase = getServiceSupabase();
  if (!supabase) return "en";
  const { data, error } = await supabase
    .from("tenants")
    .select("default_report_language")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(formatErr(error));
  const code = (data as { default_report_language?: string } | null)?.default_report_language;
  return code && isReportLanguageCode(code) ? code : "en";
}

export async function setTenantDefaultReportLanguage(
  tenantId: string,
  lang: ReportLanguageCode,
): Promise<ReportLanguageCode> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Database not configured.");
  const { data, error } = await supabase
    .from("tenants")
    .update({ default_report_language: lang })
    .eq("id", tenantId)
    .select("default_report_language")
    .single();
  if (error) throw new Error(formatErr(error));
  const code = (data as { default_report_language: string }).default_report_language;
  return isReportLanguageCode(code) ? code : lang;
}
