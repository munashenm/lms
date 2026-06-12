import { getSession } from "@/lib/auth";
import { getTeacherForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { LeaveRequestForm } from "@/components/hr/leave-request-form";
import { LeaveReview } from "@/components/hr/leave-review";

export default async function TeacherLeavePage() {
  const session = await getSession();
  const teacher = await getTeacherForSession(session!);

  const leaveRequests = teacher
    ? await prisma.leaveRequest.findMany({
        where: { teacherId: teacher.id },
        include: {
          teacher: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Leave</h1>
        <p className="text-muted text-sm mt-1">Submit and track your leave applications</p>
      </div>
      <LeaveRequestForm />
      <LeaveReview leaveRequests={leaveRequests} />
    </div>
  );
}
