import type { Metadata } from "next";
import Link from "next/link";
import { PUBLIC_CREDIT_PACKS } from "@/lib/legal/publicCreditPacks";
import {
  operatorCompanyNumber,
  operatorLegalName,
  privacyContactEmail,
  supportContactEmail,
} from "@/lib/legal/operatorIdentity";

export const metadata: Metadata = {
  title: "Pricing — Report-O-Matic",
  description: "Report credit pack pricing in GBP for Report-O-Matic school reporting software.",
};

export default function PricingPage() {
  const operatorName = operatorLegalName();
  const companyNo = operatorCompanyNumber();
  const contact = privacyContactEmail();
  const support = supportContactEmail();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link
            href="/landing.html"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-emerald-50/80"
          >
            <span aria-hidden>←</span>
            Sign in
          </Link>
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm" aria-label="Legal documents">
            <Link href="/legal/terms" className="text-emerald-800 hover:text-emerald-950">
              Terms
            </Link>
            <Link href="/legal/privacy" className="text-emerald-800 hover:text-emerald-950">
              Privacy
            </Link>
            <Link href="/legal/refund" className="text-emerald-800 hover:text-emerald-950">
              Refunds
            </Link>
            <Link href="/legal/contact" className="text-emerald-800 hover:text-emerald-950">
              Contact
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Pricing</h1>
        <p className="mt-2 text-sm text-zinc-600">
          <strong>{operatorName}</strong> (company number {companyNo}) sells prepaid <strong>report credits</strong>.
          Each successful AI comment generation and save typically uses <strong>one credit</strong>. Credits are added to
          the school owner&apos;s account and shared across every school that owner manages.
        </p>

        <section className="mt-8 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-emerald-100 bg-emerald-50/60 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-4 py-3" scope="col">
                  Pack
                </th>
                <th className="px-4 py-3" scope="col">
                  Report credits
                </th>
                <th className="px-4 py-3 text-right" scope="col">
                  List price (GBP)
                </th>
              </tr>
            </thead>
            <tbody>
              {PUBLIC_CREDIT_PACKS.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-zinc-900">{p.name}</td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700">{p.reportCredits.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-900">{p.priceGbp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-6 space-y-3 text-sm leading-relaxed text-zinc-800">
          <h2 className="text-base font-semibold text-zinc-950">Checkout and tax</h2>
          <p>
            Card payments are processed by <strong>Paddle</strong>, our Merchant of Record. Prices above are our GBP list
            prices. VAT or other sales tax, where applicable, is calculated and shown at checkout based on your location
            and customer type. Paddle issues the receipt.
          </p>
          <p>
            To purchase, sign in as a <strong>school owner</strong> and open <strong>Buy report credits</strong> from your
            dashboard or school billing page. Test-access schools may receive free trial credits before purchase is
            required.
          </p>
        </section>

        <section className="mt-6 space-y-3 text-sm leading-relaxed text-zinc-800">
          <h2 className="text-base font-semibold text-zinc-950">What is included</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>AI-assisted report comment drafting (one credit per successful generation, as shown in the product)</li>
            <li>Watermarked PDF preview when you have no credits; full PDF export when credits are available</li>
            <li>School setup: classes, pupils, timetables, registers, and team invites</li>
            <li>Secure, role-based access for owners, department heads, and teachers</li>
          </ul>
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <p>
            <strong>UK consumers:</strong> you have a 14-day cancellation right and rights if digital content is faulty.
            See our{" "}
            <Link href="/legal/refund" className="font-medium text-emerald-800 underline hover:text-emerald-950">
              Refund &amp; cancellation policy
            </Link>{" "}
            and{" "}
            <Link href="/legal/terms" className="font-medium text-emerald-800 underline hover:text-emerald-950">
              Terms of use
            </Link>
            .
          </p>
        </section>

        <section className="mt-6 text-sm text-zinc-800">
          <h2 className="text-base font-semibold text-zinc-950">Contact</h2>
          <p className="mt-2">
            Questions about pricing, billing, or UK consumer rights: see our{" "}
            <Link href="/legal/contact" className="font-medium text-emerald-800 underline hover:text-emerald-950">
              contact page
            </Link>{" "}
            or email{" "}
            <a className="font-medium text-emerald-800 underline hover:text-emerald-950" href={`mailto:${contact}`}>
              {contact}
            </a>
            .
          </p>
        </section>

      </main>
    </div>
  );
}
