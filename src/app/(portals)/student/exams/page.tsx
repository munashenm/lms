import { AssessmentType } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { examWindow } from "@/lib/learner-portal";
import { formatDate } from "@/lib/utils";

export default async function StudentExamsPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const now = new Date();

  const exams = student
    ? await prisma.assessment.findMany({
        where: {
          isPublished: true,
          type: AssessmentType.EXAM,
          OR: [
            { subject: { schoolId: student.schoolId } },
            { module: { course: { schoolId: student.schoolId } } },
          ],
        },
        include: {
          subject: { select: { name: true } },
          teacher: { select: { firstName: true, lastName: true } },
        },
        orderBy: { dueDate: "asc" },
      })
    : [];

  const grouped = {
    UPCOMING: [] as typeof exams,
    AVAILABLE: [] as typeof exams,
    COMPLETED: [] as typeof exams,
  };
  for (const exam of exams) {
    const window = examWindow({
      availableFrom: exam.availableFrom,
      dueDate: exam.dueDate,
      completed: Boolean(exam.dueDate && exam.dueDate < now),
      now,
    });
    grouped[window].push(exam);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Online Exams</h1>
        <p className="text-muted text-sm mt-1">
          Published examinations for your programme. Questions are not shown before the start time.
        </p>
      </div>
      {(["AVAILABLE", "UPCOMING", "COMPLETED"] as const).map((key) => (
        <section key={key} className="space-y-3">
          <h2 className="text-lg font-semibold">
            {key === "AVAILABLE" ? "Available now" : key === "UPCOMING" ? "Upcoming" : "Completed"}
          </h2>
          {grouped[key].length === 0 ? (
            <Card><CardContent className="py-8 text-sm text-muted">None in this category.</CardContent></Card>
          ) : (
            grouped[key].map((exam) => (
              <Card key={exam.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{exam.title}</CardTitle>
                    <Badge variant={key === "AVAILABLE" ? "success" : "secondary"}>{key}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>{exam.subject?.name ?? "Exam"}</p>
                  <p className="text-muted">
                    {exam.dueDate ? formatDate(exam.dueDate) : "Date TBC"}
                    {exam.durationMinutes ? ` · ${exam.durationMinutes} minutes` : ""}
                    {exam.venue ? ` · ${exam.venue}` : ""}
                  </p>
                  {key === "AVAILABLE" ? (
                    <p className="text-muted whitespace-pre-wrap">{exam.description || "Follow your teacher’s instructions to sit this exam."}</p>
                  ) : key === "UPCOMING" ? (
                    <p className="text-muted">Instructions and questions will be available when the exam opens.</p>
                  ) : (
                    <p className="text-muted">This sitting has closed. Results appear under Results once published.</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </section>
      ))}
    </div>
  );
}
