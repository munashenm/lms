import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function StudentLessonPlansPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);

  const plans = student
    ? await prisma.lessonPlan.findMany({
        where: {
          schoolId: student.schoolId,
          isPublished: true,
          OR: [{ classId: student.classId }, { classId: null }],
        },
        include: {
          subject: { select: { name: true, code: true } },
          teacher: { select: { firstName: true, lastName: true } },
          term: { select: { name: true } },
        },
        orderBy: { lessonDate: "desc" },
      })
    : [];

  const bySubject = new Map<string, typeof plans>();
  for (const plan of plans) {
    const list = bySubject.get(plan.subject.name) ?? [];
    list.push(plan);
    bySubject.set(plan.subject.name, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lesson Plan</h1>
        <p className="text-muted text-sm mt-1">Read-only lesson information published by your teachers.</p>
      </div>
      {bySubject.size === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted">No lesson plans have been published for your class yet.</CardContent></Card>
      ) : (
        [...bySubject.entries()].map(([subject, items]) => (
          <section key={subject} className="space-y-3">
            <h2 className="text-lg font-semibold">{subject}</h2>
            {items.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <CardTitle className="text-base">{plan.title}</CardTitle>
                  <p className="text-xs text-muted">
                    {formatDate(plan.lessonDate)}
                    {plan.weekNumber ? ` · Week ${plan.weekNumber}` : ""}
                    {plan.term ? ` · ${plan.term.name}` : ""}
                    {` · ${plan.teacher.firstName} ${plan.teacher.lastName}`}
                  </p>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p><span className="text-muted">Topic:</span> {plan.topic}</p>
                  {plan.objective ? <p><span className="text-muted">Objective:</span> {plan.objective}</p> : null}
                  {plan.resources ? <p><span className="text-muted">Resources:</span> {plan.resources}</p> : null}
                  {plan.readingMaterial ? <p><span className="text-muted">Reading:</span> {plan.readingMaterial}</p> : null}
                </CardContent>
              </Card>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
