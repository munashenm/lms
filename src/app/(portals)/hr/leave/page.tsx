import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { LeaveReview } from "@/components/hr/leave-review";
import { LeaveCalendar } from "@/components/hr/leave-calendar";

export default async function HrLeavePage() {
  const session = await getSession();
  const leaveRequests = await prisma.leaveRequest.findMany({
    where: getSchoolFilter(session!),
    include: {
      applicant: { select: { firstName: true, lastName: true, role: true, email: true } },
      teacher: { select: { firstName: true, lastName: true, employeeNumber: true, department: true } },
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leave requests</h1>
        <p className="text-muted text-sm mt-1">Approve or reject staff leave. Remaining balances are enforced when a matching policy exists.</p>
      </div>
      <LeaveCalendar
        requests={leaveRequests.map((r) => ({
          id: r.id,
          startDate: r.startDate,
          endDate: r.endDate,
          type: r.type,
          status: r.status,
          name: r.employee
            ? `${r.employee.firstName} ${r.employee.lastName}`
            : r.teacher
              ? `${r.teacher.firstName} ${r.teacher.lastName}`
              : `${r.applicant.firstName} ${r.applicant.lastName}`,
        }))}
      />
      <LeaveReview leaveRequests={leaveRequests} admin />
    </div>
  );
}
