import { NextResponse } from "next/server";
import { getRomSessionEmail } from "@/lib/auth/getSession";
import { getPasswordHashForEmail } from "@/lib/auth/passwordStore";
import {
  changeAccountEmail,
  getProfileForEmail,
  setPasswordForEmail,
  updateDisplayNamesForEmail,
  verifyCurrentPassword,
} from "@/lib/data/userProfile";

function cookieClearOpts(): Parameters<NextResponse["cookies"]["set"]>[2] {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(s: string): boolean {
  const t = s.trim();
  return t.length > 3 && t.length <= 320 && t.includes("@");
}

export async function GET() {
  const email = await getRomSessionEmail();
  if (!email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    const profile = await getProfileForEmail(email);
    if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    const hasPassword = !!(await getPasswordHashForEmail(email));
    return NextResponse.json({ ...profile, hasPassword });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not load profile.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type PatchBody = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  currentPassword?: unknown;
  newPassword?: unknown;
};

export async function PATCH(req: Request) {
  const email = await getRomSessionEmail();
  if (!email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const firstNameIn = typeof body.firstName === "string" ? body.firstName.trim() : undefined;
  const lastNameIn = typeof body.lastName === "string" ? body.lastName.trim() : undefined;
  const newPasswordRaw = typeof body.newPassword === "string" ? body.newPassword : "";
  const newEmailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";

  const wantsEmailChange = Boolean(newEmailRaw && normalizeEmail(newEmailRaw) !== email);
  const wantsPasswordChange = newPasswordRaw.trim().length > 0;

  if (wantsEmailChange && !isValidEmail(newEmailRaw)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (wantsEmailChange) {
    const hp = await getPasswordHashForEmail(email);
    if (!hp) {
      return NextResponse.json(
        {
          error:
            "Add a password to your account before changing your sign-in email. Use “Forgot password” on the sign-in page if needed.",
        },
        { status: 400 },
      );
    }
  }

  if (wantsEmailChange || wantsPasswordChange) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password is required to change your email or password." },
        { status: 400 },
      );
    }
    const ok = await verifyCurrentPassword(email, currentPassword);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }
  }

  try {
    if (firstNameIn !== undefined || lastNameIn !== undefined) {
      const existing = await getProfileForEmail(email);
      await updateDisplayNamesForEmail(
        email,
        firstNameIn !== undefined ? (firstNameIn || null) : existing?.firstName ?? null,
        lastNameIn !== undefined ? (lastNameIn || null) : existing?.lastName ?? null,
      );
    }

    if (wantsPasswordChange) {
      const pw = newPasswordRaw.trim();
      if (pw.length < 8 || pw.length > 200) {
        return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
      }
      await setPasswordForEmail(email, pw);
    }

    if (wantsEmailChange) {
      await changeAccountEmail(email, normalizeEmail(newEmailRaw));
      const res = NextResponse.json({ ok: true, requireSignIn: true });
      res.cookies.set("rom_session", "", cookieClearOpts());
      return res;
    }

    return NextResponse.json({ ok: true, requireSignIn: false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not update profile.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
