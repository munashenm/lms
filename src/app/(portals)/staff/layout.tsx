import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";
import { canApplyForLeave } from "@/lib/staff-leave-access";
import { ROLE_DASHBOARD } from "@/lib/constants";
import { staffNav } from "@/lib/navigation";
import { getPortalSessionContext } from "@/lib/portal-session";
import { filterNavByLicense } from "@/lib/licensing/portal";
import { enforceForcedPasswordReset } from "@/lib/force-password-reset-server";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canApplyForLeave(session.role)) {
    redirect("/login");
  }
  enforceForcedPasswordReset(session);

  const ctx = await getPortalSessionContext(session);

  return (
    <PortalShell
      user={session}
      navItems={filterNavByLicense(staffNav, ctx.license)}
      portalLabel="Staff"
      sessions={ctx.sessions}
      viewSessionId={ctx.viewSessionId}
      license={ctx.license}
      branding={ctx.branding}
    >
      <div className="mb-6">
        <Link
          href={ROLE_DASHBOARD[session.role]}
          className="text-sm text-muted hover:text-primary"
        >
          ← Back to dashboard
        </Link>
      </div>
      {children}
    </PortalShell>
  );
}
