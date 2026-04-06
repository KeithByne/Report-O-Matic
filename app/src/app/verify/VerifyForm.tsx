"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppHeaderLogo, AppHeaderWordmark } from "@/components/layout/AppHeaderBrand";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { postSignInRedirectPath } from "@/lib/auth/saasOwnerShared";

type Status = "idle" | "submitting" | "ok" | "err";

export function VerifyForm() {
  const { t } = useUiLanguage();
  const sp = useSearchParams();
  const router = useRouter();

  const email = useMemo(() => (sp.get("email") || "").trim(), [sp]);
  const challenge = useMemo(() => (sp.get("challenge") || "").trim(), [sp]);

  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    setMsg("");
    setStatus("idle");
  }, [email, challenge]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    const c = code.trim();
    if (!email || !challenge) {
      setStatus("err");
      setMsg(t("auth.errMissingVerifyParams"));
      return;
    }
    if (!/^\d{6,7}$/.test(c)) {
      setStatus("err");
      setMsg(t("auth.errCodeDigits"));
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, challenge_id: challenge, code: c }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error((data && (data.error || data.message)) || t("auth.errVerificationFailed"));

      setStatus("ok");
      setMsg(t("auth.verifyOk"));
      setTimeout(() => router.push(postSignInRedirectPath(email)), 500);
    } catch (err: unknown) {
      setStatus("err");
      setMsg(err instanceof Error ? err.message : t("auth.errVerificationFailed"));
    }
  }

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white shadow-sm p-6">
        <div className="mb-4 flex justify-center border-b border-emerald-100 pb-4">
          <div className="flex items-start gap-3">
            <AppHeaderLogo size="sm" />
            <div>
              <AppHeaderWordmark />
            </div>
          </div>
        </div>
        <div className="mb-4">
          <h1 className="text-xl font-bold tracking-tight">{t("auth.verifyTitle")}</h1>
          <p className="text-sm text-zinc-600 mt-1">
            {email ? t("auth.verifySentTo", { email }) : t("auth.verifyReturnLanding")}
          </p>
          {email ? (
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{t("auth.emailDelayHint")}</p>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-zinc-600">{t("auth.securityCode")}</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t("auth.codePlaceholder")}
              className="mt-1 w-full rounded-xl border border-emerald-200 px-3 py-2 outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500"
            />
          </label>

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full rounded-xl bg-emerald-700 text-white font-semibold py-2.5 shadow-sm hover:bg-emerald-800 disabled:opacity-60"
          >
            {status === "submitting" ? t("auth.verifying") : t("auth.verify")}
          </button>
        </form>

        {msg ? (
          <div
            className={[
              "mt-4 rounded-xl border px-3 py-2 text-sm",
              status === "ok"
                ? "border-green-200 bg-green-50 text-green-900"
                : status === "err"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-emerald-200 bg-emerald-50/80 text-emerald-950",
            ].join(" ")}
          >
            {msg}
          </div>
        ) : null}

        <div className="mt-4 text-xs text-zinc-500">
          <div>
            <span className="font-medium">{t("auth.challengeDebug")}</span>:{" "}
            <span className="font-mono break-all">{challenge || t("auth.challengeMissing")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
