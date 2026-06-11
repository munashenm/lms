import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";
import { parentNav } from "@/lib/navigation";
import { UserRole } from "@prisma/client";

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

  return (
    <PortalShell user={session} navItems={parentNav} portalLabel="Parent Portal">
      {children}
    </PortalShell>
  );
}
