import { AssessmentType } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { ChildFilter } from "@/components/finance/child-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { examWindow } from "@/lib/learner-portal";
import { formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentExamsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const { studentId } = await searchParams;
  const children = guardian?.students.map((sg) => sg.student) ?? [];
  const childIds = children.map((c) => c.id);
  const schoolId = session?.schoolId ?? guardian?.schoolId;
  const now = new Date();

  const exams = schoolId
    ? await prisma.assessment.findMany({
        where: {
          isPublished: true,
          type: AssessmentType.EXAM,
          OR: [
            { subject: { schoolId } },
            { module: { course: { schoolId } } },
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
        <h1 className="text-2xl font-bold">Examinations</h1>
        <p className="text-muted text-sm mt-1">
          Published examinations for linked children: dates, venues and office instructions. Learners
          sit papers in the student portal when the school has opened an online sitting.
        </p>
      </div>

      <ChildFilter
        students={children.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
        }))}
        selectedId={studentId && childIds.includes(studentId) ? studentId : undefined}
        basePath="/parent/exams"
      />

      {(["AVAILABLE", "UPCOMING", "COMPLETED"] as const).map((key) => (
        <section key={key} className="space-y-3">
          <h2 className="text-lg font-semibold">
            {key === "AVAILABLE" ? "Available now" : key === "UPCOMING" ? "Upcoming" : "Completed"}
          </h2>
          {grouped[key].length === 0 ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted">None in this category.</CardContent>
            </Card>
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
                    <p className="text-muted whitespace-pre-wrap">
                      {exam.description || "Follow the school’s instructions for this sitting."}
                    </p>
                  ) : key === "UPCOMING" ? (
                    <p className="text-muted">
                      Venue and office instructions will be confirmed when the sitting opens.
                    </p>
                  ) : (
                    <p className="text-muted">
                      This sitting has closed. Results appear under Results once published.
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
