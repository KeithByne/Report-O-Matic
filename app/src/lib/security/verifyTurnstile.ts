export async function verifyTurnstileToken(opts: {
  token: string;
  remoteIp: string;
}): Promise<{ ok: true } | { ok: false; status: number; message: string; log?: string[] }> {
  const tsSecret = process.env.TURNSTILE_SECRET_KEY;
  if (!tsSecret) {
    return { ok: false, status: 500, message: "Human verification is not configured." };
  }
  const turnstileToken = opts.token.trim();
  if (!turnstileToken) {
    return { ok: false, status: 400, message: "Human verification required." };
  }
  try {
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: tsSecret,
        response: turnstileToken,
        remoteip: opts.remoteIp,
      }),
    });
    const verifyJson = (await verifyRes.json()) as { success?: boolean; ["error-codes"]?: string[] };
    if (!verifyJson.success) {
      console.warn("[ROM turnstile] failed:", verifyJson["error-codes"]);
      return {
        ok: false,
        status: 403,
        message: "Human verification failed.",
        log: verifyJson["error-codes"],
      };
    }
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not verify human check.";
    console.error("[ROM turnstile] error:", msg);
    return { ok: false, status: 500, message: msg };
  }
}
