import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getTeacherForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { AssessmentForm } from "@/components/assessments/assessment-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function TeacherAssessmentsPage() {
  const session = await getSession();
  const teacher = await getTeacherForSession(session!);

  const [assessments, subjects, terms] = await Promise.all([
    teacher
      ? prisma.assessment.findMany({
          where: { teacherId: teacher.id },
          include: {
            subject: { select: { code: true, name: true } },
            _count: { select: { marks: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.subject.findMany({
      where: session!.schoolId ? { schoolId: session!.schoolId, isActive: true } : {},
      orderBy: { name: "asc" },
    }),
    prisma.term.findMany({
      where: { isCurrent: true, academicYear: session!.schoolId ? { schoolId: session!.schoolId } : {} },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Assessments</h1>
          <p className="text-muted text-sm mt-1">Create tests and capture marks</p>
        </div>
        <AssessmentForm
          subjects={subjects.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
          terms={terms.map((t) => ({ id: t.id, name: t.name }))}
        />
      </div>

      <Card className="overflow-hidden">
        {assessments.length === 0 ? (
          <CardContent className="py-12 text-center text-muted">No assessments yet.</CardContent>
        ) : (
          <div className="divide-y divide-border">
            {assessments.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{a.title}</p>
                    <Badge variant="secondary">{a.type}</Badge>
                    <Badge variant={a.isPublished ? "success" : "secondary"}>
                      {a.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {a.subject?.code} · {a._count.marks} marks captured
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link href={`/teacher/assessments/${a.id}`}>Enter Marks</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
