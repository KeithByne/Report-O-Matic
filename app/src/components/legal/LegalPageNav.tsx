import type { ReactNode } from "react";
import { LegalAppHeader } from "@/components/legal/LegalAppHeader";

export function LegalPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <LegalAppHeader />
      <main className="mx-auto max-w-3xl px-5 py-10 pb-6">{children}</main>
    </div>
  );
}
