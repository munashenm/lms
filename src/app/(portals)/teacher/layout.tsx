import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";
import { teacherNav } from "@/lib/navigation";
import { UserRole } from "@prisma/client";
import { getPortalSessionContext } from "@/lib/portal-session";
import { isCollegeLike } from "@/lib/terminology";

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
  const nav = teacherNav.map((item) =>
    item.href === "/teacher/classes" && terms
      ? { ...item, label: `My ${terms.classes}` }
      : item
  );

  return (
    <PortalShell
      user={session}
      navItems={nav}
      portalLabel={
        ctx.institutionType && isCollegeLike(ctx.institutionType)
          ? "Lecturer Portal"
          : "Teacher Portal"
      }
      sessions={ctx.sessions}
      viewSessionId={ctx.viewSessionId}
    >
      {children}
    </PortalShell>
  );
}
