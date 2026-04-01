import { isReportLanguageCode, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";

const LABELS: Record<ReportLanguageCode, string> = {
  en: "Teacher signature",
  es: "Firma del profesor o de la profesora",
  fr: "Signature de l'enseignant",
  it: "Firma dell’insegnante",
  de: "Unterschrift der Lehrkraft",
  pt: "Assinatura do professor ou da professora",
  nl: "Handtekening docent",
  pl: "Podpis nauczyciela",
  ro: "Semnătura profesorului",
  ru: "Подпись преподавателя",
  uk: "Підпис викладача",
  ar: "توقيع المعلم",
};

export function pdfTeacherSignatureLabel(code: string): string {
  const c = isReportLanguageCode(code) ? code : "en";
  return LABELS[c];
}
