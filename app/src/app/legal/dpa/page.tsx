import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageNav";
import {
  operatorCompanyNumber,
  operatorLegalName,
  operatorRegisteredAddress,
  privacyContactEmail,
} from "@/lib/legal/operatorIdentity";

export const metadata: Metadata = {
  title: "Data Processing Agreement — Report-O-Matic",
  description: "Processor terms for school customers (UK/EU GDPR Article 28 style) — Report-O-Matic Ltd.",
};

export default function DpaPage() {
  const operatorName = operatorLegalName();
  const companyNo = operatorCompanyNumber();
  const operatorAddress = operatorRegisteredAddress();
  const contactEmail = privacyContactEmail();

  return (
    <LegalPageShell current="/legal/dpa">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Data Processing Agreement (DPA)</h1>
      <p className="mt-2 text-sm text-zinc-600">
        This agreement supplements your use of the Report-O-Matic hosted service between your organisation and{" "}
        <strong>{operatorName}</strong>. It is a practical template, not tailored legal advice — have it reviewed for
        your jurisdiction and facts. See also the{" "}
        <Link href="/legal/data-protection" className="text-emerald-800 underline hover:text-emerald-950">
          data protection overview
        </Link>
        .
      </p>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">1. Parties and roles</h2>
        <p>
          <strong>Customer</strong> (the “controller”) is the school, trust, local authority, or other organisation that
          creates an account and instructs users to enter pupil and staff-related data into Report-O-Matic.
        </p>
        <p>
          <strong>Processor</strong> (the “processor”) is <strong>{operatorName}</strong> (company number {companyNo}),
          with registered office at <span className="whitespace-pre-line">{operatorAddress}</span>, who hosts and
          operates the Report-O-Matic software on the Customer&apos;s behalf.
        </p>
        <p>
          The Processor processes personal data only on documented instructions from the Customer (including through the
          service configuration and normal use of the product), unless EU or UK law requires otherwise — in which case the
          Processor shall inform the Customer of that legal requirement before processing, unless the law prohibits such
          notice on important grounds of public interest.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">2. Subject matter, nature, and purpose</h2>
        <p>
          <strong>Subject matter:</strong> processing of personal data within the Report-O-Matic service to support school
          reporting workflows (accounts, classes, pupil records, report text, timetables, optional AI-assisted drafting
          where enabled, billing metadata, and security logs as described in the privacy notice).
        </p>
        <p>
          <strong>Nature of processing:</strong> collection, storage, organisation, retrieval, adaptation, disclosure by
          transmission to authorised users of the Customer, and erasure in line with product features and this agreement.
        </p>
        <p>
          <strong>Purpose:</strong> providing the Report-O-Matic service subscribed to by the Customer. The Customer
          remains responsible for determining the lawfulness of processing in its own context (including lawful basis,
          transparency to parents/pupils where required, and retention policies for pupil data).
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">3. Categories of data and data subjects</h2>
        <p>
          As determined by the Customer&apos;s use of the service, this may include: identifiers and contact data for
          staff users; pupil names and related class metadata; report content; optional profile fields; usage and security
          metadata; and billing-related identifiers where purchases are made.
        </p>
        <p>Data subjects may include pupils, parents/guardians (where data refers to them), and school staff.</p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">4. Processor obligations</h2>
        <p>The Processor shall:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>process personal data only on the Customer&apos;s instructions unless required by EU or UK law to the contrary;</li>
          <li>
            ensure that persons authorised to process the data are bound by confidentiality or are under an appropriate
            statutory obligation;
          </li>
          <li>
            implement appropriate technical and organisational measures to protect personal data, taking into account the
            state of the art, cost, and risks (including encryption in transit, access control, and separation of tenants);
          </li>
          <li>
            assist the Customer, taking into account the nature of processing, with responding to requests from data
            subjects and with DPIAs or consultations with supervisory authorities where applicable, insofar as possible
            and subject to reimbursement for unreasonable cost;
          </li>
          <li>
            notify the Customer without undue delay after becoming aware of a personal data breach affecting the
            Customer&apos;s data, with information reasonably available to enable the Customer to meet its obligations;
          </li>
          <li>
            at the end of the service relationship, delete or return personal data as the Customer directs, except where
            law requires retention;
          </li>
          <li>
            make available information necessary to demonstrate compliance and allow for audits reasonably scoped to the
            service (e.g. summaries of controls and subprocessors), with on-site audits only where mandated by a
            supervisory authority or agreed in writing.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">5. Subprocessors</h2>
        <p>
          The Customer generally authorises the Processor to engage the subprocessors listed or referenced in the privacy
          notice and{" "}
          <Link href="/legal/subprocessors" className="text-emerald-800 underline hover:text-emerald-950">
            subprocessor list
          </Link>{" "}
          (for example hosting/database, transactional email, optional AI, Paddle, Wise, and edge security).
          The Processor shall impose data protection terms on subprocessors that are materially equivalent to those in this
          DPA. The Customer may object to a new subprocessor on documented reasonable grounds; where no alternative can be
          agreed within a reasonable period, either party may terminate the affected part of the service.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">6. International transfers</h2>
        <p>
          Where personal data is transferred outside the UK or EEA, the Processor shall use appropriate safeguards (such as
          the UK IDTA / Addendum or EU standard contractual clauses) offered by subprocessors or as otherwise required by
          law.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">7. Limitation — Customer&apos;s own compliance</h2>
        <p>
          The Processor does not control how the Customer uses exported reports, emails, printouts, or other data outside
          the service. The Customer is solely responsible for its own compliance when it copies, shares, or re-uses data
          beyond what the software enforces. The Processor&apos;s obligations apply to processing within the hosted service
          and as described in this DPA.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">8. Term and termination</h2>
        <p>
          This DPA applies for as long as the Processor processes personal data on behalf of the Customer. Clauses
          intended to survive (including confidentiality, deletion, and liability allocations permitted by law) survive
          termination.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">9. Contact</h2>
        <p>
          Processor contact for privacy and processing questions:{" "}
          <a className="text-emerald-800 underline hover:text-emerald-950" href={`mailto:${contactEmail}`}>
            {contactEmail}
          </a>
        </p>
      </section>

      <p className="mt-10 text-xs text-zinc-500">
        Document version 1.0 · Last updated {new Date().toISOString().slice(0, 10)}. Governing law and liability caps, if
        any, follow your separate commercial terms with the Customer where they exist.
      </p>
    </LegalPageShell>
  );
}
