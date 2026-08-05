import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/rbac";
import { PortalShell } from "@/components/layout/portal-shell";
import { getAdminNav } from "@/lib/navigation";
import { getPortalSessionContext } from "@/lib/portal-session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessAdmin(session.role)) {
    redirect("/login");
  }

  const ctx = await getPortalSessionContext(session);

  return (
    <PortalShell
      user={session}
      navItems={getAdminNav(ctx.terminology ?? undefined)}
      portalLabel="Admin Portal"
      sessions={ctx.sessions}
      viewSessionId={ctx.viewSessionId}
    >
      {children}
    </PortalShell>
  );
}
