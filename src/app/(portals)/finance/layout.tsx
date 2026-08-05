import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { PortalShell } from "@/components/layout/portal-shell";
import { financeNav } from "@/lib/navigation";
import { getPortalSessionContext } from "@/lib/portal-session";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessFinance(session.role)) {
    redirect("/login");
  }

  const ctx = await getPortalSessionContext(session);

  return (
    <PortalShell
      user={session}
      navItems={financeNav}
      portalLabel="Finance Portal"
      sessions={ctx.sessions}
      viewSessionId={ctx.viewSessionId}
    >
      {children}
    </PortalShell>
  );
}
