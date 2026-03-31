import crypto from "node:crypto";

type OtpRecord = {
  challengeId: string;
  email: string;
  codeHash: string;
  expiresAtMs: number;
  createdAtMs: number;
  mode: "signin" | "signup";
  ownerName: string | null;
  schoolName: string | null;
  referralCode: string | null;
  attempts: number;
};

type SessionRecord = {
  sessionId: string;
  email: string;
  createdAtMs: number;
  expiresAtMs: number;
};

/**
 * DEV-ONLY in-memory store.
 *
 * This makes the landing.html → send-code → verify flow work locally.
 * For production, we'll replace this with a Supabase-backed store.
 */
class DevStore {
  otps = new Map<string, OtpRecord>();
  sessions = new Map<string, SessionRecord>();

  private lastCleanupMs = 0;

  cleanup(nowMs: number) {
    if (nowMs - this.lastCleanupMs < 10_000) return;
    this.lastCleanupMs = nowMs;
    for (const [k, v] of this.otps.entries()) {
      if (v.expiresAtMs <= nowMs) this.otps.delete(k);
    }
    for (const [k, v] of this.sessions.entries()) {
      if (v.expiresAtMs <= nowMs) this.sessions.delete(k);
    }
  }

  newChallengeId() {
    return crypto.randomUUID();
  }

  newSessionId() {
    return crypto.randomUUID();
  }
}

declare global {
  var __rom_dev_store__: DevStore | undefined;
}

export function getDevStore(): DevStore {
  if (!globalThis.__rom_dev_store__) globalThis.__rom_dev_store__ = new DevStore();
  return globalThis.__rom_dev_store__;
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function safeEqualHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

