import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { CardAdmin } from "@/components/security/gate-admin";

export default async function CardsPage() {
  const session = await getSession();
  if (!session?.schoolId || !requirePermission(session, "cards:manage")) redirect("/admin/dashboard");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">SchoolHub cards</h1>
      <p className="text-sm text-muted">
        Cards encode an opaque token. A deactivated card fails the next scan. Issuing a new card replaces the previous token.
      </p>
      <CardAdmin />
    </div>
  );
}
