import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";
import { getParentNav } from "@/lib/navigation";
import { UserRole } from "@prisma/client";
import { getPortalSessionContext } from "@/lib/portal-session";
import { filterNavByLicense, isFeatureEnabled } from "@/lib/licensing/portal";
import { PortalUnavailable } from "@/components/enterprise/license-banner";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== UserRole.PARENT && session.role !== UserRole.SUPER_ADMIN)
  ) {
    redirect("/login");
  }

  const ctx = await getPortalSessionContext(session);

  return (
    <PortalShell
      user={session}
      navItems={filterNavByLicense(getParentNav(ctx.terminology ?? undefined), ctx.license)}
      portalLabel={`${ctx.terminology?.guardian ?? "Parent"} Portal`}
      sessions={ctx.sessions}
      viewSessionId={ctx.viewSessionId}
      license={ctx.license}
      branding={ctx.branding}
    >
      {session.role === UserRole.PARENT && !isFeatureEnabled(ctx.license, "parent_portal") ? (
        <PortalUnavailable moduleName="The parent portal" />
      ) : (
        children
      )}
    </PortalShell>
  );
}
