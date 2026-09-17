import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { PortalShell } from "@/components/layout/portal-shell";
import { getAdminNav } from "@/lib/navigation";
import { getPortalSessionContext } from "@/lib/portal-session";
import { filterNavByLicense } from "@/lib/licensing/portal";
import { filterNavByModules } from "@/lib/access";
import { enforceForcedPasswordReset } from "@/lib/force-password-reset-server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessAdmin(session.role)) {
    redirect("/login");
  }
  enforceForcedPasswordReset(session);

  const ctx = await getPortalSessionContext(session);
  const nav = await filterNavByModules(
    filterNavByLicense(
      getAdminNav(ctx.terminology ?? undefined, {
        vendorTools: session.role === UserRole.SUPER_ADMIN,
        superAdmin: session.role === UserRole.SUPER_ADMIN,
      }),
      ctx.license
    ),
    session,
    ctx.schoolId ?? session.schoolId
  );

  return (
    <PortalShell
      user={session}
      navItems={nav}
      portalLabel="Admin Portal"
      sessions={ctx.sessions}
      viewSessionId={ctx.viewSessionId}
      license={session.role === UserRole.SUPER_ADMIN && !session.schoolId ? null : ctx.license}
      canManageLicense
      branding={ctx.branding}
    >
      {children}
    </PortalShell>
  );
}
