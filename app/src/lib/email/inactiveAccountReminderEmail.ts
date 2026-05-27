import { Resend } from "resend";
import { isReportLanguageCode, type ReportLanguageCode } from "@/lib/i18n/reportLanguages";
import {
  appendResendDomainHint,
  logResendAccepted,
  resendTransactionalFields,
  trimResendEnv,
} from "@/lib/email/resendShared";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendInactiveAccountReminderEmail(opts: {
  to: string;
  language: string;
  daysAtZero: number;
  daysRemaining: number;
  billingUrl?: string;
}): Promise<void> {
  const { apiKey, from } = trimResendEnv();
  if (!apiKey || !from) return;

  const lang: ReportLanguageCode = isReportLanguageCode(opts.language) ? opts.language : "en";
  const resend = new Resend(apiKey);
  const subject =
    lang === "es"
      ? "Recordatorio: añada créditos de informes — Report-O-Matic"
      : lang === "fr"
        ? "Rappel : ajoutez des crédits de bulletins — Report-O-Matic"
        : "Reminder: add report credits — Report-O-Matic";

  const body =
    lang === "es"
      ? `Su cuenta lleva ${opts.daysAtZero} días sin créditos de informes. Si sigue en cero, los datos de la escuela se eliminarán en unos ${opts.daysRemaining} días (política de 100 días). Añada un pack de créditos para seguir imprimiendo y conservar sus datos.`
      : lang === "fr"
        ? `Votre compte est à zéro crédit depuis ${opts.daysAtZero} jours. S'il reste à zéro, les données de l'école seront supprimées dans environ ${opts.daysRemaining} jours (politique de 100 jours). Ajoutez un pack de crédits pour continuer à imprimer et conserver vos données.`
        : `Your account has had no report credits for ${opts.daysAtZero} days. If it stays at zero, school data will be removed in about ${opts.daysRemaining} days (100-day policy). Add a credit pack to keep printing and retain your data.`;

  const linkLine = opts.billingUrl ? `\n\n${opts.billingUrl}` : "";
  const text = `${body}${linkLine}\n\nThank you,\nReport-O-Matic`;

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#0b1220;line-height:1.6;">
      <p>${escapeHtml(body)}</p>
      ${opts.billingUrl ? `<p><a href="${escapeHtml(opts.billingUrl)}">${escapeHtml(opts.billingUrl)}</a></p>` : ""}
      <p style="white-space:pre-line;">Thank you,\nReport-O-Matic</p>
    </div>
  `.trim();

  const xf = resendTransactionalFields("inactive-account-reminder");
  const result = await resend.emails.send({
    from,
    to: opts.to,
    subject,
    text,
    html,
    ...(xf ? { replyTo: xf.replyTo, headers: xf.headers, tags: xf.tags } : {}),
  });
  if ("error" in result && result.error) {
    throw new Error(appendResendDomainHint(result.error.message || "Resend rejected inactive reminder."));
  }
  logResendAccepted("[ROM inactive-reminder]", result);
}
