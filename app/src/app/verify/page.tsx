import { redirect } from "next/navigation";

/** Legacy URL from the old email-code sign-in step; home page has email + password sign-in. */
export default function VerifyPage() {
  redirect("/");
}
