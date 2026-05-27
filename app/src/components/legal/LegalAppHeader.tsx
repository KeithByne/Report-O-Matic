"use client";

import Link from "next/link";
import { AppHeaderRightControls } from "@/components/layout/AppHeaderRightControls";
import { LegalPageNav } from "@/components/legal/LegalPageNav";

type LegalHref =
  | "/pricing"
  | "/legal/contact"
  | "/legal/data-protection"
  | "/legal/terms"
  | "/legal/privacy"
  | "/legal/refund"
  | "/legal/dpa"
  | "/legal/subprocessors"
  | "/legal/cookies";

export function LegalAppHeader({ current }: { current?: LegalHref }) {
  return (
    <header className="rom-app-shell-header">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
        <Link
          href="/landing.html"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-emerald-50/80"
        >
          <span aria-hidden>←</span>
          Sign in
        </Link>
        <AppHeaderRightControls>
          <LegalPageNav current={current} />
        </AppHeaderRightControls>
      </div>
    </header>
  );
}
