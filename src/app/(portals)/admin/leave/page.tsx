import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { LeaveReview } from "@/components/hr/leave-review";

export default async function AdminLeavePage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: filter,
    include: {
      applicant: { select: { firstName: true, lastName: true, role: true, email: true } },
      teacher: { select: { firstName: true, lastName: true, employeeNumber: true, department: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pending = leaveRequests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff Leave</h1>
        <p className="text-muted text-sm mt-1">
          {leaveRequests.length} requests · {pending} pending approval
        </p>
        <p className="text-xs text-muted mt-1">
          Staff apply at <a href="/staff/leave" className="text-primary hover:underline">/staff/leave</a>
        </p>
      </div>
      <LeaveReview leaveRequests={leaveRequests} admin />
    </div>
  );
}
