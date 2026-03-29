import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth/session";

export async function getRomSessionEmail(): Promise<string | null> {
  const token = (await cookies()).get("rom_session")?.value || "";
  const s = token ? verifySession(token) : null;
  return s?.email?.trim().toLowerCase() ?? null;
}
