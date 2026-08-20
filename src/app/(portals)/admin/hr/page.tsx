import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { EmployeeManager } from "@/components/hr/employee-manager";
import { getSchoolFilter } from "@/lib/rbac";

export default async function AdminHrPage() {
  const session = await getSession();
  const employees = await prisma.employee.findMany({
    where: getSchoolFilter(session!),
    include: {
      campus: { select: { name: true } },
      salaryStructures: { orderBy: { effectiveFrom: "desc" }, take: 1 },
    },
    orderBy: { lastName: "asc" },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Employees</h1>
        <p className="text-muted text-sm mt-1">All institution employees — not teachers only. Attach ID, contract and other documents when adding a record.</p>
      </div>
      <EmployeeManager employees={employees} />
    </div>
  );
}
