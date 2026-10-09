import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { listMissingCheckouts } from "@/lib/gate/queries";
import { MissingCheckoutList } from "@/components/security/missing-checkouts";

export default async function MissingCheckoutsPage() {
  const session = await getSession();
  if (!session?.schoolId || !requirePermission(session, "gate:read")) redirect("/login");
  const missing = await listMissingCheckouts(session.schoolId);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Missing checkouts</h1>
      <MissingCheckoutList boundary={missing.boundary} rows={missing.rows} />
    </div>
  );
}
