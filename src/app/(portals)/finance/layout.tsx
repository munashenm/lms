import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { PortalShell } from "@/components/layout/portal-shell";
import { financeNav } from "@/lib/navigation";
import { getPortalSessionContext } from "@/lib/portal-session";
import { filterNavByLicense, isFeatureEnabled } from "@/lib/licensing/portal";
import { PortalUnavailable } from "@/components/enterprise/license-banner";

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
      navItems={filterNavByLicense(financeNav, ctx.license)}
      portalLabel="Finance Portal"
      sessions={ctx.sessions}
      viewSessionId={ctx.viewSessionId}
      license={ctx.license}
      canManageLicense
    >
      {!isFeatureEnabled(ctx.license, "finance") ? (
        <PortalUnavailable moduleName="Finance" />
      ) : (
        children
      )}
    </PortalShell>
  );
}
