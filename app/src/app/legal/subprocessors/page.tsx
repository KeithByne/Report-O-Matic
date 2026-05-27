import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageNav";
import { LEGAL_SUBPROCESSORS } from "@/lib/legal/subprocessors";
import { operatorLegalName } from "@/lib/legal/operatorIdentity";

export const metadata: Metadata = {
  title: "Subprocessors — Report-O-Matic",
  description: "Subprocessors used by Report-O-Matic Ltd to host and operate the service.",
};

export default function SubprocessorsPage() {
  const operatorName = operatorLegalName();

  return (
    <LegalPageShell>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Subprocessors</h1>
      <p className="mt-2 text-sm text-zinc-600">
        {operatorName} uses the following categories of service providers to operate Report-O-Matic. School customers
        authorise these subprocessors under the{" "}
        <Link href="/legal/dpa" className="text-emerald-800 underline hover:text-emerald-950">
          Data Processing Agreement
        </Link>
        . This list may be updated; material changes will be reflected here.
      </p>

      <div className="mt-8 overflow-x-auto rounded-xl border border-emerald-200 bg-white shadow-sm">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-emerald-100 bg-emerald-50/60">
              <th className="px-4 py-3 font-semibold text-zinc-900">Provider</th>
              <th className="px-4 py-3 font-semibold text-zinc-900">Purpose</th>
              <th className="px-4 py-3 font-semibold text-zinc-900">Typical data</th>
              <th className="px-4 py-3 font-semibold text-zinc-900">Location / transfers</th>
            </tr>
          </thead>
          <tbody>
            {LEGAL_SUBPROCESSORS.map((row) => (
              <tr key={row.name} className="border-b border-zinc-100 align-top last:border-0">
                <td className="px-4 py-3 font-medium text-zinc-900">{row.name}</td>
                <td className="px-4 py-3 text-zinc-700">{row.purpose}</td>
                <td className="px-4 py-3 text-zinc-700">{row.dataCategories}</td>
                <td className="px-4 py-3 text-zinc-600">{row.locationNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-zinc-700">
        For more detail on how personal data is used, see the{" "}
        <Link href="/legal/privacy" className="text-emerald-800 underline hover:text-emerald-950">
          privacy notice
        </Link>{" "}
        and{" "}
        <Link href="/legal/data-protection" className="text-emerald-800 underline hover:text-emerald-950">
          data protection overview
        </Link>
        .
      </p>

      <p className="mt-10 text-xs text-zinc-500">Last updated: {new Date().toISOString().slice(0, 10)}.</p>
    </LegalPageShell>
  );
}
