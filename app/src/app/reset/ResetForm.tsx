"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeaderLogo, AppHeaderWordmark } from "@/components/layout/AppHeaderBrand";

type Status = "idle" | "submitting" | "ok" | "err";

export function ResetForm() {
  const sp = useSearchParams();
  const router = useRouter();

  const email = useMemo(() => (sp.get("email") || "").trim(), [sp]);
  const challenge = useMemo(() => (sp.get("challenge") || "").trim(), [sp]);

  const [code, setCode] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    setMsg("");
    setStatus("idle");
  }, [email, challenge]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!email) {
      setStatus("err");
      setMsg("Missing email. Please return to the landing page and start a reset again.");
      return;
    }
    if (!challenge) {
      setStatus("err");
      setMsg("Missing reset challenge. Please return to the landing page and start a reset again.");
      return;
    }
    const c = code.trim();
    if (!/^\d{6,7}$/.test(c)) {
      setStatus("err");
      setMsg("Please enter the 6–7 digit reset code from your email.");
      return;
    }
    const p1 = pw1.trim();
    const p2 = pw2.trim();
    if (p1.length < 8) {
      setStatus("err");
      setMsg("Your new password must be at least 8 characters.");
      return;
    }
    if (p1 !== p2) {
      setStatus("err");
      setMsg("Passwords do not match.");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, challenge_id: challenge, code: c, new_password: p1 }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && (data.error || data.message)) || "Reset failed.");
      setStatus("ok");
      setMsg("Password reset. Redirecting…");
      setTimeout(() => router.push("/landing.html"), 700);
    } catch (e: unknown) {
      setStatus("err");
      setMsg(e instanceof Error ? e.message : "Reset failed.");
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
          <h1 className="text-xl font-bold tracking-tight">Reset your password</h1>
          <p className="text-sm text-zinc-600 mt-1">
            {email ? (
              <>
                Enter the code sent to <span className="font-medium">{email}</span> and choose a new password.
              </>
            ) : (
              <>Return to the landing page and start the reset again.</>
            )}
          </p>
          {email ? (
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              The email can take up to a minute to arrive. If you don’t see it, check your spam or junk folder.
            </p>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-zinc-600">Reset code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="mt-1 w-full rounded-xl border border-emerald-200 px-3 py-2 outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-zinc-600">New password</span>
            <input
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="mt-1 w-full rounded-xl border border-emerald-200 px-3 py-2 outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-zinc-600">Confirm new password</span>
            <input
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your new password"
              className="mt-1 w-full rounded-xl border border-emerald-200 px-3 py-2 outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500"
            />
          </label>

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full rounded-xl bg-emerald-700 text-white font-semibold py-2.5 shadow-sm hover:bg-emerald-800 disabled:opacity-60"
          >
            {status === "submitting" ? "Resetting…" : "Reset password"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.push("/landing.html")}
          className="mt-3 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
        >
          Back to sign-in
        </button>

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
            <span className="font-medium">Challenge</span>:{" "}
            <span className="font-mono break-all">{challenge || "(missing)"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

