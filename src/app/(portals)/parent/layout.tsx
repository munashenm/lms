import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";
import { parentNav } from "@/lib/navigation";
import { UserRole } from "@prisma/client";
import { getPortalSessionContext } from "@/lib/portal-session";

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

  const ctx = await getPortalSessionContext(session);

  return (
    <PortalShell
      user={session}
      navItems={parentNav}
      portalLabel={`${ctx.terminology?.guardian ?? "Parent"} Portal`}
      sessions={ctx.sessions}
      viewSessionId={ctx.viewSessionId}
    >
      {children}
    </PortalShell>
  );
}
