import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";
import { getTeacherNav } from "@/lib/navigation";
import { UserRole } from "@prisma/client";
import { getPortalSessionContext } from "@/lib/portal-session";
import { isCollegeLike } from "@/lib/terminology";
import { filterNavByLicense, isFeatureEnabled } from "@/lib/licensing/portal";
import { PortalUnavailable } from "@/components/enterprise/license-banner";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== UserRole.TEACHER && session.role !== UserRole.SUPER_ADMIN)
  ) {
    redirect("/login");
  }

  const ctx = await getPortalSessionContext(session);
  const terms = ctx.terminology;
  const nav = filterNavByLicense(getTeacherNav(terms ?? undefined), ctx.license);

  return (
    <PortalShell
      user={session}
      navItems={nav}
      portalLabel={
        ctx.institutionType && isCollegeLike(ctx.institutionType)
          ? "Lecturer Portal"
          : "Educator Portal"
      }
      sessions={ctx.sessions}
      viewSessionId={ctx.viewSessionId}
      license={ctx.license}
      branding={ctx.branding}
    >
      {session.role === UserRole.TEACHER && !isFeatureEnabled(ctx.license, "teacher_portal") ? (
        <PortalUnavailable moduleName={terms?.teacher ? `The ${terms.teacher.toLowerCase()} portal` : "The educator portal"} />
      ) : (
        children
      )}
    </PortalShell>
  );
}
