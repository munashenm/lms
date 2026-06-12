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
      </div>
      <LeaveReview leaveRequests={leaveRequests} admin />
    </div>
  );
}
