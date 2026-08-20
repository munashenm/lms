import { AssessmentType } from "@prisma/client";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { examWindow } from "@/lib/learner-portal";
import { formatDate } from "@/lib/utils";
import { evaluateStoredLicense } from "@/lib/licensing/service";
import { isFeatureEnabled } from "@/lib/licensing/portal";

export default async function StudentExamsPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const now = new Date();

  const [exams, license] = student
    ? await Promise.all([
        prisma.assessment.findMany({
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
            _count: { select: { questions: true } },
            attempts: { where: { studentId: student.id }, select: { status: true, score: true } },
          },
          orderBy: { dueDate: "asc" },
        }),
        evaluateStoredLicense(student.schoolId).catch(() => null),
      ])
    : [[], null];
  const canSit = isFeatureEnabled(license, "online_exams");

  const grouped = {
    UPCOMING: [] as typeof exams,
    AVAILABLE: [] as typeof exams,
    COMPLETED: [] as typeof exams,
  };
  for (const exam of exams) {
    const submitted = exam.attempts[0]?.status === "SUBMITTED";
    const window = examWindow({
      availableFrom: exam.availableFrom,
      dueDate: exam.dueDate,
      completed: submitted || Boolean(exam.dueDate && exam.dueDate < now),
      now,
    });
    grouped[window].push(exam);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Examinations</h1>
        <p className="text-muted text-sm mt-1">
          Published examinations for your programme. Sit a paper online when it is open and
          questions have been added.
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
                    <>
                      <p className="text-muted whitespace-pre-wrap">{exam.description || "Follow your teacher’s instructions to sit this exam."}</p>
                      {canSit && exam._count.questions > 0 ? (
                        <Button size="sm" className="mt-3" asChild>
                          <Link href={`/student/exams/${exam.id}`}>
                            {exam.attempts[0]?.status === "IN_PROGRESS" ? "Continue exam" : "Sit this exam"}
                          </Link>
                        </Button>
                      ) : (
                        <p className="text-muted">Online sitting is not open for this paper yet.</p>
                      )}
                    </>
                  ) : key === "UPCOMING" ? (
                    <p className="text-muted">Venue and office instructions will be confirmed when the sitting opens.</p>
                  ) : (
                    <p className="text-muted">
                      {exam.attempts[0]?.status === "SUBMITTED" && exam.attempts[0].score != null
                        ? `Submitted. Score ${Number(exam.attempts[0].score)} / ${Number(exam.maxMarks)}.`
                        : "This sitting has closed. Results appear under Results once published."}
                    </p>
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
