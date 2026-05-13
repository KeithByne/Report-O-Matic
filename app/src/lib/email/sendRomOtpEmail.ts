import { Resend } from "resend";
import { CODE_DELIVERY_NOTE_TEXT_LINE } from "@/lib/email/codeDeliveryNote";
import {
  appendResendDomainHint,
  logResendAccepted,
  resendMisconfigurationPayload,
  resendTransactionalFields,
  trimResendEnv,
} from "@/lib/email/resendShared";

export type RomOtpEmailKind = "primary" | "backup_copy" | "backup_resend";

/**
 * Sends the sign-in / sign-up OTP via Resend.
 * `backup_copy` is an extra copy to another inbox the user controls.
 * `backup_resend` is used when the user rotates the code and receives it only on the backup address.
 */
export async function sendRomOtpEmail(opts: {
  to: string;
  code: string;
  mode: "signin" | "signup";
  expiresInSeconds: number;
  kind?: RomOtpEmailKind;
  /** Account email when kind is backup_copy or backup_resend */
  accountEmail?: string;
}) {
  const { apiKey, from } = trimResendEnv();
  if (!apiKey) throw new Error("Missing RESEND_API_KEY.");
  if (!from) throw new Error(resendMisconfigurationPayload().error);

  const resend = new Resend(apiKey);
  const actionLabel = opts.mode === "signup" ? "create your account" : "sign in";
  const kind = opts.kind ?? "primary";
  const subject =
    kind === "backup_resend"
      ? "[Report-O-Matic] Verification code (backup inbox)"
      : "[Report-O-Matic] Your verification code";

  const accountLine =
    kind !== "primary" && opts.accountEmail
      ? [`This code is for the Report-O-Matic account: ${opts.accountEmail}.`, ``]
      : [];

  const text = [
    `Report-O-Matic verification`,
    ...accountLine,
    `Your sign-in code: ${opts.code}`,
    `This code expires in ${opts.expiresInSeconds} seconds.`,
    ``,
    `Use this code to ${actionLabel}.`,
    `If you did not request this code, you can ignore this message.`,
    ``,
    CODE_DELIVERY_NOTE_TEXT_LINE,
  ].join("\n");

  const mailKind =
    kind === "backup_resend" ? "otp-backup-resend" : kind === "backup_copy" ? "otp-backup-copy" : "otp";
  const xf = resendTransactionalFields(mailKind);

  // Plain text only: many strict MX (same-domain inboxes, cPanel, etc.) score styled HTML OTP mail worse.
  const result = await resend.emails.send({
    from,
    to: opts.to,
    subject,
    text,
    ...(xf ? { replyTo: xf.replyTo, headers: xf.headers, tags: xf.tags } : {}),
  });

  if ("error" in result && result.error) {
    const raw = result.error.message || "unknown error";
    throw new Error(`Email send failed: ${appendResendDomainHint(raw)}`);
  }
  logResendAccepted("[ROM sendRomOtpEmail]", result);
}
