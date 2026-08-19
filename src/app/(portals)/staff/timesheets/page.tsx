import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { TimesheetManager } from "@/components/hr/timesheet-manager";

export default async function StaffTimesheetsPage() {
  const session = await getSession();
  const employee = await prisma.employee.findFirst({
    where: { userId: session!.userId, ...(session!.schoolId ? { schoolId: session!.schoolId } : {}) },
  });
  const timesheets = employee
    ? await prisma.timesheet.findMany({
        where: { employeeId: employee.id },
        include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
        orderBy: { periodStart: "desc" },
      })
    : [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My timesheets</h1>
        <p className="text-muted text-sm mt-1">Submit hours for hourly pay. HR approves before payroll uses them.</p>
      </div>
      <TimesheetManager timesheets={timesheets} selfService />
    </div>
  );
}
