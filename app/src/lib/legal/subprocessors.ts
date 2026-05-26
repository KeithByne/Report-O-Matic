/** Subprocessors and infrastructure providers referenced in legal pages. */
export type SubprocessorRow = {
  name: string;
  purpose: string;
  dataCategories: string;
  locationNote: string;
};

export const LEGAL_SUBPROCESSORS: SubprocessorRow[] = [
  {
    name: "Supabase",
    purpose: "Database, authentication storage, and application hosting infrastructure",
    dataCategories: "Account, school workflow, and report data stored in the service",
    locationNote: "Region depends on project configuration; may involve transfers outside the UK/EEA with appropriate safeguards",
  },
  {
    name: "Resend",
    purpose: "Transactional email (invites, security codes, account notices)",
    dataCategories: "Email addresses and message content for operational emails",
    locationNote: "See Resend privacy/DPA documentation for locations and transfer mechanisms",
  },
  {
    name: "OpenAI",
    purpose: "Optional AI-assisted report comment drafting when enabled",
    dataCategories:
      "Pupil first name (not surname), numeric rubric scores, subject context, and prompt instructions — as described in the privacy notice",
    locationNote: "May process in the United States or other regions; API terms apply",
  },
  {
    name: "Cloudflare",
    purpose: "Edge security and Turnstile human verification on the sign-in page",
    dataCategories: "IP address, device signals, and challenge metadata",
    locationNote: "Global network; see Cloudflare privacy policy",
  },
  {
    name: "Stripe",
    purpose: "Card payment processing for report credit packs when checkout is enabled",
    dataCategories: "Billing contact, payment method tokens, and transaction metadata",
    locationNote: "Stripe entity and transfer mechanisms depend on account configuration",
  },
  {
    name: "Wise",
    purpose: "Business payment and settlement operations related to commercial receipts",
    dataCategories: "Business payer/payee identifiers and payment records where applicable",
    locationNote: "Used for banking operations; not used to host pupil report content",
  },
];
