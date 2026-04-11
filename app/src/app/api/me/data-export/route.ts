import { NextResponse } from "next/server";
import { getRomSessionEmail } from "@/lib/auth/getSession";
import { buildPersonalDataExport } from "@/lib/data/accountPersonalData";

export async function GET() {
  const email = await getRomSessionEmail();
  if (!email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const payload = await buildPersonalDataExport(email);
    const safe = email.replace(/[^a-z0-9@._+-]+/gi, "_");
    const filename = `report-o-matic-data-export-${safe}-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Export failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
