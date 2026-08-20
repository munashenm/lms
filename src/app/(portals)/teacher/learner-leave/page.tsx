import { getSession } from "@/lib/auth";
import { getTeacherForSession, classIdsForTeacher } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { LearnerLeaveReviewList } from "@/components/learner/leave-review-list";

export default async function TeacherLearnerLeavePage() {
  const session = await getSession();
  const teacher = await getTeacherForSession(session!);
  const classIds = new Set(classIdsForTeacher(teacher));

  const requests = teacher
    ? await prisma.studentAbsenceRequest.findMany({
        where: {
          schoolId: teacher.schoolId,
          student: { classId: { in: [...classIds] } },
        },
        include: {
          student: { select: { firstName: true, lastName: true, studentNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Learner Leave</h1>
        <p className="text-muted text-sm mt-1">Review absence requests from learners in your classes.</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <LearnerLeaveReviewList requests={requests} />
        </CardContent>
      </Card>
    </div>
  );
}
