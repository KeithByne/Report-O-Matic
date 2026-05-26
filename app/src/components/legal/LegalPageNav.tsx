import Link from "next/link";
import type { ReactNode } from "react";

const LINKS = [
  { href: "/legal/data-protection", label: "Data protection" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/dpa", label: "DPA" },
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
      <header className="rom-app-shell-header">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link
            href="/landing.html"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50/80"
          >
            <span aria-hidden>←</span>
            Sign in
          </Link>
          <LegalPageNav current={current} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">{children}</main>
    </div>
  );
}
