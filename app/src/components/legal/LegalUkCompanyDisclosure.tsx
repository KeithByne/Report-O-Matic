import {
  operatorCompanyNumber,
  operatorJurisdiction,
  operatorLegalName,
  operatorRegisteredAddress,
} from "@/lib/legal/operatorIdentity";

/**
 * UK Companies Act statutory disclosure — collapsed in Terms only.
 * Online support is via email on the contact page; no trading address is shown publicly.
 */
export function LegalUkCompanyDisclosure() {
  const name = operatorLegalName();
  const companyNo = operatorCompanyNumber();
  const jurisdiction = operatorJurisdiction();
  const registered = operatorRegisteredAddress();

  return (
    <details
      id="uk-company-disclosure"
      className="mt-10 rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 text-[11px] leading-relaxed text-zinc-500"
    >
      <summary className="cursor-pointer select-none font-medium text-zinc-600 hover:text-zinc-700">
        UK company disclosure
      </summary>
      <div className="mt-3 space-y-2 text-zinc-600">
        <p>
          <span className="font-medium text-zinc-700">{name}</span> · Company number {companyNo} · Registered in{" "}
          {jurisdiction}
        </p>
        <p>
          <span className="font-medium text-zinc-700">Registered office:</span>{" "}
          <span className="whitespace-pre-line">{registered}</span>
        </p>
        <p className="text-zinc-500">
          We operate online. For support, billing, or data protection, use the contact page or the email addresses given
          in these legal documents — not postal mail.
        </p>
      </div>
    </details>
  );
}
