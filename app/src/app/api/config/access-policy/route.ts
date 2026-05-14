import { NextResponse } from "next/server";
import { isPublicSchoolSignupDisabled } from "@/lib/auth/publicSignupPolicy";

/** Used by `landing.html` to hide self-serve signup when registration is closed. */
export async function GET() {
  return NextResponse.json(
    { public_school_signup_disabled: isPublicSchoolSignupDisabled() },
    { headers: { "cache-control": "no-store" } },
  );
}
