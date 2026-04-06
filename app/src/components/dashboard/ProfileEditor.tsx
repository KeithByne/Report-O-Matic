"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save, UserRound } from "lucide-react";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { AppHeaderLeftCluster } from "@/components/layout/AppHeaderLeftCluster";
import { GlobeLanguageSwitcher } from "@/components/i18n/GlobeLanguageSwitcher";
import { ICON_INLINE } from "@/components/ui/iconSizes";
import type { RomRole } from "@/lib/data/memberships";

const inputClassName =
  "mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-emerald-500 read-only:border-zinc-200";

type ProfilePayload = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  hasPassword: boolean;
};

function roleLabel(role: RomRole, tr: (k: string) => string): string {
  switch (role) {
    case "owner":
      return tr("dash.role.owner");
    case "department_head":
      return tr("dash.role.department_head");
    case "teacher":
      return tr("dash.role.teacher");
    default:
      return role;
  }
}

export function ProfileEditor({
  userDisplayName,
  membershipRoles,
}: {
  userDisplayName: string;
  membershipRoles: RomRole[];
}) {
  const { t } = useUiLanguage();

  const headerRoleLine = useMemo(() => {
    const uniq = [...new Set(membershipRoles)];
    return uniq.map((r) => roleLabel(r, t)).join(" · ");
  }, [membershipRoles, t]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [sessionEmail, setSessionEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [hasPassword, setHasPassword] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/me/profile", { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as ProfilePayload & { error?: string };
      if (!res.ok) throw new Error(data.error || t("common.loadFailed"));
      setSessionEmail(data.email);
      setFirstName(data.firstName ?? "");
      setLastName(data.lastName ?? "");
      setEmail(data.email);
      setHasPassword(data.hasPassword);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setOkMsg(null);
    try {
      const wantsEmailChange = email.trim().toLowerCase() !== sessionEmail;
      const wantsPasswordChange = newPassword.trim().length > 0;
      if (wantsEmailChange && !hasPassword) {
        setErr(t("profile.noPasswordEmailChange"));
        setSaving(false);
        return;
      }
      if (wantsPasswordChange && !hasPassword) {
        setErr(t("profile.noPasswordSetPassword"));
        setSaving(false);
        return;
      }
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          currentPassword,
          newPassword: wantsPasswordChange ? newPassword : "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; requireSignIn?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || t("common.failed"));
      if (data.requireSignIn) {
        window.location.href = "/landing.html";
        return;
      }
      setOkMsg(t("profile.success"));
      setCurrentPassword("");
      setNewPassword("");
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setSaving(false);
    }
  };

  const emailWillChange = email.trim().toLowerCase() !== sessionEmail && sessionEmail.length > 0;
  const showCurrentPassword =
    hasPassword && (newPassword.trim().length > 0 || emailWillChange);

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950">
      <header className="border-b border-emerald-200/80 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
          <AppHeaderLeftCluster
            roleLabel={headerRoleLine}
            userDisplayName={userDisplayName}
            pageTitle={t("profile.pageTitle")}
          />
          <div className="flex w-full min-w-0 flex-1 items-center justify-end gap-2 sm:w-auto sm:flex-none sm:flex-nowrap">
            <GlobeLanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-5 py-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:text-emerald-950"
      >
        <ArrowLeft className={ICON_INLINE} aria-hidden />
        {t("profile.backToDashboard")}
      </Link>

      <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <UserRound className={ICON_INLINE} aria-hidden />
          {t("profile.sectionAccount")}
        </h2>
        <p className="mt-1 text-xs text-zinc-600">{t("profile.lead")}</p>

        {loading ? (
          <p className="mt-6 text-sm text-zinc-500">{t("profile.loading")}</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
            <label className="block min-w-[200px] flex-1 text-sm">
              <span className="text-zinc-600">{t("profile.firstName")}</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                className={inputClassName}
              />
            </label>
            <label className="block min-w-[200px] flex-1 text-sm">
              <span className="text-zinc-600">{t("profile.surname")}</span>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                className={inputClassName}
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600">{t("profile.email")}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                readOnly={!hasPassword}
                className={`${inputClassName} ${!hasPassword ? "cursor-not-allowed bg-zinc-50 text-zinc-600" : ""}`}
              />
              {!hasPassword ? (
                <p className="mt-1 text-xs text-zinc-500">{t("profile.emailLockedUntilPassword")}</p>
              ) : null}
            </label>
            {emailWillChange ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                {t("profile.emailChangeWarning")}
              </p>
            ) : null}

            <div className="mt-1 border-t border-emerald-100 pt-4">
              <p className="text-sm font-semibold text-zinc-900">{t("profile.passwordSection")}</p>
              {!hasPassword ? (
                <p className="mt-1 text-xs text-zinc-600">{t("profile.passwordMissingHint")}</p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-zinc-600">{t("profile.newPasswordHint")}</p>
                  <label className="mt-3 block text-sm">
                    <span className="text-zinc-600">{t("profile.newPassword")}</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      className={inputClassName}
                    />
                  </label>
                </>
              )}
              {showCurrentPassword ? (
                <label className="mt-3 block text-sm">
                  <span className="text-zinc-600">{t("profile.currentPassword")}</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className={inputClassName}
                    required
                  />
                </label>
              ) : null}
            </div>

            {err ? (
              <p className="text-sm text-red-700" role="alert">
                {err}
              </p>
            ) : null}
            {okMsg ? (
              <p className="text-sm text-emerald-700" role="status">
                {okMsg}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-900 disabled:opacity-60"
            >
              <Save className={ICON_INLINE} aria-hidden />
              {saving ? t("profile.saving") : t("profile.save")}
            </button>
          </form>
        )}
      </div>
      </main>
    </div>
  );
}
