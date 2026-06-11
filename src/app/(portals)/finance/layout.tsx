import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { PortalShell } from "@/components/layout/portal-shell";
import { financeNav } from "@/lib/navigation";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessFinance(session.role)) {
    redirect("/login");
  }

  return (
    <PortalShell user={session} navItems={financeNav} portalLabel="Finance Portal">
      {children}
    </PortalShell>
  );
}
