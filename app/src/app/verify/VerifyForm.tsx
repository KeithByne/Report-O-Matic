"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Script from "next/script";
import { AppHeaderLogo, AppHeaderWordmark } from "@/components/layout/AppHeaderBrand";
import { useUiLanguage } from "@/components/i18n/UiLanguageProvider";
import { postSignInRedirectPath } from "@/lib/auth/saasOwnerShared";

type Status = "idle" | "submitting" | "ok" | "err";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }) => string;
      remove?: (widgetId: string) => void;
      reset?: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY =
  typeof process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY === "string" && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY.trim()
    ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY.trim()
    : "0x4AAAAAACyZzKE7jN8nu-J1";

export function VerifyForm() {
  const { t } = useUiLanguage();
  const sp = useSearchParams();
  const router = useRouter();

  const email = useMemo(() => (sp.get("email") || "").trim(), [sp]);
  const challenge = useMemo(() => (sp.get("challenge") || "").trim(), [sp]);

  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<string>("");
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupEmail, setBackupEmail] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [backupStatus, setBackupStatus] = useState<Status>("idle");
  const [backupMsg, setBackupMsg] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false);
  const turnstileHostRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    setMsg("");
    setStatus("idle");
  }, [email, challenge]);

  useEffect(() => {
    if (!backupOpen) {
      setBackupMsg("");
      setBackupStatus("idle");
      setTurnstileToken(null);
      if (turnstileWidgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {
          /* ignore */
        }
      }
      turnstileWidgetIdRef.current = null;
      return;
    }
    if (!turnstileScriptReady) return;
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const host = turnstileHostRef.current;
      const api = window.turnstile;
      if (!host || !api) return;
      try {
        const id = api.render(host, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => setTurnstileToken(token),
        });
        turnstileWidgetIdRef.current = id;
      } catch {
        setBackupMsg(t("auth.backupResendTurnstileErr"));
        setBackupStatus("err");
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (turnstileWidgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {
          /* ignore */
        }
      }
      turnstileWidgetIdRef.current = null;
      setTurnstileToken(null);
    };
  }, [backupOpen, turnstileScriptReady, t]);

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

  async function onBackupResend(e: React.FormEvent) {
    e.preventDefault();
    setBackupMsg("");
    const be = backupEmail.trim().toLowerCase();
    const pw = backupPassword.trim();
    if (!email || !challenge) {
      setBackupStatus("err");
      setBackupMsg(t("auth.errMissingVerifyParams"));
      return;
    }
    if (!be || !be.includes("@")) {
      setBackupStatus("err");
      setBackupMsg(t("auth.backupResendInvalidBackup"));
      return;
    }
    if (be === email.trim().toLowerCase()) {
      setBackupStatus("err");
      setBackupMsg(t("auth.backupResendSameAsAccount"));
      return;
    }
    if (!pw || pw.length < 8) {
      setBackupStatus("err");
      setBackupMsg(t("auth.backupResendPasswordShort"));
      return;
    }
    if (!turnstileToken) {
      setBackupStatus("err");
      setBackupMsg(t("auth.backupResendTurnstileMissing"));
      return;
    }

    setBackupStatus("submitting");
    try {
      const res = await fetch("/api/auth/resend-otp-backup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          challenge_id: challenge,
          password: pw,
          backup_email: be,
          turnstile_token: turnstileToken,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && (data.error || data.message)) || t("auth.backupResendErrGeneric"));
      setBackupStatus("ok");
      setBackupMsg(t("auth.backupResendOk"));
      const wid = turnstileWidgetIdRef.current;
      if (wid && window.turnstile?.reset) {
        try {
          window.turnstile.reset(wid);
        } catch {
          /* ignore */
        }
        setTurnstileToken(null);
      }
    } catch (err: unknown) {
      setBackupStatus("err");
      setBackupMsg(err instanceof Error ? err.message : t("auth.backupResendErrGeneric"));
    }
  }

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950 flex items-center justify-center p-6">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setTurnstileScriptReady(true)}
      />
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

        <details
          className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-sm"
          onToggle={(e) => setBackupOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer font-medium text-emerald-900 select-none">
            {t("auth.backupResendTitle")}
          </summary>
          <p className="mt-2 text-xs text-zinc-600 leading-relaxed">{t("auth.backupResendLead")}</p>
          <form onSubmit={onBackupResend} className="mt-3 space-y-3">
            <label className="block">
              <span className="block text-xs font-medium text-zinc-600">{t("auth.backupEmailLabel")}</span>
              <input
                value={backupEmail}
                onChange={(e) => setBackupEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="you@gmail.com"
                className="mt-1 w-full rounded-xl border border-emerald-200 px-3 py-2 outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-zinc-600">{t("auth.backupResendPasswordLabel")}</span>
              <input
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                className="mt-1 w-full rounded-xl border border-emerald-200 px-3 py-2 outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500"
              />
            </label>
            <div ref={turnstileHostRef} className="min-h-[65px]" />
            <button
              type="submit"
              disabled={backupStatus === "submitting"}
              className="w-full rounded-xl border border-emerald-300 bg-white text-emerald-900 font-semibold py-2.5 hover:bg-emerald-50 disabled:opacity-60"
            >
              {backupStatus === "submitting" ? t("auth.backupResendSending") : t("auth.backupResendButton")}
            </button>
          </form>
          {backupMsg ? (
            <div
              className={[
                "mt-3 rounded-xl border px-3 py-2 text-xs",
                backupStatus === "ok"
                  ? "border-green-200 bg-green-50 text-green-900"
                  : backupStatus === "err"
                    ? "border-red-200 bg-red-50 text-red-900"
                    : "border-emerald-200 bg-emerald-50/80 text-emerald-950",
              ].join(" ")}
            >
              {backupMsg}
            </div>
          ) : null}
        </details>

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
