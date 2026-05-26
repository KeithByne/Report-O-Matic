import {
  operatorCompanyNumber,
  operatorLegalName,
  operatorRegisteredAddress,
  operatorTradingAddress,
  privacyContactEmail,
  supportContactEmail,
} from "@/lib/legal/operatorIdentity";

export function LegalCompanyFooter() {
  const name = operatorLegalName();
  const companyNo = operatorCompanyNumber();
  const registered = operatorRegisteredAddress();
  const trading = operatorTradingAddress();
  const privacy = privacyContactEmail();
  const support = supportContactEmail();

  return (
    <footer className="mt-12 border-t border-zinc-200 pt-6 text-xs leading-relaxed text-zinc-500">
      <p className="font-medium text-zinc-700">
        {name} · Company no. {companyNo}
      </p>
      <p className="mt-2">
        <span className="font-medium text-zinc-600">Registered office (England):</span> {registered}
      </p>
      <p className="mt-1">
        <span className="font-medium text-zinc-600">Trading / operational contact (Spain):</span> {trading}
      </p>
      <p className="mt-2">
        Data protection:{" "}
        <a className="text-emerald-800 underline hover:text-emerald-950" href={`mailto:${privacy}`}>
          {privacy}
        </a>
        {support !== privacy ? (
          <>
            {" "}
            · Support:{" "}
            <a className="text-emerald-800 underline hover:text-emerald-950" href={`mailto:${support}`}>
              {support}
            </a>
          </>
        ) : null}
      </p>
    </footer>
  );
}
