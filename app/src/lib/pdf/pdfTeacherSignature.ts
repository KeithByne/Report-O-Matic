import { isReportLanguageCode, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";

const LABELS: Record<ReportLanguageCode, string> = {
  en: "Teacher signature",
  fr: "Signature de l'enseignant",
  es: "Firma del profesor o de la profesora",
  de: "Unterschrift der Lehrkraft",
  it: "Firma dell’insegnante",
  pt: "Assinatura do professor ou da professora",
};

export function pdfTeacherSignatureLabel(code: string): string {
  const c = isReportLanguageCode(code) ? code : "en";
  return LABELS[c];
}
