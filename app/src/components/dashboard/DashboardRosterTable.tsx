"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { canRemoveMember } from "@/lib/auth/memberDeletePolicy";
import type { RomRole, TenantMemberRow } from "@/lib/data/memberships";

function memberRoleLabel(role: RomRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "department_head":
      return "Dept. head";
    case "teacher":
      return "Teacher";
    default:
      return role;
  }
}

type Props = {
  tenantId: string;
  viewerRole: RomRole;
  viewerEmail: string;
  roster: TenantMemberRow[];
};

export function DashboardRosterTable({ tenantId, viewerRole, viewerEmail, roster }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function removeMember(email: string) {
    if (!confirm(`Remove ${email} from this school? They will lose access until invited again.`)) return;
    setBusy(email);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/members`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_email: email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <table className="w-full min-w-[320px] text-left text-sm">
      <thead>
        <tr className="border-b border-emerald-100 text-xs text-zinc-500">
          <th className="py-1.5 pr-3 font-medium">Email</th>
          <th className="py-1.5 pr-3 font-medium">Role</th>
          <th className="py-1.5 font-medium w-24">Actions</th>
        </tr>
      </thead>
      <tbody>
        {roster.map((row) => {
          const canRemove =
            canRemoveMember(viewerRole, row.role) && row.user_email.trim().toLowerCase() !== viewerEmail.trim().toLowerCase();
          return (
            <tr key={`${row.user_email}-${row.role}`} className="border-b border-emerald-50">
              <td className="break-all py-1.5 pr-3 font-mono text-xs text-zinc-800">{row.user_email}</td>
              <td className="py-1.5 pr-3 text-xs text-zinc-700">{memberRoleLabel(row.role)}</td>
              <td className="py-1.5">
                {canRemove ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void removeMember(row.user_email)}
                    className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                  >
                    {busy === row.user_email ? "…" : "Remove"}
                  </button>
                ) : (
                  <span className="text-xs text-zinc-400">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
