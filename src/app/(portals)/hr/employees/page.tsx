import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { EmployeeManager } from "@/components/hr/employee-manager";

export default async function HrEmployeesPage() {
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
        <p className="text-muted text-sm mt-1">One employee record for educators, admin, finance, HR, operations and other staff.</p>
      </div>
      <EmployeeManager employees={employees} />
    </div>
  );
}
