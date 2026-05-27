"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppHeaderSignOutButton } from "@/components/layout/AppHeaderSignOutButton";
import { GlobeLanguageSwitcher } from "@/components/i18n/GlobeLanguageSwitcher";
import { SaasOwnerSupportHeaderButton } from "@/components/support/SaasOwnerSupportHeaderButton";
import { SupportMessenger } from "@/components/support/SupportMessenger";
import { DisplayModeSwitcher } from "@/components/ui/DisplayModeSwitcher";

type Props = {
  tenantId?: string | null;
  children?: ReactNode;
  /** Renders Sign out as the rightmost header control (Contact Support sits just left). */
  showSignOut?: boolean;
};

/** Standard top-right header: nav links, language, display, Contact Support, Sign out (far right). */
export function AppHeaderRightControls({ tenantId = null, children, showSignOut = false }: Props) {
  const pathname = usePathname();
  const ownerInbox = pathname?.startsWith("/saas-owner") ?? false;

  return (
    <div className="flex w-full min-w-0 flex-1 flex-wrap items-stretch justify-end gap-2 sm:w-auto sm:flex-nowrap">
      {children}
      <GlobeLanguageSwitcher />
      <DisplayModeSwitcher />
      {ownerInbox ? <SaasOwnerSupportHeaderButton /> : <SupportMessenger tenantId={tenantId} />}
      {showSignOut ? <AppHeaderSignOutButton /> : null}
    </div>
  );
}
