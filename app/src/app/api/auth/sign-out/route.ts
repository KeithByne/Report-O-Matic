import { NextResponse } from "next/server";

function cookieClearOpts(): Parameters<NextResponse["cookies"]["set"]>[2] {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/landing.html", req.url), 303);
  res.cookies.set("rom_session", "", cookieClearOpts());
  return res;
}
