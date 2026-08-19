import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { TimesheetManager } from "@/components/hr/timesheet-manager";

export default async function HrTimesheetsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const [timesheets, employees] = await Promise.all([
    prisma.timesheet.findMany({
      where: { employee: filter },
      include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: { periodStart: "desc" },
      take: 100,
    }),
    prisma.employee.findMany({
      where: { ...filter, status: { not: "TERMINATED" } },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true },
      orderBy: { lastName: "asc" },
    }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timesheets</h1>
        <p className="text-muted text-sm mt-1">Approved hours feed hourly payroll. Biometric clocks can post into the same timesheet table later.</p>
      </div>
      <TimesheetManager timesheets={timesheets} employees={employees} />
    </div>
  );
}
