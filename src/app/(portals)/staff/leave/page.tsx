import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LeaveRequestForm } from "@/components/hr/leave-request-form";
import { LeaveReview } from "@/components/hr/leave-review";

export default async function StaffLeavePage() {
  const session = await getSession();

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: { userId: session!.userId },
    include: {
      applicant: { select: { firstName: true, lastName: true, role: true, email: true } },
      teacher: { select: { firstName: true, lastName: true, employeeNumber: true, department: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Leave</h1>
        <p className="text-muted text-sm mt-1">
          Apply for leave and upload a sick note for medical absences
        </p>
      </div>
      <LeaveRequestForm />
      <LeaveReview leaveRequests={leaveRequests} />
    </div>
  );
}
