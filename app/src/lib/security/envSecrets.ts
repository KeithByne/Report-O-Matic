type SecretOptions = {
  devFallback: string;
  minLength?: number;
};

export type SecretHealth = {
  configured: boolean;
  strongEnough: boolean;
  minLength: number;
};

const warned = new Set<string>();

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function validateRuntimeSecret(
  name: string,
  opts: SecretOptions,
): { ok: true; value: string } | { ok: false; error: string } {
  const minLength = opts.minLength ?? 24;
  const raw = process.env[name];
  const value = typeof raw === "string" ? raw.trim() : "";

  if (value.length >= minLength) return { ok: true, value };

  if (isProduction()) {
    return {
      ok: false,
      error: `${name} must be set to a strong secret (at least ${minLength} characters) in production.`,
    };
  }

  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`[ROM security] ${name} is missing or weak in development; using dev fallback.`);
  }
  return { ok: true, value: opts.devFallback };
}

/** Non-throwing: use in API routes so misconfiguration returns JSON instead of a 500. */
export function tryRequireRuntimeSecret(
  name: string,
  opts: SecretOptions,
): { ok: true; value: string } | { ok: false; error: string } {
  return validateRuntimeSecret(name, opts);
}

export function getRuntimeSecretHealth(name: string, minLength = 24): SecretHealth {
  const raw = process.env[name];
  const value = typeof raw === "string" ? raw.trim() : "";
  return {
    configured: value.length > 0,
    strongEnough: value.length >= minLength,
    minLength,
  };
}

/**
 * Returns a required runtime secret.
 * In production: throws when missing/weak to fail closed.
 * In development: allows explicit local fallback for smoother setup.
 */
export function requireRuntimeSecret(name: string, opts: SecretOptions): string {
  const r = validateRuntimeSecret(name, opts);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}
