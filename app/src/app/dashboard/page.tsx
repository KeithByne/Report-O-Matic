import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { InviteTeamForm } from "@/components/dashboard/InviteTeamForm";
import { verifySession } from "@/lib/auth/session";
import { getMembershipsForEmail, type MembershipWithTenant, type RomRole } from "@/lib/data/memberships";

function formatSessionEnds(expMs: number): string {
  const d = new Date(expMs);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function hoursLeft(expMs: number): string {
  const h = Math.floor((expMs - Date.now()) / (60 * 60 * 1000));
  if (h <= 0) return "less than an hour";
  if (h === 1) return "about 1 hour";
  return `about ${h} hours`;
}

function roleLabel(role: RomRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "department_head":
      return "Department head";
    case "teacher":
      return "Teacher";
    default:
      return role;
  }
}

function roleDescription(role: RomRole): string {
  switch (role) {
    case "owner":
      return "Billing, school settings, invites.";
    case "department_head":
      return "Department oversight; invite teachers for this school.";
    case "teacher":
      return "Student reports and exports.";
    default:
      return "";
  }
}

export default async function DashboardPage() {
  const token = (await cookies()).get("rom_session")?.value || "";
  const session = token ? verifySession(token) : null;
  if (!session) redirect("/landing.html");

  let memberships: MembershipWithTenant[] = [];
  let loadError: string | null = null;
  try {
    memberships = await getMembershipsForEmail(session.email);
    memberships.sort((a, b) => a.tenantName.localeCompare(b.tenantName, undefined, { sensitivity: "base" }));
  } catch (e: unknown) {
    loadError = e instanceof Error ? e.message : "Could not load your schools.";
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Report-O-Matic</p>
            <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          </div>
          <form action="/api/auth/sign-out" method="post">
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-5 py-8">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-500">Signed in as</h2>
          <p className="mt-1 break-all font-mono text-sm text-zinc-900">{session.email}</p>
          <p className="mt-3 text-sm text-zinc-600">
            Session ends <span className="font-medium text-zinc-800">{formatSessionEnds(session.exp)}</span>
            <span className="text-zinc-500"> ({hoursLeft(session.exp)} left)</span>
          </p>
        </section>

        {loadError ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            <p className="font-medium">Could not load organisations</p>
            <p className="mt-2 font-mono text-xs">{loadError}</p>
          </section>
        ) : memberships.length === 0 ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-950">
            <p className="font-medium">No school linked yet</p>
            <p className="mt-2 text-amber-900/90">
              Create an account from the landing page (sign up with your school name), or ask an owner or department
              head to add your email from their dashboard.
            </p>
          </section>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-semibold text-zinc-900">Your schools</h2>
              <p className="mt-1 text-sm text-zinc-600">Role and access are per organisation.</p>
              <ul className="mt-4 space-y-3">
                {memberships.map((m) => (
                  <li
                    key={m.membershipId}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-semibold text-zinc-900">{m.tenantName}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{roleDescription(m.role)}</div>
                    </div>
                    <div className="shrink-0">
                      <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-800">
                        {roleLabel(m.role)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {memberships.some((m) => m.role === "owner" || m.role === "department_head") ? (
              <section className="space-y-4">
                <h2 className="text-sm font-semibold text-zinc-900">Invite team</h2>
                <p className="text-sm text-zinc-600">
                  <strong>Owners</strong> can add department heads or teachers. <strong>Department heads</strong> can add
                  teachers only. Everyone signs in with the invited email and a one-time code.
                </p>
                {memberships
                  .filter((m) => m.role === "owner")
                  .map((m) => (
                    <InviteTeamForm
                      key={`owner-${m.tenantId}`}
                      variant="owner"
                      tenantId={m.tenantId}
                      schoolName={m.tenantName}
                    />
                  ))}
                {memberships
                  .filter((m) => m.role === "department_head")
                  .map((m) => (
                    <InviteTeamForm
                      key={`dh-${m.tenantId}`}
                      variant="department_head"
                      tenantId={m.tenantId}
                      schoolName={m.tenantName}
                    />
                  ))}
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
