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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string; warn?: string } | null>(null);
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
        body: JSON.stringify({
          email: email.trim(),
          role: inviteRole,
          ...(inviteRole === "teacher"
            ? { first_name: firstName.trim(), last_name: lastName.trim() }
            : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        invite_email_sent?: boolean;
        invite_email_error?: string;
      };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

      const baseOk =
        "Access added." +
        (data.invite_email_sent === true
          ? " They should receive an invite email at that address with the sign-in link."
          : "") +
        " They must type their own email on Sign in (not yours) to receive the one-time code.";

      setMsg({
        type: "ok",
        text: baseOk,
        warn:
          data.invite_email_sent === false && data.invite_email_error
            ? data.invite_email_error
            : undefined,
      });
      setEmail("");
      setFirstName("");
      setLastName("");
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
    <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
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
            className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-emerald-500"
            placeholder="colleague@school.com"
          />
        </label>
        {(variant === "department_head" || role === "teacher") ? (
          <>
            <label className="block min-w-[160px] text-sm">
              <span className="text-zinc-600">Teacher first name(s)</span>
              <input
                type="text"
                name="first_name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-emerald-500"
                placeholder="e.g. Alex"
              />
            </label>
            <label className="block min-w-[160px] text-sm">
              <span className="text-zinc-600">Teacher surname(s)</span>
              <input
                type="text"
                name="last_name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-emerald-500"
                placeholder="e.g. Smith"
              />
            </label>
          </>
        ) : null}
        {variant === "owner" ? (
          <label className="block text-sm">
            <span className="text-zinc-600">Role</span>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "teacher" | "department_head")}
              className="mt-1 w-full min-w-[10rem] rounded-lg border border-emerald-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-emerald-500"
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
          className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-900 disabled:opacity-60"
        >
          {pending ? "Adding…" : variant === "department_head" ? "Add teacher" : "Add member"}
        </button>
      </form>
      {msg ? (
        <div className="mt-3 space-y-2 text-sm">
          <p
            className={msg.type === "ok" ? "text-emerald-700" : "text-red-700"}
            role={msg.type === "err" ? "alert" : "status"}
          >
            {msg.text}
          </p>
          {msg.warn ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950" role="status">
              {msg.warn}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
