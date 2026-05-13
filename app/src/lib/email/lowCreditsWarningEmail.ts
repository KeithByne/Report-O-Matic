import { Resend } from "resend";
import { isReportLanguageCode, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import {
  appendResendDomainHint,
  logResendAccepted,
  resendTransactionalFields,
  trimResendEnv,
} from "@/lib/email/resendShared";

type Copy = {
  subject: string;
  heading: string;
  greeting: string;
  body: string;
  action: string;
  closing: string;
};

const LOW_CREDIT_COPY: Partial<Record<ReportLanguageCode, Copy>> = {
  en: {
    subject: "Low credits warning — Report-O-Matic",
    heading: "Low credits warning",
    greeting: "Hello,",
    body: "Your school account has 50 report credits remaining.",
    action: "Please add more credits soon to avoid running out while staff are writing reports.",
    closing: "Thank you,\nReport-O-Matic",
  },
  fr: {
    subject: "Alerte crédits faibles — Report-O-Matic",
    heading: "Alerte crédits faibles",
    greeting: "Bonjour,",
    body: "Le compte de votre école dispose de 50 crédits de bulletin restants.",
    action: "Veuillez ajouter des crédits prochainement pour éviter toute interruption pendant la rédaction des bulletins.",
    closing: "Merci,\nReport-O-Matic",
  },
  es: {
    subject: "Aviso de créditos bajos — Report-O-Matic",
    heading: "Aviso de créditos bajos",
    greeting: "Hola,",
    body: "La cuenta de su centro tiene 50 créditos de informes restantes.",
    action: "Añada más créditos pronto para evitar quedarse sin ellos mientras el equipo prepara informes.",
    closing: "Gracias,\nReport-O-Matic",
  },
  de: {
    subject: "Warnung: Wenige Credits — Report-O-Matic",
    heading: "Warnung bei niedrigem Guthaben",
    greeting: "Hallo,",
    body: "Ihr Schulkonto hat noch 50 Bericht-Credits.",
    action: "Bitte laden Sie bald weitere Credits auf, damit das Team nicht ohne Guthaben weiterarbeiten muss.",
    closing: "Vielen Dank,\nReport-O-Matic",
  },
  it: {
    subject: "Avviso crediti in esaurimento — Report-O-Matic",
    heading: "Avviso crediti in esaurimento",
    greeting: "Buongiorno,",
    body: "L'account della tua scuola ha 50 crediti report rimanenti.",
    action: "Ti consigliamo di aggiungere presto altri crediti per evitare interruzioni durante la stesura dei report.",
    closing: "Grazie,\nReport-O-Matic",
  },
  pt: {
    subject: "Aviso de créditos baixos — Report-O-Matic",
    heading: "Aviso de créditos baixos",
    greeting: "Olá,",
    body: "A conta da sua escola tem 50 créditos de relatórios restantes.",
    action: "Adicione mais créditos em breve para evitar ficar sem saldo durante a preparação dos relatórios.",
    closing: "Obrigado,\nReport-O-Matic",
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendLowCreditsWarningEmail(opts: {
  to: string;
  schoolName: string;
  language: string;
  remainingCredits: number;
  billingUrl?: string;
}): Promise<void> {
  const { apiKey, from } = trimResendEnv();
  if (!apiKey || !from) return;

  const resend = new Resend(apiKey);
  const lang: ReportLanguageCode = isReportLanguageCode(opts.language) ? opts.language : "en";
  const english = LOW_CREDIT_COPY.en as Copy;
  const localized = LOW_CREDIT_COPY[lang] ?? english;
  const subject = localized.subject;
  const school = opts.schoolName || "your school";
  const remaining = Math.trunc(Number(opts.remainingCredits) || 0);
  const linkLine = opts.billingUrl ? `\n${opts.billingUrl}` : "";

  const localizedText = [
    localized.greeting,
    "",
    `${localized.body} (${remaining})`,
    localized.action,
    linkLine ? `\n${linkLine}` : "",
    "",
    localized.closing,
  ]
    .join("\n")
    .trim();
  const englishText = [
    english.greeting,
    "",
    `Your school account has ${remaining} report credits remaining.`,
    "Please add more credits soon to avoid running out while staff are writing reports.",
    linkLine ? `\n${linkLine}` : "",
    "",
    english.closing,
  ]
    .join("\n")
    .trim();

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#0b1220;line-height:1.6;">
      <p><strong>${escapeHtml(localized.heading)}</strong> — ${escapeHtml(school)}</p>
      <p>${escapeHtml(localized.greeting)}</p>
      <p>${escapeHtml(localized.body)} <strong>${remaining}</strong>.</p>
      <p>${escapeHtml(localized.action)}</p>
      ${opts.billingUrl ? `<p><a href="${escapeHtml(opts.billingUrl)}">${escapeHtml(opts.billingUrl)}</a></p>` : ""}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
      <p><strong>English</strong></p>
      <p>${escapeHtml(english.greeting)}</p>
      <p>Your school account has <strong>${remaining}</strong> report credits remaining.</p>
      <p>Please add more credits soon to avoid running out while staff are writing reports.</p>
      ${opts.billingUrl ? `<p><a href="${escapeHtml(opts.billingUrl)}">${escapeHtml(opts.billingUrl)}</a></p>` : ""}
      <p style="white-space:pre-line;">${escapeHtml(english.closing)}</p>
    </div>
  `.trim();

  const text = `${localizedText}\n\n---\nEnglish\n\n${englishText}`;

  const xf = resendTransactionalFields("low-credits");
  const result = await resend.emails.send({
    from,
    to: opts.to,
    subject,
    text,
    html,
    ...(xf ? { replyTo: xf.replyTo, headers: xf.headers, tags: xf.tags } : {}),
  });
  if ("error" in result && result.error) {
    throw new Error(appendResendDomainHint(result.error.message || "Resend rejected low-credit warning."));
  }
  logResendAccepted("[ROM low-credits]", result);
}
