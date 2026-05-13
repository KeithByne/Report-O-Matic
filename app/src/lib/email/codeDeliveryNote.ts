/**
 * Shown in OTP-related emails so users know delays / spam folders are normal
 * (matches messaging on landing and /reset).
 */

export const CODE_DELIVERY_NOTE_TEXT_LINE =
  "This email can take up to a minute to arrive. If you don’t see it, check your spam or junk folder. Some work or school systems hold automated mail in quarantine—ask your IT admin if nothing appears.";

/** Paragraph for HTML transactional emails (Resend). */
export function codeDeliveryNoteHtml(): string {
  return `<p style="margin:14px 0 0; font-size:12px; color:#64748b; line-height:1.6;">This email can take up to a minute to arrive. If you don’t see it, check your <strong>spam</strong> or <strong>junk</strong> folder. Some work or school systems hold automated mail in <strong>quarantine</strong>—ask your IT admin if nothing appears.</p>`;
}
