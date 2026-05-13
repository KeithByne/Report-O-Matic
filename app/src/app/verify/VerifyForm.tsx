"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Email OTP verification was removed. Old bookmarks to `/verify` land here — send users to the landing page.
 */
export function VerifyForm() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/landing.html");
  }, [router]);

  return (
    <div className="min-h-screen bg-emerald-50/80 text-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white shadow-sm p-6 text-center text-sm text-zinc-600">
        <p className="font-medium text-zinc-900">Sign-in has been updated</p>
        <p className="mt-2">Redirecting to the landing page…</p>
        <p className="mt-4">
          <a href="/landing.html" className="text-emerald-800 underline font-medium">
            Open landing page
          </a>
        </p>
      </div>
    </div>
  );
}
