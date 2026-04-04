"use client";

type Props = {
  email: string;
  /** Localised label for the user’s role(s) in the current context. */
  roleLabel: string;
};

export function AppHeaderUserIdentity({ email, roleLabel }: Props) {
  if (!email.trim()) return null;
  return (
    <div className="flex min-w-0 flex-col items-end gap-1 text-right">
      <span className="max-w-[min(100%,14rem)] break-all font-mono text-[11px] leading-snug text-zinc-700 sm:max-w-[22rem]">
        {email.trim()}
      </span>
      {roleLabel.trim() ? (
        <span className="inline-flex max-w-full rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-950">
          {roleLabel.trim()}
        </span>
      ) : null}
    </div>
  );
}
