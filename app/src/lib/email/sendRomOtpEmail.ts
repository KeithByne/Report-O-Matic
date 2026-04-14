import { Resend } from "resend";
import { CODE_DELIVERY_NOTE_TEXT_LINE, codeDeliveryNoteHtml } from "@/lib/email/codeDeliveryNote";

function getFromEmail(): string | null {
  const v = process.env.ROM_FROM_EMAIL;
  if (!v) return null;
  return v.trim();
}

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
  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromEmail();
  if (!apiKey) throw new Error("Missing RESEND_API_KEY.");
  if (!from) throw new Error("Missing ROM_FROM_EMAIL.");

  const resend = new Resend(apiKey);
  const actionLabel = opts.mode === "signup" ? "create your account" : "sign in";
  const kind = opts.kind ?? "primary";
  const subject =
    kind === "backup_resend"
      ? "Report-O-Matic sign-in code (backup delivery)"
      : "Report-O-Matic sign-in code";

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

  const accountHtml =
    kind !== "primary" && opts.accountEmail
      ? `<p style="margin:0 0 12px; font-size:13px; color:#334155; line-height:1.6;">
           This code is for the Report-O-Matic account <strong>${opts.accountEmail}</strong>.
         </p>`
      : "";

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#0b1220;">
      <h2 style="margin:0 0 12px;">Report-O-Matic security code</h2>
      ${accountHtml}
      <p style="margin:0 0 14px; font-size:14px; line-height:1.6;">
        Your security code is:
      </p>
      <div style="display:inline-block; padding:12px 14px; border:1px solid #e5e7eb; border-radius:12px; background:#f9fafb; font-size:22px; letter-spacing:4px; font-weight:700;">
        ${opts.code}
      </div>
      <p style="margin:14px 0 0; font-size:13px; color:#334155; line-height:1.6;">
        Expires in ${opts.expiresInSeconds} seconds.
      </p>
      ${codeDeliveryNoteHtml()}
      <p style="margin:10px 0 0; font-size:12px; color:#64748b; line-height:1.6;">
        If you didn’t request this, you can ignore this email.
      </p>
    </div>
  `.trim();

  const result = await resend.emails.send({
    from,
    to: opts.to,
    subject,
    text,
    html,
  });

  if ("error" in result && result.error) {
    throw new Error(`Email send failed: ${result.error.message || "unknown error"}`);
  }
}
