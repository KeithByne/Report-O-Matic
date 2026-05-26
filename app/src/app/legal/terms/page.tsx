import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageNav";
import {
  operatorCompanyNumber,
  operatorJurisdiction,
  operatorLegalName,
  operatorRegisteredAddress,
  privacyContactEmail,
  supportContactEmail,
} from "@/lib/legal/operatorIdentity";

export const metadata: Metadata = {
  title: "Terms of use — Report-O-Matic",
  description: "Terms of use for Report-O-Matic Ltd school reporting software.",
};

export default function TermsPage() {
  const operatorName = operatorLegalName();
  const companyNo = operatorCompanyNumber();
  const registered = operatorRegisteredAddress();
  const jurisdiction = operatorJurisdiction();
  const privacy = privacyContactEmail();
  const support = supportContactEmail();

  return (
    <LegalPageShell current="/legal/terms">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Terms of use</h1>
      <p className="mt-2 text-sm text-zinc-600">
        These terms govern access to the Report-O-Matic hosted service operated by{" "}
        <strong>
          {operatorName}
        </strong>{" "}
        (company number {companyNo}, registered office: {registered}). By creating an account or using the service, you
        agree on behalf of your organisation. If you do not agree, do not use the service. This document is a practical
        template, not legal advice.
      </p>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">1. Who may use the service</h2>
        <p>
          The service is intended for schools, trusts, language centres, and similar organisations. The person who registers
          must be authorised to bind the organisation. Users must be staff aged 18 or over (or the minimum age required in
          your jurisdiction to enter contracts for your organisation). You are responsible for invitations you send and
          for how your users behave under these terms.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">2. The service</h2>
        <p>
          Report-O-Matic provides tools to manage classes, pupils, timetables, and school reports, including optional
          AI-assisted drafting of report comments and export to PDF. Features may change over time. We do not guarantee
          uninterrupted availability; maintenance and outages may occur.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">3. Report credits and payment</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Report generation that uses the AI assist and saves a comment typically consumes <strong>one report credit</strong>{" "}
            per successful run, as shown in the product.
          </li>
          <li>
            Credits are sold in prepaid packs. Prices are shown at checkout (for example via{" "}
            <strong>Stripe</strong> when card payments are enabled). Applicable tax may be added or included as stated at
            checkout.
          </li>
          <li>
            <strong>No refunds:</strong> all credit pack purchases are final. Unused credits are not refundable except
            where the law requires otherwise.
          </li>
          <li>
            Test or promotional credits may be offered at our discretion and may expire or be withdrawn.
          </li>
          <li>
            Commercial receipts and banking may be processed through our payment providers and business accounts (including{" "}
            <strong>Stripe</strong> and <strong>Wise</strong>).
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">4. Acceptable use</h2>
        <p>You must not:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>use the service unlawfully or enter data you are not permitted to process;</li>
          <li>share passwords or allow unauthorised access to your organisation&apos;s workspace;</li>
          <li>attempt to bypass security, credit limits, or technical restrictions;</li>
          <li>use the service to generate harmful, discriminatory, or misleading content;</li>
          <li>reverse engineer or scrape the service except as permitted by law.</li>
        </ul>
        <p>
          Your organisation remains the <strong>data controller</strong> for pupil information you enter. You must have a
          lawful basis and appropriate safeguards (including staff training and parent-facing transparency) before
          processing pupil data in the service.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">5. AI-assisted features</h2>
        <p>
          AI-generated text is a <strong>draft</strong> based on numeric rubric data and limited identifiers (for example
          pupil first name — not surname). You must review and approve content before sharing with parents or pupils. We
          do not warrant that AI output is accurate, complete, or free from bias. {operatorName} is not liable for
          reports you send after review. See the{" "}
          <Link href="/legal/privacy" className="text-emerald-800 underline hover:text-emerald-950">
            privacy notice
          </Link>{" "}
          and{" "}
          <Link href="/legal/subprocessors" className="text-emerald-800 underline hover:text-emerald-950">
            subprocessor list
          </Link>{" "}
          for how AI providers process data.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">6. Data protection</h2>
        <p>
          Personal data is handled as described in our{" "}
          <Link href="/legal/data-protection" className="text-emerald-800 underline hover:text-emerald-950">
            data protection overview
          </Link>
          ,{" "}
          <Link href="/legal/privacy" className="text-emerald-800 underline hover:text-emerald-950">
            privacy notice
          </Link>
          , and{" "}
          <Link href="/legal/dpa" className="text-emerald-800 underline hover:text-emerald-950">
            Data Processing Agreement
          </Link>
          . Schools processing pupil data should rely on the DPA with {operatorName} as processor.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">7. Intellectual property</h2>
        <p>
          We own the software, branding, and documentation. You own content you enter. You grant us a limited licence to
          host and process that content solely to provide the service (including optional AI features). Exported PDFs and
          reports remain your responsibility once outside the platform.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">8. Support</h2>
        <p>
          Support is provided on a reasonable-efforts basis by email at{" "}
          <a className="text-emerald-800 underline hover:text-emerald-950" href={`mailto:${support}`}>
            {support}
          </a>
          . We do not guarantee a particular response time unless agreed in a separate written contract.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">9. Liability</h2>
        <p>
          To the fullest extent permitted by law, {operatorName} is not liable for indirect, consequential, or special
          damages, or for loss of profits, data, or goodwill. Our total liability arising from the service in any twelve-month
          period is limited to the fees you paid to us for the service in that period (or €100 if none). Nothing limits
          liability that cannot be limited by law (including death or personal injury caused by negligence, or fraud).
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">10. Suspension and termination</h2>
        <p>
          We may suspend or terminate access for breach of these terms, non-payment, security risk, or legal requirement.
          You may stop using the service at any time. On termination, export data where the product allows; we will delete
          or retain data as described in the privacy notice and DPA, subject to legal retention obligations.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">11. Changes</h2>
        <p>
          We may update these terms. Material changes will be posted on this page with an updated date. Continued use after
          changes take effect constitutes acceptance where permitted by law.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">12. Governing law</h2>
        <p>
          These terms are governed by the laws of <strong>{jurisdiction}</strong>. The courts of {jurisdiction} have
          exclusive jurisdiction, subject to mandatory consumer or employment rights that cannot be excluded.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">13. Contact</h2>
        <p>
          Questions about these terms:{" "}
          <a className="text-emerald-800 underline hover:text-emerald-950" href={`mailto:${privacy}`}>
            {privacy}
          </a>
          .
        </p>
      </section>

      <p className="mt-10 text-xs text-zinc-500">Last updated: {new Date().toISOString().slice(0, 10)}.</p>
    </LegalPageShell>
  );
}
