import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { createAdditionalSchoolForOwner } from "@/lib/data/memberships";

export async function POST(req: Request) {
  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { name?: unknown };
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "School name is required." }, { status: 400 });
  }

  try {
    const { tenantId } = await createAdditionalSchoolForOwner({
      ownerEmail: session.email,
      schoolName: name,
    });
    return NextResponse.json({ tenantId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not create school.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
