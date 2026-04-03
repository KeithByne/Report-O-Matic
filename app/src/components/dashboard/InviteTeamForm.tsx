"use client";

import { Send, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";

type Props = {
  tenantId: string;
  schoolName: string;
  /** Owner: invite department heads or teachers. Department head: teachers only. */
  variant: "owner" | "department_head";
};

export function InviteTeamForm({ tenantId, schoolName, variant }: Props) {
  const { t } = useUiLanguage();
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
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        invite_email_sent?: boolean;
        invite_email_error?: string;
      };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

      const baseOk =
        t("invite.okBase") +
        (data.invite_email_sent === true ? t("invite.okEmailPart") : "") +
        t("invite.okSignInPart");

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
        text: err instanceof Error ? err.message : t("common.genericError"),
      });
    } finally {
      setPending(false);
    }
  }

  const heading =
    variant === "owner" ? t("invite.headingOwner", { school: schoolName }) : t("invite.headingDh", { school: schoolName });
  const description = variant === "owner" ? t("invite.descriptionOwner") : t("invite.descriptionDh");
  const namesRequired = variant === "department_head" || role === "teacher";

  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <UserPlus className={ICON_INLINE} aria-hidden />
        {heading}
      </h3>
      <p className="mt-1 text-xs text-zinc-600">{description}</p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block min-w-[200px] flex-1 text-sm">
          <span className="text-zinc-600">{t("invite.email")}</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-emerald-500"
            placeholder={t("invite.emailPlaceholder")}
          />
        </label>
        <>
          <label className="block min-w-[160px] text-sm">
            <span className="text-zinc-600">{t("invite.firstName")}</span>
            <input
              type="text"
              name="first_name"
              required={namesRequired}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-emerald-500"
              placeholder={t("invite.firstNamePlaceholder")}
            />
          </label>
          <label className="block min-w-[160px] text-sm">
            <span className="text-zinc-600">{t("invite.lastName")}</span>
            <input
              type="text"
              name="last_name"
              required={namesRequired}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-emerald-500"
              placeholder={t("invite.lastNamePlaceholder")}
            />
          </label>
        </>
        {variant === "owner" ? (
          <label className="block text-sm">
            <span className="text-zinc-600">{t("invite.role")}</span>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "teacher" | "department_head")}
              className="mt-1 w-full min-w-[10rem] rounded-lg border border-emerald-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-emerald-500"
            >
              <option value="teacher">{t("invite.optionTeacher")}</option>
              <option value="department_head">{t("invite.optionDeptHead")}</option>
            </select>
          </label>
        ) : (
          <div className="pb-2 text-sm text-zinc-500">
            {t("invite.roleLine")} <span className="font-medium text-zinc-800">{t("invite.optionTeacher")}</span>
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-900 disabled:opacity-60"
        >
          <Send className={ICON_INLINE} aria-hidden />
          {pending ? t("invite.adding") : variant === "department_head" ? t("invite.addTeacher") : t("invite.addMember")}
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
