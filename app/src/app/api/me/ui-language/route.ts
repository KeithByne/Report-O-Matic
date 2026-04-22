import { NextResponse } from "next/server";
import { getRomSessionEmail } from "@/lib/auth/getSession";
import { isUiLang } from "@/lib/i18n/uiStrings";
import { getStoredUiLanguageForEmail, setStoredUiLanguageForEmail } from "@/lib/data/userUiLanguage";

export async function GET() {
  const email = await getRomSessionEmail();
  if (!email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const language = await getStoredUiLanguageForEmail(email);
  return NextResponse.json({ language });
}

type Body = { language?: unknown };

export async function PUT(req: Request) {
  const email = await getRomSessionEmail();
  if (!email) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Body;
  const languageRaw = typeof body.language === "string" ? body.language.trim() : "";
  if (!isUiLang(languageRaw)) {
    return NextResponse.json({ error: "Invalid UI language." }, { status: 400 });
  }
  await setStoredUiLanguageForEmail(email, languageRaw);
  return NextResponse.json({ ok: true });
}
