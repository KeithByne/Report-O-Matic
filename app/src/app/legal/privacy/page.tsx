import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageNav";
import {
  operatorCompanyNumber,
  operatorLegalName,
  operatorRegisteredAddress,
  privacyContactEmail,
} from "@/lib/legal/operatorIdentity";
import { isCardPaymentsEnabled } from "@/lib/payments/enabled";

export const metadata: Metadata = {
  title: "Privacy notice — Report-O-Matic",
  description: "How Report-O-Matic Ltd processes personal data (GDPR-oriented summary).",
};

export default function PrivacyPage() {
  const operatorName = operatorLegalName();
  const companyNo = operatorCompanyNumber();
  const registered = operatorRegisteredAddress();
  const contact = privacyContactEmail();
  const cardPaymentsOn = isCardPaymentsEnabled();

  return (
    <LegalPageShell current="/legal/privacy">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Privacy notice</h1>
      <p className="mt-2 text-sm text-zinc-600">
        This page summarises how <strong>{operatorName}</strong> processes personal data in the Report-O-Matic{" "}
        <strong>hosted software</strong>. It is not legal advice. School and trust customers are typically the{" "}
        <strong>data controller</strong> for pupil and staff information they load into the product; {operatorName} acts
        as a <strong>processor</strong> for that processing under documented instructions (see our{" "}
        <Link href="/legal/dpa" className="text-emerald-800 underline hover:text-emerald-950">
          Data Processing Agreement
        </Link>
        ). For account holders signing in as individuals, roles may vary — owners act on behalf of their organisation.{" "}
        <Link href="/legal/data-protection" className="text-emerald-800 underline hover:text-emerald-950">
          Data protection overview
        </Link>{" "}
        and{" "}
        <Link href="/legal/terms" className="text-emerald-800 underline hover:text-emerald-950">
          terms of use
        </Link>
        . {operatorName} (company number {companyNo}, registered office: {registered}).
      </p>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">What the platform operator is — and is not — responsible for</h2>
        <p>
          {operatorName} is responsible for building and running the service in line with data protection law: security,
          access controls, subprocessors it appoints, assisting schools with their processor relationship, and the
          in-product tools we provide (such as export and account closure where available).
        </p>
        <p>
          {operatorName} is <strong>not</strong> responsible for how a school or its staff <strong>choose to use</strong>{" "}
          data <strong>outside</strong> the service — for example emails, printed PDFs, local drives, other systems, or
          disclosures to parents — or for the school&apos;s own legal basis, transparency, or retention choices for pupil
          data. Those remain the school&apos;s compliance duties as controller.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Contact</h2>
        <p>
          For questions about this processing or to exercise rights relating to the platform, contact{" "}
          <a className="text-emerald-800 underline hover:text-emerald-950" href={`mailto:${contact}`}>
            {contact}
          </a>
          . For pupil-record requests, your school is usually the first point of contact.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">What we process</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account data:</strong> email address, optional password hash, optional display name on membership
            rows, session cookie reference, security / sign-in codes (hashed where applicable), and audit-style events
            tied to your account (for example report edits or AI assist usage metadata).
          </li>
          <li>
            <strong>School workflow data:</strong> classes, pupil names, numeric grades, report text, timetables, and
            related content your organisation enters. The product is not designed to collect pupil addresses, dates of
            birth, or contact details.
          </li>
          <li>
            <strong>Billing:</strong> <strong>Paddle</strong> acts as merchant of record for card payments when checkout
            is enabled (tax and checkout are handled by Paddle); we may store limited billing identifiers and transaction
            summaries. Commercial banking may involve <strong>Wise</strong>.{" "}
            {!cardPaymentsOn ? (
              <span className="font-medium text-zinc-700">
                Card checkout is currently disabled on this deployment; no new card payments are taken through the
                product until the operator turns it back on.
              </span>
            ) : null}
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Marketing communications</h2>
        <p>
          We do not currently send promotional emails to schools. We may send <strong>service</strong> messages (for
          example security, billing, or product changes). If we introduce marketing communications in future, we will do
          so in line with applicable law and provide appropriate opt-out or consent mechanisms where required.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Purposes and lawful bases (EU/UK GDPR)</h2>
        <p>
          We process account and workflow data to provide the service you request (<strong>contract</strong> / steps
          prior to contract), to secure the platform (<strong>legitimate interests</strong> in fraud prevention and abuse
          resistance, balanced against your rights), and where required to comply with law (<strong>legal obligation</strong>
          ). Schools remain responsible for choosing and documenting their own lawful bases for pupil-related processing.
          Where consent is required for non-essential cookies, we ask separately — see the{" "}
          <Link href="/legal/cookies" className="text-emerald-800 underline hover:text-emerald-950">
            cookie notice
          </Link>
          .
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Subprocessors</h2>
        <p>
          Data may be processed by providers listed on our{" "}
          <Link href="/legal/subprocessors" className="text-emerald-800 underline hover:text-emerald-950">
            subprocessor page
          </Link>
          , including <strong>Supabase</strong>, <strong>Resend</strong>, <strong>OpenAI</strong> (optional AI),{" "}
          <strong>Cloudflare</strong>, <strong>Paddle</strong>, and <strong>Wise</strong>. Use subprocessors&apos; privacy
          policies for detail. International transfers may rely on standard contractual clauses or equivalent mechanisms
          those providers offer.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Retention</h2>
        <p>
          We keep data while your account or organisation relationship is active and for a reasonable period afterwards
          for backups, security, and legal claims. Some billing records may be retained longer where the law requires. You
          can request erasure subject to overriding legal obligations and school ownership rules in the product.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Your rights</h2>
        <p>
          Subject to applicable law, you may have the right to access, rectify, erase, restrict, or object to certain
          processing, and to data portability. Signed-in users can download a machine-readable export and request account
          closure from the <strong>Profile</strong> page where those controls exist. You may also lodge a complaint with
          your supervisory authority.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Security</h2>
        <p>
          We use industry-standard measures including encrypted transport (HTTPS), access control by role, and hashed
          credentials where passwords are used. No method of transmission or storage is completely secure.
        </p>
      </section>

      <p className="mt-10 text-xs text-zinc-500">
        Last updated: {new Date().toISOString().slice(0, 10)}. This notice may be updated; material changes will be
        communicated where appropriate.
      </p>
    </LegalPageShell>
  );
}
