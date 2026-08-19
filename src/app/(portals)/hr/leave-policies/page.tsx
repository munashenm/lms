import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { LeavePolicyManager } from "@/components/hr/leave-policy-manager";

export default async function LeavePoliciesPage() {
  const session = await getSession();
  const policies = await prisma.leavePolicy.findMany({
    where: getSchoolFilter(session!),
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leave policies</h1>
        <p className="text-muted text-sm mt-1">Entitlements are configurable because statutory rules change by jurisdiction.</p>
      </div>
      <LeavePolicyManager policies={policies} />
    </div>
  );
}
