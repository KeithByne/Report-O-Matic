import {
  operatorCompanyNumber,
  operatorLegalName,
  privacyContactEmail,
  supportContactEmail,
} from "@/lib/legal/operatorIdentity";

export function LegalCompanyFooter() {
  const name = operatorLegalName();
  const companyNo = operatorCompanyNumber();
  const privacy = privacyContactEmail();
  const support = supportContactEmail();

  return (
    <footer className="mt-12 border-t border-zinc-200 pt-6 text-xs leading-relaxed text-zinc-500">
      <p className="font-medium text-zinc-700">
        {name} · Company no. {companyNo}
      </p>
      <p className="mt-2">
        <a className="text-emerald-800 underline hover:text-emerald-950" href="/legal/contact">
          Contact page
        </a>
        {" · "}
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
