import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessSecurityPortal } from "@/lib/rbac";
import { ROLE_DASHBOARD } from "@/lib/constants";
import { PortalShell } from "@/components/layout/portal-shell";
import { getSecurityNav } from "@/lib/navigation";
import { getPortalSessionContext } from "@/lib/portal-session";
import { filterNavByModules } from "@/lib/access";
import { enforceForcedPasswordReset } from "@/lib/force-password-reset-server";
import { UserRole } from "@prisma/client";

export default async function SecurityLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canAccessSecurityPortal(session.role)) redirect(ROLE_DASHBOARD[session.role]);
  enforceForcedPasswordReset(session);

  const ctx = await getPortalSessionContext(session);
  const nav = await filterNavByModules(getSecurityNav(), session, ctx.schoolId ?? session.schoolId);

  return (
    <PortalShell
      user={session}
      navItems={nav}
      portalLabel="Security"
      sessions={ctx.sessions}
      viewSessionId={ctx.viewSessionId}
      license={ctx.license}
      branding={ctx.branding}
    >
      {session.role !== UserRole.SECURITY ? (
        <div className="mb-4">
          <Link href={ROLE_DASHBOARD[session.role]} className="text-sm text-muted hover:text-primary">
            ← Back to admin
          </Link>
        </div>
      ) : null}
      {children}
    </PortalShell>
  );
}
