import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";
import { teacherNav } from "@/lib/navigation";
import { UserRole } from "@prisma/client";

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

  return (
    <PortalShell user={session} navItems={teacherNav} portalLabel="Teacher Portal">
      {children}
    </PortalShell>
  );
}
