"use client";

import { useState, type FormEvent } from "react";

type Props = {
  tenantId: string;
  schoolName: string;
  /** Owner: invite department heads or teachers. Department head: teachers only. */
  variant: "owner" | "department_head";
};

export function InviteTeamForm({ tenantId, schoolName, variant }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"teacher" | "department_head">("teacher");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    try {
      const inviteRole = variant === "department_head" ? "teacher" : role;
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role: inviteRole }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setMsg({
        type: "ok",
        text:
          "Access added. If email is configured, they also get an invite message at that address with the sign-in link. They must type their own email on Sign in (not yours) to receive the code.",
      });
      setEmail("");
    } catch (err) {
      setMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setPending(false);
    }
  }

  const heading =
    variant === "owner" ? `Invite to ${schoolName}` : `Invite teachers — ${schoolName}`;
  const description =
    variant === "owner"
      ? "Add department heads or teachers by email. They sign in with the same address (one-time code)."
      : "Department heads can add teachers only. Same sign-in flow.";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900">{heading}</h3>
      <p className="mt-1 text-xs text-zinc-600">{description}</p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block min-w-[200px] flex-1 text-sm">
          <span className="text-zinc-600">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-500"
            placeholder="colleague@school.com"
          />
        </label>
        {variant === "owner" ? (
          <label className="block text-sm">
            <span className="text-zinc-600">Role</span>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "teacher" | "department_head")}
              className="mt-1 w-full min-w-[10rem] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-500"
            >
              <option value="teacher">Teacher</option>
              <option value="department_head">Department head</option>
            </select>
          </label>
        ) : (
          <div className="pb-2 text-sm text-zinc-500">
            Role: <span className="font-medium text-zinc-800">Teacher</span>
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "Adding…" : variant === "department_head" ? "Add teacher" : "Add member"}
        </button>
      </form>
      {msg ? (
        <p
          className={`mt-3 text-sm ${msg.type === "ok" ? "text-emerald-700" : "text-red-700"}`}
          role={msg.type === "err" ? "alert" : "status"}
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
