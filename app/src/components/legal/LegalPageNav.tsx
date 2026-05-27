import Link from "next/link";
import type { ReactNode } from "react";
import { LegalAppHeader } from "@/components/legal/LegalAppHeader";
import { LegalCompanyFooter } from "@/components/legal/LegalCompanyFooter";

const LINKS = [
  { href: "/legal/data-protection", label: "Data protection" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/dpa", label: "DPA" },
  { href: "/legal/subprocessors", label: "Subprocessors" },
  { href: "/legal/cookies", label: "Cookies" },
] as const;

export function LegalPageNav({ current }: { current?: (typeof LINKS)[number]["href"] }) {
  return (
    <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm" aria-label="Legal documents">
      {LINKS.map(({ href, label }) =>
        href === current ? (
          <span key={href} className="font-medium text-zinc-500" aria-current="page">
            {label}
          </span>
        ) : (
          <Link key={href} href={href} className="text-emerald-800 hover:text-emerald-950">
            {label}
          </Link>
        ),
      )}
    </nav>
  );
}

export function LegalPageShell({
  current,
  children,
}: {
  current?: (typeof LINKS)[number]["href"];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <LegalAppHeader current={current} />
      <main className="mx-auto max-w-3xl px-5 py-10">
        {children}
        <LegalCompanyFooter />
      </main>
    </div>
  );
}
