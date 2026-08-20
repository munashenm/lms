import { getSession } from "@/lib/auth";
import { getTeacherForSession, classIdsForTeacher } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { LessonPlanForm } from "@/components/teacher/lesson-plan-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function TeacherLessonPlansPage() {
  const session = await getSession();
  const teacher = await getTeacherForSession(session!);
  const classIds = classIdsForTeacher(teacher);
  const taught = teacher
    ? await prisma.classSubject.findMany({
        where: { teacherId: teacher.id },
        include: { subject: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
      })
    : [];

  const subjects = new Map<string, { id: string; name: string }>();
  const classes = new Map<string, { id: string; name: string }>();
  for (const row of taught) {
    subjects.set(row.subject.id, row.subject);
    classes.set(row.class.id, row.class);
  }
  if (teacher) {
    const assigned = await prisma.class.findMany({
      where: { id: { in: classIds.length ? classIds : ["__none__"] } },
      select: { id: true, name: true },
    });
    for (const cls of assigned) classes.set(cls.id, cls);
  }

  const plans = teacher
    ? await prisma.lessonPlan.findMany({
        where: { teacherId: teacher.id },
        include: { subject: { select: { name: true } }, class: { select: { name: true } } },
        orderBy: { lessonDate: "desc" },
        take: 50,
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lesson Plans</h1>
        <p className="text-muted text-sm mt-1">Publish lesson information for learners in your classes.</p>
      </div>
      <LessonPlanForm subjects={[...subjects.values()]} classes={[...classes.values()]} />
      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {plans.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No lesson plans yet.</p>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="px-4 py-3 text-sm flex justify-between gap-2">
                <div>
                  <p className="font-medium">{plan.title}</p>
                  <p className="text-xs text-muted">
                    {plan.subject.name} · {formatDate(plan.lessonDate)} {plan.class ? `· ${plan.class.name}` : ""}
                  </p>
                </div>
                <Badge variant={plan.isPublished ? "success" : "secondary"}>
                  {plan.isPublished ? "Published" : "Draft"}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
