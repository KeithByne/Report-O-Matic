import { Resend } from "resend";
import { CODE_DELIVERY_NOTE_TEXT_LINE, codeDeliveryNoteHtml } from "@/lib/email/codeDeliveryNote";
import {
  appendResendDomainHint,
  logResendAccepted,
  resendMisconfigurationPayload,
  resendTransactionalFields,
  trimResendEnv,
} from "@/lib/email/resendShared";

export async function sendSigninVerificationEmail(opts: { to: string; code: string; expiresInSeconds: number }) {
  const { apiKey, from } = trimResendEnv();
  if (!apiKey) throw new Error("Missing RESEND_API_KEY.");
  if (!from) throw new Error(resendMisconfigurationPayload().error);

  const resend = new Resend(apiKey);
  const subject = "[Report-O-Matic] Your sign-in verification code";

  const text = [
    `Report-O-Matic sign-in verification`,
    ``,
    `Your security code: ${opts.code}`,
    `This code expires in ${opts.expiresInSeconds} seconds.`,
    ``,
    `Enter it on the Report-O-Matic verify page to finish signing in.`,
    `If you did not try to sign in, you can ignore this email.`,
    ``,
    CODE_DELIVERY_NOTE_TEXT_LINE,
  ].join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#0b1220;">
      <h2 style="margin:0 0 12px;">Finish signing in</h2>
      <p style="margin:0 0 14px; font-size:14px; line-height:1.6;">
        Your 6-digit security code is:
      </p>
      <div style="display:inline-block; padding:12px 14px; border:1px solid #e5e7eb; border-radius:12px; background:#f9fafb; font-size:22px; letter-spacing:4px; font-weight:700;">
        ${escapeHtml(opts.code)}
      </div>
      <p style="margin:14px 0 0; font-size:13px; color:#334155; line-height:1.6;">
        Expires in ${opts.expiresInSeconds} seconds.
      </p>
      ${codeDeliveryNoteHtml()}
      <p style="margin:10px 0 0; font-size:12px; color:#64748b; line-height:1.6;">
        If you didn’t try to sign in, you can ignore this message.
      </p>
    </div>
  `.trim();

  const xf = resendTransactionalFields("signin-email-otp");

  const result = await resend.emails.send({
    from,
    to: opts.to,
    subject,
    text,
    html,
    ...(xf ? { replyTo: xf.replyTo, headers: xf.headers, tags: xf.tags } : {}),
  });

  if ("error" in result && result.error) {
    const raw = result.error.message || "unknown error";
    throw new Error(`Email send failed: ${appendResendDomainHint(raw)}`);
  }
  logResendAccepted("[ROM sendSigninVerificationEmail]", result);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
