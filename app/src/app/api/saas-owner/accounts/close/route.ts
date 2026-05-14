import { NextResponse } from "next/server";
import { requireSaasOwner } from "@/lib/auth/saasOwner";
import { eraseSignInIdentityData } from "@/lib/data/accountPersonalData";
import { getSignInSnapshotForEmail, recordCancelledUser } from "@/lib/data/cancelledUsers";
import { getServiceSupabase } from "@/lib/supabase/service";

type Body = { target_email?: unknown; confirm_email?: unknown };

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export async function POST(req: Request) {
  const gate = await requireSaasOwner();
  if (!gate.ok) return gate.res;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const target = norm(typeof body.target_email === "string" ? body.target_email : "");
  const confirm = norm(typeof body.confirm_email === "string" ? body.confirm_email : "");

  if (!target || !target.includes("@") || target.length > 320) {
    return NextResponse.json({ error: "Please provide a valid target email." }, { status: 400 });
  }
  if (target !== confirm) {
    return NextResponse.json({ error: "Confirmation email must exactly match the target email." }, { status: 400 });
  }
  if (target === norm(gate.email)) {
    return NextResponse.json(
      {
        error:
          "You cannot close your own SaaS owner account from this tool. Use Profile → delete account on the main app if you need to remove yourself.",
      },
      { status: 400 },
    );
  }

  if (!getServiceSupabase()) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  try {
    const snapshot = await getSignInSnapshotForEmail(target);
    await eraseSignInIdentityData(target);
    try {
      await recordCancelledUser({
        email: target,
        source: "saas_owner",
        cancelledByEmail: gate.email,
        snapshot,
      });
    } catch (recErr: unknown) {
      const recMsg = recErr instanceof Error ? recErr.message : String(recErr);
      console.error("[ROM saas-owner accounts/close] recordCancelledUser after erase:", recMsg);
      return NextResponse.json(
        {
          error: `Account was erased but the cancelled-user registry could not be updated: ${recMsg}. Add a row manually in cancelled_users if needed.`,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      target_email: target,
      memberships_removed: snapshot.memberships,
      had_password: snapshot.had_password,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not close account.";
    console.error("[ROM saas-owner accounts/close]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
