import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { LeaveReview } from "@/components/hr/leave-review";

export default async function HrLeavePage() {
  const session = await getSession();
  const leaveRequests = await prisma.leaveRequest.findMany({
    where: getSchoolFilter(session!),
    include: {
      applicant: { select: { firstName: true, lastName: true, role: true, email: true } },
      teacher: { select: { firstName: true, lastName: true, employeeNumber: true, department: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leave requests</h1>
        <p className="text-muted text-sm mt-1">Approve or reject staff leave. Employees apply from the staff portal.</p>
      </div>
      <LeaveReview leaveRequests={leaveRequests} admin />
    </div>
  );
}
