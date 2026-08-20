import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { LearnerLeaveReviewList } from "@/components/learner/leave-review-list";

export default async function AdminLearnerLeavePage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const requests = await prisma.studentAbsenceRequest.findMany({
    where: filter,
    include: {
      student: { select: { firstName: true, lastName: true, studentNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Student absent request</h1>
        <p className="text-muted text-sm mt-1">
          {requests.filter((r) => r.status === "PENDING").length} pending student absent requests
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          <LearnerLeaveReviewList requests={requests} />
        </CardContent>
      </Card>
    </div>
  );
}
