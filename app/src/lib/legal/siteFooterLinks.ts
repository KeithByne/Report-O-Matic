/** Public site-map links for the global footer (Paddle review, legal, pricing). */

export type SiteFooterLink = {
  href: string;
  label: string;
  external?: boolean;
};

export const SITE_FOOTER_LINK_GROUPS: { title: string; links: SiteFooterLink[] }[] = [
  {
    title: "Product",
    links: [{ href: "/pricing", label: "Pricing" }],
  },
  {
    title: "Legal & consumer",
    links: [
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/refund", label: "Refunds" },
      { href: "/legal/contact", label: "Contact" },
      { href: "/legal/data-protection", label: "Data protection" },
      { href: "/legal/dpa", label: "DPA" },
      { href: "/legal/cookies", label: "Cookies" },
      { href: "/legal/subprocessors", label: "Subprocessors" },
    ],
  },
];
