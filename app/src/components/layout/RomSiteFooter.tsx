import Link from "next/link";
import { SITE_FOOTER_LINK_GROUPS } from "@/lib/legal/siteFooterLinks";
import {
  operatorCompanyNumber,
  operatorLegalName,
  operatorRegisteredAddress,
  supportContactEmail,
} from "@/lib/legal/operatorIdentity";

/** Global site-map footer — 11pt links, distinct background. Included from root layout on all app routes. */
export function RomSiteFooter() {
  const operatorName = operatorLegalName();
  const companyNo = operatorCompanyNumber();
  const registered = operatorRegisteredAddress();
  const support = supportContactEmail();

  return (
    <footer className="rom-site-footer mt-auto shrink-0 border-t border-emerald-200/80 px-4 py-3 sm:px-5">
      <div className="mx-auto max-w-5xl">
        <nav className="rom-site-footer-links flex flex-wrap items-center gap-x-1 gap-y-1" aria-label="Site map">
          {SITE_FOOTER_LINK_GROUPS.map((group, gi) => (
            <span key={group.title} className="inline-flex flex-wrap items-center gap-x-1">
              {gi > 0 ? (
                <span className="rom-site-footer-sep mx-0.5 select-none" aria-hidden>
                  |
                </span>
              ) : null}
              {group.links.map((link, li) => (
                <span key={link.href} className="inline-flex items-center">
                  {li > 0 ? (
                    <span className="rom-site-footer-sep mx-1 select-none" aria-hidden>
                      ·
                    </span>
                  ) : null}
                  <Link href={link.href} className="rom-site-footer-link hover:underline">
                    {link.label}
                  </Link>
                </span>
              ))}
            </span>
          ))}
        </nav>
        <p className="rom-site-footer-meta mt-2 leading-snug">
          {operatorName} · Co. {companyNo} · {registered}
        </p>
        <p className="rom-site-footer-meta mt-1 leading-snug">
          <a className="rom-site-footer-link hover:underline" href={`mailto:${support}`}>
            {support}
          </a>
        </p>
      </div>
    </footer>
  );
}
