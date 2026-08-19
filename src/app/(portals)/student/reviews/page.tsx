import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { TeacherReviewForm } from "@/components/learner/review-form";
import { formatDate } from "@/lib/utils";

export default async function StudentReviewsPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);

  const [classTeachers, classSubjects, reviews] = student
    ? await Promise.all([
        student.classId
          ? prisma.classTeacher.findMany({
              where: { classId: student.classId },
              include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
            })
          : Promise.resolve([]),
        student.classId
          ? prisma.classSubject.findMany({
              where: { classId: student.classId, teacherId: { not: null } },
              include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
            })
          : Promise.resolve([]),
        prisma.teacherReview.findMany({
          where: { studentId: student.id },
          include: { teacher: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], [], []];

  const teachers = new Map<string, { id: string; firstName: string; lastName: string }>();
  for (const row of classTeachers) teachers.set(row.teacher.id, row.teacher);
  for (const row of classSubjects) if (row.teacher) teachers.set(row.teacher.id, row.teacher);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teacher Reviews</h1>
        <p className="text-muted text-sm mt-1">
          Feedback is limited to teachers currently assigned to your class.
          {student?.school.teacherReviewsAnonymous ? " Submissions are anonymous to the teacher." : ""}
        </p>
      </div>
      <TeacherReviewForm
        teachers={[...teachers.values()]}
        anonymous={Boolean(student?.school.teacherReviewsAnonymous)}
      />
      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {reviews.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">You have not submitted any reviews yet.</p>
          ) : (
            reviews.map((row) => (
              <div key={row.id} className="px-4 py-3 text-sm">
                <p className="font-medium">
                  {row.teacher.firstName} {row.teacher.lastName} · {row.periodKey}
                </p>
                <p className="text-muted">Overall {row.overall}/5 · {formatDate(row.createdAt)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
