import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { isCardPaymentsEnabled } from "@/lib/payments/enabled";

let cached: Paddle | null = null;

function paddleEnvironment(): Environment {
  const raw = (process.env.PADDLE_ENVIRONMENT ?? process.env.ROM_PADDLE_ENVIRONMENT ?? "sandbox").trim().toLowerCase();
  return raw === "production" || raw === "live" ? Environment.production : Environment.sandbox;
}

function getPaddleSingleton(): Paddle | null {
  const key = process.env.PADDLE_API_KEY?.trim();
  if (!key) return null;
  if (!cached) {
    cached = new Paddle(key, { environment: paddleEnvironment() });
  }
  return cached;
}

/** Server-side Paddle API (transactions, webhooks). */
export function getPaddle(): Paddle | null {
  if (!isCardPaymentsEnabled()) return null;
  return getPaddleSingleton();
}

/** Webhook verification still needs the API key; does not require ROM_PADDLE_ENABLED. */
export function getPaddleForWebhook(): Paddle | null {
  return getPaddleSingleton();
}
