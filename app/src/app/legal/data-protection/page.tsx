import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageNav";
import {
  icoRegistrationNumber,
  operatorCompanyNumber,
  operatorLegalName,
  operatorRegisteredAddress,
  operatorTradingAddress,
  privacyContactEmail,
} from "@/lib/legal/operatorIdentity";
import { isStripePaymentsEnabled } from "@/lib/stripe/enabled";

export const metadata: Metadata = {
  title: "Data protection — Report-O-Matic",
  description:
    "How Report-O-Matic Ltd protects personal data: roles, security, documents, and contacts for schools using the service.",
};

export default function DataProtectionPage() {
  const operatorName = operatorLegalName();
  const companyNo = operatorCompanyNumber();
  const operatorAddress = operatorRegisteredAddress();
  const tradingAddress = operatorTradingAddress();
  const contact = privacyContactEmail();
  const icoNumber = icoRegistrationNumber();
  const cardPaymentsOn = isStripePaymentsEnabled();

  return (
    <LegalPageShell current="/legal/data-protection">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Data protection</h1>
      <p className="mt-2 text-sm text-zinc-600">
        This page is for schools, trusts, and staff using Report-O-Matic. It explains how{" "}
        <strong>{operatorName}</strong> handles personal data in the hosted service. It is a practical summary, not
        legal advice. Your organisation remains responsible for pupil data you enter and how you use reports outside the
        platform.
      </p>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Who we are</h2>
        <p>
          <strong>{operatorName}</strong> (company number {companyNo}) develops and operates the Report-O-Matic software
          service. Registered office: {operatorAddress}. Trading / operational contact: {tradingAddress}. We act as a{" "}
          <strong>data processor</strong> when a school or other organisation uses the product to process pupil and
          staff-related information on the organisation&apos;s instructions. For some account-holder data (for example
          your sign-in email), we may act as <strong>controller</strong> where we determine how that data is used to run
          accounts and security.
        </p>
        {icoNumber ? (
          <p>
            UK Information Commissioner&apos;s Office registration reference: <strong>{icoNumber}</strong>.
          </p>
        ) : null}
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Roles: school and platform</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Your school (controller)</strong> decides what pupil and staff data to enter, the lawful basis,
            transparency to parents and pupils, retention, and any use of reports outside the system (email, print, other
            systems).
          </li>
          <li>
            <strong>{operatorName} (processor)</strong> hosts the service, applies access controls, uses approved
            subprocessors, and processes data only to provide and secure the product — as described in our documents
            below.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-4 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Key documents</h2>
        <ul className="grid gap-3 sm:grid-cols-1">
          <li className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
            <Link href="/legal/terms" className="font-semibold text-emerald-900 hover:text-emerald-950">
              Terms of use
            </Link>
            <p className="mt-1 text-zinc-600">Contractual terms for schools using the service, credits, and AI features.</p>
          </li>
          <li className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
            <Link href="/legal/privacy" className="font-semibold text-emerald-900 hover:text-emerald-950">
              Privacy notice
            </Link>
            <p className="mt-1 text-zinc-600">
              What data we process, why, retention, your rights, and subprocessors in plain language.
            </p>
          </li>
          <li className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
            <Link href="/legal/dpa" className="font-semibold text-emerald-900 hover:text-emerald-950">
              Data Processing Agreement (DPA)
            </Link>
            <p className="mt-1 text-zinc-600">
              Article 28–style processor terms for schools and trusts that need a written agreement with {operatorName}.
            </p>
          </li>
          <li className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
            <Link href="/legal/subprocessors" className="font-semibold text-emerald-900 hover:text-emerald-950">
              Subprocessor list
            </Link>
            <p className="mt-1 text-zinc-600">Hosting, email, AI, payments, and security providers.</p>
          </li>
          <li className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
            <Link href="/legal/cookies" className="font-semibold text-emerald-900 hover:text-emerald-950">
              Cookie notice
            </Link>
            <p className="mt-1 text-zinc-600">Session cookies and sign-in security technologies.</p>
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Children and pupil data</h2>
        <p>
          The product is designed for school reporting. Schools enter pupil <strong>names</strong> (typically first name
          for AI features; display names may also be stored), class membership, numeric grades, and report text. The
          service does <strong>not</strong> require pupil addresses, dates of birth, or contact details. Do not enter
          special-category data unless your organisation has a clear lawful basis and the product is appropriate for that
          use.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Security measures</h2>
        <p>We design the service so each school&apos;s data is separated and access is limited by role. Measures include:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Encrypted transport (HTTPS) for sign-in and all dashboard use</li>
          <li>Per-organisation (tenant) isolation in the database layer</li>
          <li>Role-based permissions for owners, department heads, and teachers</li>
          <li>Hashed credentials where passwords are used; short-lived session cookies for sign-in</li>
          <li>Human verification (Cloudflare Turnstile) on the public sign-in page to reduce automated abuse</li>
          <li>Audit-style logging for security-relevant events where configured</li>
          <li>
            Optional AI-assisted report drafting: pupil surnames are not sent to the model; only first names and numeric
            rubric data are used for appraisal, as described in the privacy notice
          </li>
        </ul>
        <p className="text-zinc-600">No online service can guarantee absolute security; we review controls as the product evolves.</p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Subprocessors</h2>
        <p>
          Personal data may be processed by providers listed on our{" "}
          <Link href="/legal/subprocessors" className="text-emerald-800 underline hover:text-emerald-950">
            subprocessor page
          </Link>
          , including <strong>Supabase</strong>, <strong>Resend</strong>, <strong>OpenAI</strong> (optional AI),{" "}
          <strong>Cloudflare</strong>, <strong>Stripe</strong> (card checkout
          {cardPaymentsOn ? " when enabled" : " when enabled by the operator"}), and <strong>Wise</strong> (business
          payment operations). The DPA covers authorisation and objection rights for schools.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">International transfers</h2>
        <p>
          Some subprocessors may process data outside the UK or EEA. Where that applies, we rely on appropriate safeguards
          offered by those providers (for example UK IDTA / Addendum or EU standard contractual clauses), as described in
          the DPA and subprocessor documentation.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Personal data breaches</h2>
        <p>
          If we become aware of a personal data breach affecting your organisation&apos;s data in the service, we will
          notify you without undue delay with information reasonably available so you can meet your obligations as
          controller. Please report suspected security issues to us promptly using the contact below.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Helping your school comply</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Use the DPA with your records of processing and privacy information for parents and staff where required.</li>
          <li>
            Signed-in users can export personal data and request account closure from <strong>Profile</strong> where
            those controls are available.
          </li>
          <li>
            Limit access within your organisation to staff who need it; review inactive accounts and class assignments
            regularly.
          </li>
          <li>
            Treat exported PDFs and copies like any other confidential pupil information — the platform does not control
            use after export.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Contact</h2>
        <p>
          For data protection questions about the platform, contact{" "}
          <a className="text-emerald-800 underline hover:text-emerald-950" href={`mailto:${contact}`}>
            {contact}
          </a>
          . For requests about a pupil&apos;s records, contact the school first — they are usually the controller.
        </p>
      </section>

      <p className="mt-10 text-xs text-zinc-500">
        Last updated: {new Date().toISOString().slice(0, 10)}. Material changes will be reflected on this page and linked
        documents where appropriate.
      </p>
    </LegalPageShell>
  );
}
