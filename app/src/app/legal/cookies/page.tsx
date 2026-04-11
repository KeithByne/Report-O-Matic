import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie notice — Report-O-Matic",
  description: "Cookies and similar technologies used by Report-O-Matic.",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/landing.html" className="text-sm font-semibold text-emerald-800 hover:text-emerald-950">
            ← Sign in
          </Link>
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <Link href="/legal/privacy" className="text-emerald-800 hover:text-emerald-950">
              Privacy
            </Link>
            <Link href="/legal/dpa" className="text-emerald-800 hover:text-emerald-950">
              DPA
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Cookie notice</h1>
        <p className="mt-2 text-sm text-zinc-600">
          This describes cookies and similar technologies we use. Essential cookies do not require consent under the
          ePrivacy rules; optional analytics or marketing cookies would only be set with consent (we do not use them in
          the default product configuration described here).
        </p>

        <section className="mt-8 space-y-4 text-sm leading-relaxed text-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Session cookie (essential)</h2>
            <p className="mt-2">
              <code className="rounded bg-zinc-200/80 px-1.5 py-0.5 text-xs">rom_session</code> — HTTP-only, secure in
              production, SameSite=Lax. Keeps you signed in for a limited time (typically up to eight hours). Required
              to operate the service.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Cloudflare Turnstile (sign-in page)</h2>
            <p className="mt-2">
              The standalone sign-in page may load Cloudflare Turnstile to reduce automated abuse. Cloudflare may set
              its own cookies or use local storage according to{" "}
              <a
                className="text-emerald-800 underline hover:text-emerald-950"
                href="https://www.cloudflare.com/privacypolicy/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Cloudflare&apos;s privacy policy
              </a>
              .
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Managing cookies</h2>
            <p className="mt-2">
              You can block or delete cookies in your browser settings; blocking essential cookies will prevent sign-in.
            </p>
          </div>
        </section>

        <p className="mt-10 text-xs text-zinc-500">Last updated: {new Date().toISOString().slice(0, 10)}.</p>
      </main>
    </div>
  );
}
