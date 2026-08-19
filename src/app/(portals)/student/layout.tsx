import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";
import { studentNav } from "@/lib/navigation";
import { UserRole } from "@prisma/client";
import { getPortalSessionContext } from "@/lib/portal-session";
import { filterNavByLicense, isFeatureEnabled } from "@/lib/licensing/portal";
import { PortalUnavailable } from "@/components/enterprise/license-banner";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== UserRole.STUDENT && session.role !== UserRole.SUPER_ADMIN)
  ) {
    redirect("/login");
  }

  const ctx = await getPortalSessionContext(session);
  const terms = ctx.terminology;
  const nav = filterNavByLicense(
    studentNav.map((item) => {
      if (!terms) return item;
      if (item.href === "/student/subjects") return { ...item, label: terms.subjects };
      return item;
    }),
    ctx.license
  );

  return (
    <PortalShell
      user={session}
      navItems={nav}
      portalLabel={`${terms?.student ?? "Student"} Portal`}
      sessions={ctx.sessions}
      viewSessionId={ctx.viewSessionId}
      license={ctx.license}
    >
      {session.role === UserRole.STUDENT && !isFeatureEnabled(ctx.license, "student_portal") ? (
        <PortalUnavailable moduleName="The student portal" />
      ) : (
        children
      )}
    </PortalShell>
  );
}
