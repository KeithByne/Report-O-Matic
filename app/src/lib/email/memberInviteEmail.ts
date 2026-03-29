import { Resend } from "resend";

function getFromEmail(): string | null {
  const v = process.env.ROM_FROM_EMAIL;
  if (!v) return null;
  return v.trim();
}

export type MemberInviteEmailResult =
  | { sent: true }
  | { sent: false; error: string };

/**
 * Not the OTP — tells the invitee which email to use on Sign in.
 * Returns whether Resend accepted the send; never throws (caller always gets a result).
 */
export async function sendMemberAddedEmail(opts: {
  to: string;
  schoolName: string;
  roleLabel: string;
  signInUrl: string;
}): Promise<MemberInviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromEmail();
  if (!apiKey?.trim()) {
    return {
      sent: false,
      error:
        "Invite email was not sent: RESEND_API_KEY is missing in the server environment (check Vercel → Environment Variables).",
    };
  }
  if (!from) {
    return {
      sent: false,
      error:
        "Invite email was not sent: ROM_FROM_EMAIL is missing (set it in Vercel to a verified sender, e.g. no-reply@report-o-matic.online).",
    };
  }

  const resend = new Resend(apiKey);
  const subject = `You're invited to ${opts.schoolName} — Report-O-Matic`;
  const text = [
    `You've been added to “${opts.schoolName}” as ${opts.roleLabel}.`,
    ``,
    `Important: when you sign in, use this exact email address:`,
    opts.to,
    ``,
    `Open the app and choose Sign in (not someone else’s saved email in the browser):`,
    opts.signInUrl,
    ``,
    `You’ll then get a one-time security code sent to the address above.`,
  ].join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#0b1220; line-height:1.6;">
      <p>You've been added to <strong>${escapeHtml(opts.schoolName)}</strong> as <strong>${escapeHtml(opts.roleLabel)}</strong>.</p>
      <p><strong>Use this exact email when you sign in:</strong><br/>
      <span style="font-family:ui-monospace,monospace;">${escapeHtml(opts.to)}</span></p>
      <p>Open the sign-in page (avoid a shared browser’s autofill for someone else’s address):<br/>
      <a href="${escapeAttr(opts.signInUrl)}">${escapeHtml(opts.signInUrl)}</a></p>
      <p style="font-size:13px;color:#64748b;">Choose <strong>Sign in</strong>, enter the email above, then enter the one-time code from your email.</p>
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
    const msg = result.error.message || "Resend rejected the send.";
    console.error("[ROM] sendMemberAddedEmail Resend error:", msg);
    return {
      sent: false,
      error: `Invite email failed (${msg}). Check Resend → Logs and that your domain/sender is verified.`,
    };
  }

  return { sent: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
