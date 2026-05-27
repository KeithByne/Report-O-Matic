import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageNav";
import {
  operatorCompanyNumber,
  operatorJurisdiction,
  operatorLegalName,
  privacyContactEmail,
  supportContactEmail,
} from "@/lib/legal/operatorIdentity";

export const metadata: Metadata = {
  title: "Refund & cancellation policy — Report-O-Matic",
  description:
    "Refund, cancellation, and UK consumer rights for Report-O-Matic prepaid report credits.",
};

export default function RefundPolicyPage() {
  const operatorName = operatorLegalName();
  const companyNo = operatorCompanyNumber();
  const jurisdiction = operatorJurisdiction();
  const contact = privacyContactEmail();
  const support = supportContactEmail();
  const mailto = support || contact;

  return (
    <LegalPageShell>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Refund &amp; cancellation policy</h1>
      <p className="mt-2 text-sm text-zinc-600">
        This policy explains cancellations and refunds for prepaid report credits sold by{" "}
        <strong>{operatorName}</strong> (company number {companyNo}). Card checkout is
        handled by <strong>Paddle</strong> as Merchant of Record. Nothing in this policy limits your{" "}
        <strong>mandatory statutory rights</strong> under UK law.
      </p>

      <section className="mt-8 rounded-xl border border-sky-200 bg-sky-50 p-5 text-sm leading-relaxed text-sky-950">
        <h2 className="text-base font-semibold text-sky-950">Your UK statutory rights (summary)</h2>
        <p className="mt-2">
          If you are a <strong>consumer</strong> (an individual acting for purposes outside your trade, business, or
          profession), UK law gives you important rights. The following is a plain-language summary; the law itself
          prevails if there is any conflict.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Consumer Contracts Regulations 2013 (CCR):</strong> for most online purchases you have a{" "}
            <strong>14-day right to cancel</strong> distance contracts and receive a refund, subject to the digital
            content rules below.
          </li>
          <li>
            <strong>Consumer Rights Act 2015 (CRA):</strong> digital content must be{" "}
            <strong>as described</strong>, of <strong>satisfactory quality</strong>, and <strong>fit for purpose</strong>.
            If it is not, you are entitled to a remedy (repair, replacement, price reduction, or in serious cases a
            refund).
          </li>
          <li>
            <strong>Unfair terms:</strong> you are not bound by unfair terms in consumer contracts. We do not seek to
            exclude rights that cannot lawfully be excluded.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">1. Before you buy</h2>
        <p>
          We provide clear information on{" "}
          <Link href="/pricing" className="text-emerald-800 underline hover:text-emerald-950">
            pricing
          </Link>
          ,{" "}
          <Link href="/legal/terms" className="text-emerald-800 underline hover:text-emerald-950">
            terms of use
          </Link>
          ,{" "}
          <Link href="/legal/privacy" className="text-emerald-800 underline hover:text-emerald-950">
            privacy
          </Link>
          , and this policy. You can set up your school and use many features with{" "}
          <strong>watermarked previews</strong> before purchasing credits. At checkout, Paddle shows the price, tax, and
          payment terms.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">2. 14-day cancellation right (consumers)</h2>
        <p>
          If you are a UK consumer, you may cancel your credit pack purchase within <strong>14 days</strong> of the day
          after you receive confirmation of purchase, without giving a reason.
        </p>
        <p>
          <strong>Digital content and credits already used:</strong> Report credits are digital content supplied at a
          distance. If you ask us to begin supply immediately (for example by using credits to generate and save AI
          report comments, or by otherwise consuming credits after purchase), and you have acknowledged that you will
          lose your 14-day cancellation right once supply begins, we may deduct from your refund an amount for the
          digital content supplied up to the point of cancellation, calculated fairly in line with CCR rules.
        </p>
        <p>
          If you have <strong>not</strong> used any credits from the pack, we will refund the full amount paid (via
          Paddle) within 14 days of receiving your valid cancellation notice.
        </p>
        <p>
          <strong>How to cancel:</strong> send a clear statement of cancellation to{" "}
          <a className="font-medium text-emerald-800 underline hover:text-emerald-950" href={`mailto:${mailto}`}>
            {mailto}
          </a>{" "}
          or use our{" "}
          <Link href="/legal/contact" className="text-emerald-800 underline hover:text-emerald-950">
            contact page
          </Link>
          . Include your name, account email, organisation name (if any), date of purchase, and Paddle transaction
          reference. You may use your own wording; you do not have to use a special form.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">3. Faulty digital content (Consumer Rights Act)</h2>
        <p>
          If the service or digital content is faulty — for example it does not match its description, is not of
          satisfactory quality, or is not fit for purpose — you have rights under the CRA.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Contact us within a reasonable time with a description of the problem (error messages, screenshots, and what
            you expected).
          </li>
          <li>
            We will offer a <strong>repair or replacement</strong> (for example fixing the fault, re-crediting consumed
            credits in error, or providing equivalent service) within a reasonable time and without significant
            inconvenience.
          </li>
          <li>
            If repair or replacement is not possible or not completed within a reasonable time, you may be entitled to a{" "}
            <strong>price reduction</strong> or, where appropriate, a <strong>refund</strong>.
          </li>
        </ul>
        <p>
          These rights are separate from the 14-day cancellation right and may apply even after credits have been used.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">4. Schools and organisations (business customers)</h2>
        <p>
          Where you purchase on behalf of a school, trust, or company (not as a consumer), the CCR 14-day consumer
          cancellation right usually does <strong>not</strong> apply. Your contract is governed by our{" "}
          <Link href="/legal/terms" className="text-emerald-800 underline hover:text-emerald-950">
            Terms of use
          </Link>{" "}
          and this policy.
        </p>
        <p>
          We still act fairly: duplicate charges, failure to deliver purchased credits, or material breach of contract
          will be corrected (account credit or refund through Paddle as appropriate). CRA-style quality rights do not
          generally apply to business buyers, but misrepresentation or breach may give other remedies under general
          contract law.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">5. Prepaid credits — general position</h2>
        <p>
          Outside the statutory rights above, unused prepaid credits are not exchanged for cash. Promotional or test
          credits may be withdrawn in line with the offer terms. This does not affect your right to cancel within 14
          days (consumers) or to a remedy for faulty digital content.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">6. Duplicate charges and delivery failures</h2>
        <p>
          If you were charged twice for the same pack, or payment succeeded but credits were not applied within a
          reasonable time, contact us promptly. We will investigate and refund or credit your account as appropriate,
          usually within 14 days of confirming the error.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">7. Service discontinuation</h2>
        <p>
          If we permanently discontinue the paid service for customers who hold unused purchased credits, we will offer
          a fair outcome (for example a proportionate refund of unused credits or alternative access) in line with
          applicable law and our terms.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">8. How refunds are paid</h2>
        <p>
          Approved refunds for card payments are processed through <strong>Paddle</strong> to your original payment
          method where possible. Timing depends on your bank or card issuer (often 5–10 business days after we approve
          the refund).
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">9. Complaints and contact</h2>
        <p>
          Email{" "}
          <a className="font-medium text-emerald-800 underline hover:text-emerald-950" href={`mailto:${mailto}`}>
            {mailto}
          </a>{" "}
          or see our{" "}
          <Link href="/legal/contact" className="text-emerald-800 underline hover:text-emerald-950">
            contact page
          </Link>
          . We will acknowledge consumer complaints promptly and respond within a reasonable time (our target is two
          business days for first reply). If you are a consumer and remain unhappy, you may use alternative dispute
          resolution or the courts; EU/UK consumers may also use the UK European Consumer Centre for cross-border
          issues where relevant.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950">10. Governing law</h2>
        <p>
          This policy is governed by the laws of {jurisdiction}. Mandatory consumer protections in your country of
          residence apply where they cannot be excluded.
        </p>
      </section>

      <p className="mt-8 text-xs text-zinc-500">
        See also{" "}
        <Link href="/legal/terms" className="text-emerald-800 underline hover:text-emerald-950">
          Terms of use
        </Link>
        ,{" "}
        <Link href="/legal/privacy" className="text-emerald-800 underline hover:text-emerald-950">
          Privacy notice
        </Link>
        ,{" "}
        <Link href="/legal/contact" className="text-emerald-800 underline hover:text-emerald-950">
          Contact
        </Link>
        , and{" "}
        <Link href="/pricing" className="text-emerald-800 underline hover:text-emerald-950">
          Pricing
        </Link>
        . Last updated: {new Date().toISOString().slice(0, 10)}.
      </p>
    </LegalPageShell>
  );
}
