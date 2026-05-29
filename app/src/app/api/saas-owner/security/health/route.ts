import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { getRuntimeSecretHealth } from "@/lib/security/envSecrets";
import { isRomFromEmailFormatValid } from "@/lib/email/resendShared";

type Check = {
  name: string;
  requiredInProduction: boolean;
  minLength?: number;
  hint?: string;
};

const SECRET_CHECKS: Check[] = [
  { name: "ROM_SESSION_SECRET", requiredInProduction: true, minLength: 24 },
  { name: "ROM_OTP_PEPPER", requiredInProduction: true, minLength: 24 },
  { name: "SUPABASE_SERVICE_ROLE_KEY", requiredInProduction: true, minLength: 24 },
  { name: "TURNSTILE_SECRET_KEY", requiredInProduction: true, minLength: 24 },
  { name: "RESEND_API_KEY", requiredInProduction: true, minLength: 16 },
  { name: "ROM_FROM_EMAIL", requiredInProduction: true, minLength: 6 },
  { name: "OPENAI_API_KEY", requiredInProduction: true, minLength: 20 },
  { name: "PADDLE_API_KEY", requiredInProduction: false, minLength: 20 },
  { name: "PADDLE_WEBHOOK_SECRET", requiredInProduction: false, minLength: 20 },
];

export async function GET() {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  const isProd = process.env.NODE_ENV === "production";
  const paddleEnabled = process.env.ROM_PADDLE_ENABLED?.trim() === "true";
  const checks = SECRET_CHECKS.map((cfg) => {
    if (cfg.name === "ROM_FROM_EMAIL") {
      const health = getRuntimeSecretHealth(cfg.name, cfg.minLength ?? 24);
      const required = cfg.requiredInProduction && isProd;
      const formatOk = isRomFromEmailFormatValid();
      const hint =
        required && health.configured && !formatOk
          ? "Must be one plain email only (e.g. security@domain.com). Use ROM_FROM_DISPLAY_NAME for the inbox label."
          : undefined;
      const ok = !required || (health.configured && formatOk);
      return {
        name: cfg.name,
        required,
        configured: health.configured,
        strongEnough: !health.configured || formatOk,
        minLength: health.minLength,
        ok,
        hint,
      };
    }
    const health = getRuntimeSecretHealth(cfg.name, cfg.minLength ?? 24);
    const paddleRequired =
      isProd &&
      paddleEnabled &&
      (cfg.name === "PADDLE_API_KEY" || cfg.name === "PADDLE_WEBHOOK_SECRET");
    const required = (cfg.requiredInProduction && isProd) || paddleRequired;
    const ok = required ? health.configured && health.strongEnough : true;
    const hint =
      paddleRequired && !health.configured
        ? "Required when ROM_PADDLE_ENABLED=true in production."
        : undefined;
    return {
      name: cfg.name,
      required,
      configured: health.configured,
      strongEnough: health.strongEnough,
      minLength: health.minLength,
      ok,
      hint,
    };
  });

  const allRequiredOk = checks.every((c) => c.ok);
  return NextResponse.json(
    {
      ok: allRequiredOk,
      environment: process.env.NODE_ENV ?? "unknown",
      checkedAt: new Date().toISOString(),
      checks,
    },
    { status: allRequiredOk ? 200 : 503 },
  );
}
