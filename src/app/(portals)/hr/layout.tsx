import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessHr } from "@/lib/rbac";
import { PortalShell } from "@/components/layout/portal-shell";
import { hrNav } from "@/lib/navigation";
import { getPortalSessionContext } from "@/lib/portal-session";
import { filterNavByLicense, isFeatureEnabled } from "@/lib/licensing/portal";
import { PortalUnavailable } from "@/components/enterprise/license-banner";

export default async function HrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessHr(session.role)) {
    redirect("/login");
  }

  const ctx = await getPortalSessionContext(session);

  return (
    <PortalShell
      user={session}
      navItems={filterNavByLicense(hrNav, ctx.license)}
      portalLabel="HR Portal"
      sessions={ctx.sessions}
      viewSessionId={ctx.viewSessionId}
      license={ctx.license}
      canManageLicense
    >
      {!isFeatureEnabled(ctx.license, "hr_payroll") ? (
        <PortalUnavailable moduleName="HR & Payroll" />
      ) : (
        children
      )}
    </PortalShell>
  );
}
