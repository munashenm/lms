import { getSession } from "@/lib/auth";
import { getTeacherForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { CurriculumTopicForm } from "@/components/teacher/curriculum-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurriculumStatusButtons } from "@/components/teacher/curriculum-status-buttons";

export default async function TeacherCurriculumPage() {
  const session = await getSession();
  const teacher = await getTeacherForSession(session!);
  const taught = teacher
    ? await prisma.classSubject.findMany({
        where: { teacherId: teacher.id },
        include: { subject: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
      })
    : [];
  const subjects = new Map(taught.map((row) => [row.subject.id, row.subject]));
  const classes = new Map(taught.map((row) => [row.class.id, row.class]));
  const subjectIds = [...subjects.keys()];

  const topics = teacher
    ? await prisma.curriculumTopic.findMany({
        where: {
          schoolId: teacher.schoolId,
          ...(subjectIds.length ? { subjectId: { in: subjectIds } } : { id: "__none__" }),
        },
        include: { subject: { select: { name: true } }, class: { select: { name: true } } },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Curriculum</h1>
        <p className="text-muted text-sm mt-1">Track completed, current and upcoming topics for learners.</p>
      </div>
      <CurriculumTopicForm subjects={[...subjects.values()]} classes={[...classes.values()]} />
      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {topics.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No topics yet.</p>
          ) : (
            topics.map((topic) => (
              <div key={topic.id} className="px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{topic.title}</p>
                  <p className="text-xs text-muted">{topic.subject.name}{topic.class ? ` · ${topic.class.name}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={topic.status === "COMPLETED" ? "success" : topic.status === "CURRENT" ? "warning" : "secondary"}>
                    {topic.status}
                  </Badge>
                  <CurriculumStatusButtons id={topic.id} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
