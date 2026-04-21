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
  const minLength = opts.minLength ?? 24;
  const raw = process.env[name];
  const value = typeof raw === "string" ? raw.trim() : "";

  if (value.length >= minLength) return value;

  if (isProduction()) {
    throw new Error(
      `${name} must be set to a strong secret (at least ${minLength} characters) in production.`,
    );
  }

  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`[ROM security] ${name} is missing or weak in development; using dev fallback.`);
  }
  return opts.devFallback;
}
