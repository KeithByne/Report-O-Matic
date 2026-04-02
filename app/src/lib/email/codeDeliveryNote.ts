/**
 * Shown in OTP-related emails so users know delays / spam folders are normal
 * (matches messaging on landing, /verify, and /reset).
 */

export const CODE_DELIVERY_NOTE_TEXT_LINE =
  "This email can take up to a minute to arrive. If you don’t see it, check your spam or junk folder.";

/** Paragraph for HTML transactional emails (Resend). */
export function codeDeliveryNoteHtml(): string {
  return `<p style="margin:14px 0 0; font-size:12px; color:#64748b; line-height:1.6;">This email can take up to a minute to arrive. If you don’t see it, check your <strong>spam</strong> or <strong>junk</strong> folder.</p>`;
}
