import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { FeeScheduleManager } from "@/components/finance/fee-schedule-manager";

export default async function FinanceFeeSchedulePage() {
  const session = await getSession();
  if (!session || !requirePermission(session, "finance:write")) {
    redirect("/finance/dashboard");
  }

  const filter = getSchoolFilter(session);
  if (!("schoolId" in filter)) {
    redirect("/finance/dashboard");
  }

  const items = await prisma.feeScheduleItem.findMany({
    where: { schoolId: filter.schoolId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Fee Schedule</h1>
        <p className="text-muted text-sm mt-1">
          Manage published fees and invoice presets for your school
        </p>
      </div>

      <FeeScheduleManager
        schoolId={filter.schoolId}
        items={items.map((item) => ({
          id: item.id,
          name: item.name,
          amount: Number(item.amount),
          notes: item.notes,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
          isPublic: item.isPublic,
        }))}
      />
    </div>
  );
}
