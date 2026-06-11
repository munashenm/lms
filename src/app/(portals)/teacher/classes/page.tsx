import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getTeacherForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function TeacherClassesPage() {
  const session = await getSession();
  const teacher = await getTeacherForSession(session!);

  const classes = teacher
    ? await prisma.class.findMany({
        where: {
          id: { in: teacher.classTeachers.map((ct) => ct.classId) },
        },
        include: {
          grade: { select: { name: true } },
          classSubjects: {
            include: { subject: { select: { name: true, code: true } } },
          },
          _count: { select: { students: true } },
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Classes</h1>
        <p className="text-muted text-sm mt-1">{classes.length} assigned classes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {classes.map((cls) => (
          <Card key={cls.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{cls.name}</h3>
                  <p className="text-sm text-muted">{cls.grade?.name}</p>
                </div>
                <Badge>{cls._count.students} students</Badge>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-muted mb-2">Subjects</p>
                <div className="flex flex-wrap gap-1.5">
                  {cls.classSubjects.map((cs) => (
                    <Badge key={cs.id} variant="secondary">
                      {cs.subject.code}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" asChild>
                  <Link href={`/teacher/attendance?classId=${cls.id}`}>Take Attendance</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {classes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            No classes assigned to you yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
