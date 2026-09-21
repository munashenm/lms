import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";
import { canApplyForLeave } from "@/lib/staff-leave-access";
import { ROLE_DASHBOARD } from "@/lib/constants";
import { financeNav, getAdminNav, getTeacherNav, hrNav, staffNav } from "@/lib/navigation";
import { getPortalSessionContext } from "@/lib/portal-session";
import { filterNavByLicense } from "@/lib/licensing/portal";
import { isCollegeLike } from "@/lib/terminology";
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
  const terms = ctx.terminology ?? undefined;
  const homeNav =
    session.role === UserRole.TEACHER
      ? getTeacherNav(terms)
      : session.role === UserRole.FINANCE_OFFICER
        ? financeNav
        : session.role === UserRole.HR_OFFICER
          ? hrNav
          : session.role === UserRole.STAFF
            ? staffNav
            : getAdminNav(terms, {
                superAdmin: session.role === UserRole.SUPER_ADMIN,
                vendorTools: session.role === UserRole.SUPER_ADMIN,
              });
  const portalLabel =
    session.role === UserRole.TEACHER
      ? ctx.institutionType && isCollegeLike(ctx.institutionType)
        ? "Lecturer Portal"
        : "Educator Portal"
      : session.role === UserRole.FINANCE_OFFICER
        ? "Finance Portal"
        : session.role === UserRole.HR_OFFICER
          ? "HR Portal"
          : session.role === UserRole.STAFF
            ? "Staff"
            : "Admin Portal";

  return (
    <PortalShell
      user={session}
      navItems={filterNavByLicense(homeNav, ctx.license)}
      portalLabel={portalLabel}
      sessions={ctx.sessions}
      viewSessionId={ctx.viewSessionId}
      license={ctx.license}
      branding={ctx.branding}
    >
      {session.role === UserRole.STAFF ? (
        <div className="mb-6">
          <Link
            href={ROLE_DASHBOARD[session.role]}
            className="text-sm text-muted hover:text-primary"
          >
            ← Back to dashboard
          </Link>
        </div>
      ) : null}
      {children}
    </PortalShell>
  );
}
