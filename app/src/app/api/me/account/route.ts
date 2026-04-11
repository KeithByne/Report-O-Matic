import { NextResponse } from "next/server";
import { getRomSessionEmail } from "@/lib/auth/getSession";
import { getPasswordHashForEmail } from "@/lib/auth/passwordStore";
import { verifyCurrentPassword } from "@/lib/data/userProfile";
import {
  closePersonalAccount,
  isSoleOwnerBlock,
} from "@/lib/data/accountPersonalData";
import { ACCOUNT_DELETE_CONFIRM_PHRASE } from "@/lib/legal/accountDeleteConstants";

function cookieClearOpts(): Parameters<NextResponse["cookies"]["set"]>[2] {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}

type DeleteBody = {
  currentPassword?: unknown;
  confirmPhrase?: unknown;
};

export async function DELETE(req: Request) {
  const email = await getRomSessionEmail();
  if (!email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const confirmPhrase = typeof body.confirmPhrase === "string" ? body.confirmPhrase.trim() : "";

  let hasPassword: boolean;
  try {
    hasPassword = !!(await getPasswordHashForEmail(email));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not verify account.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (hasPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required to close this account." }, { status: 400 });
    }
    const ok = await verifyCurrentPassword(email, currentPassword);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }
  } else {
    if (confirmPhrase !== ACCOUNT_DELETE_CONFIRM_PHRASE) {
      return NextResponse.json(
        {
          error: `Type the confirmation phrase exactly: ${ACCOUNT_DELETE_CONFIRM_PHRASE}`,
        },
        { status: 400 },
      );
    }
  }

  try {
    await closePersonalAccount(email);
  } catch (e: unknown) {
    if (isSoleOwnerBlock(e)) {
      return NextResponse.json({ error: e.message, code: "sole_owner" }, { status: 409 });
    }
    const msg = e instanceof Error ? e.message : "Could not close account.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("rom_session", "", cookieClearOpts());
  return res;
}
