import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { curriculumProgress } from "@/lib/learner-portal";

export default async function StudentProgressPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const subjectIds = student?.classId
    ? (
        await prisma.classSubject.findMany({
          where: { classId: student.classId },
          select: { subjectId: true },
        })
      ).map((row) => row.subjectId)
    : [];

  const topics = student
    ? await prisma.curriculumTopic.findMany({
        where: {
          schoolId: student.schoolId,
          ...(subjectIds.length ? { subjectId: { in: subjectIds } } : { id: "__none__" }),
          OR: [{ classId: student.classId }, { classId: null }],
        },
        include: { subject: { select: { id: true, name: true, code: true } } },
        orderBy: { sortOrder: "asc" },
      })
    : [];

  const grouped = new Map<string, { id: string; name: string; code: string; topics: typeof topics }>();
  for (const topic of topics) {
    const current = grouped.get(topic.subjectId) ?? {
      id: topic.subject.id,
      name: topic.subject.name,
      code: topic.subject.code,
      topics: [],
    };
    current.topics.push(topic);
    grouped.set(topic.subjectId, current);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Curriculum Progress</h1>
        <p className="text-muted text-sm mt-1">Topic completion tracked by your teachers. This is not editable by learners.</p>
      </div>
      {grouped.size === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted">No curriculum topics have been published for your subjects yet.</CardContent></Card>
      ) : (
        [...grouped.values()].map((subject) => {
          const progress = curriculumProgress(subject.topics);
          return (
            <Card key={subject.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  <Link href={`/student/subjects/${subject.id}`} className="hover:text-primary">
                    {subject.name}
                  </Link>
                </CardTitle>
                <p className="text-sm text-muted">
                  Topics completed: {progress.completed} / {progress.total} · {progress.percentage}%
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {subject.topics.map((topic) => (
                  <div key={topic.id} className="flex justify-between text-sm">
                    <span>{topic.title}</span>
                    <Badge variant={topic.status === "COMPLETED" ? "success" : topic.status === "CURRENT" ? "warning" : "secondary"}>
                      {topic.status === "PLANNED" ? "Upcoming" : topic.status === "CURRENT" ? "Current" : "Completed"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
