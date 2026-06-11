import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/rbac";
import { PortalShell } from "@/components/layout/portal-shell";
import { adminNav } from "@/lib/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessAdmin(session.role)) {
    redirect("/login");
  }

  return (
    <PortalShell user={session} navItems={adminNav} portalLabel="Admin Portal">
      {children}
    </PortalShell>
  );
}
