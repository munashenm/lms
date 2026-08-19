import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { PayrollManager } from "@/components/hr/payroll-manager";

export default async function AdminPayrollPage() {
  const session = await getSession();
  const runs = await prisma.payrollRun.findMany({
    where: getSchoolFilter(session!),
    orderBy: { periodStart: "desc" },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payroll</h1>
        <p className="text-muted text-sm mt-1">Finalising a run posts salary expenses to Finance with the payroll run ID.</p>
      </div>
      <PayrollManager
        runs={runs.map((r) => ({
          id: r.id,
          status: r.status,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          totalGross: r.totalGross,
          totalNet: r.totalNet,
          totalEmployer: r.totalEmployer,
        }))}
      />
    </div>
  );
}
