import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";
import { studentNav } from "@/lib/navigation";
import { UserRole } from "@prisma/client";

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

  return (
    <PortalShell user={session} navItems={studentNav} portalLabel="Student Portal">
      {children}
    </PortalShell>
  );
}
