import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageNav";
import {
  operatorCompanyNumber,
  operatorLegalName,
  privacyContactEmail,
  supportContactEmail,
} from "@/lib/legal/operatorIdentity";

export const metadata: Metadata = {
  title: "Contact — Report-O-Matic",
  description: "Contact Report-O-Matic Ltd for support, billing, refunds, and data protection.",
};

export default function ContactPage() {
  const operatorName = operatorLegalName();
  const companyNo = operatorCompanyNumber();
  const privacy = privacyContactEmail();
  const support = supportContactEmail();

  return (
    <LegalPageShell>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Contact us</h1>
      <p className="mt-2 text-sm text-zinc-600">
        How to reach <strong>{operatorName}</strong> (company number {companyNo}) online. We aim to reply to genuine
        enquiries
        within <strong>two business days</strong> (often sooner). Complex billing or data requests may take longer.
      </p>

      <section className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 text-sm text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Primary contact (online only)</h2>
        <p className="mt-2 text-zinc-700">
          We handle support, billing, and data protection enquiries by email. We do not publish a postal inbox for
          customer service.
        </p>
        <p className="mt-3">
          Email:{" "}
          <a className="font-semibold text-emerald-800 underline hover:text-emerald-950" href={`mailto:${support}`}>
            {support}
          </a>
        </p>
        {privacy !== support ? (
          <p className="mt-2">
            Data protection / privacy:{" "}
            <a className="font-semibold text-emerald-800 underline hover:text-emerald-950" href={`mailto:${privacy}`}>
              {privacy}
            </a>
          </p>
        ) : null}
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">What to include in your message</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account &amp; sign-in:</strong> the email address on your account and school / organisation name.
          </li>
          <li>
            <strong>Billing &amp; credits:</strong> date of purchase, pack name, Paddle receipt or transaction reference,
            and whether credits were not applied.
          </li>
          <li>
            <strong>Cancellation or refunds:</strong> see our{" "}
            <Link href="/legal/refund" className="text-emerald-800 underline hover:text-emerald-950">
              Refund &amp; cancellation policy
            </Link>
            . State clearly if you are exercising a statutory right (for example 14-day cancellation).
          </li>
          <li>
            <strong>Data protection:</strong> whether you act as a school (pupil data) or as an individual account holder.
            For pupil records, your school is usually the first contact.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Payments</h2>
        <p>
          Card payments are processed by <strong>Paddle</strong> as Merchant of Record. For payment receipts and some
          buyer queries, Paddle may contact you directly. You can still email us at{" "}
          <a className="text-emerald-800 underline hover:text-emerald-950" href={`mailto:${support}`}>
            {support}
          </a>{" "}
          and we will help coordinate with Paddle where needed.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">Related pages</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Link href="/pricing" className="text-emerald-800 underline hover:text-emerald-950">
              Pricing
            </Link>
          </li>
          <li>
            <Link href="/legal/terms" className="text-emerald-800 underline hover:text-emerald-950">
              Terms of use
            </Link>
          </li>
          <li>
            <Link href="/legal/privacy" className="text-emerald-800 underline hover:text-emerald-950">
              Privacy notice
            </Link>
          </li>
          <li>
            <Link href="/legal/refund" className="text-emerald-800 underline hover:text-emerald-950">
              Refund &amp; cancellation policy
            </Link>
          </li>
          <li>
            <Link href="/legal/data-protection" className="text-emerald-800 underline hover:text-emerald-950">
              Data protection overview
            </Link>
          </li>
        </ul>
      </section>

    </LegalPageShell>
  );
}
