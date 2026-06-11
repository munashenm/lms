import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubjectsManager } from "@/components/academics/subjects-manager";

export default async function SubjectsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const [grades, subjects, courses] = await Promise.all([
    prisma.grade.findMany({
      where: { ...filter, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { subjects: true, students: true } } },
    }),
    prisma.subject.findMany({
      where: { ...filter, isActive: true },
      include: { grade: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.course.findMany({
      where: { ...filter, isActive: true },
      include: { modules: { orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subjects & Courses</h1>
        <p className="text-muted text-sm mt-1">
          Manage CAPS subjects, grades, and TVET courses/modules
        </p>
      </div>

      <SubjectsManager
        grades={grades}
        subjects={subjects}
        courses={courses}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Grades ({grades.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {grades.map((g) => (
              <div key={g.id} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                <span>{g.name}</span>
                <span className="text-muted">{g._count.students} students</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Subjects ({subjects.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {subjects.map((s) => (
              <div key={s.id} className="text-sm py-1 border-b border-border last:border-0">
                <span className="font-medium">{s.code}</span> — {s.name}
                {s.grade && <span className="text-muted text-xs block">{s.grade.name}</span>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Courses ({courses.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {courses.map((c) => (
              <div key={c.id} className="text-sm py-1 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.code}</span>
                  {c.nqfLevel && <Badge variant="accent">NQF {c.nqfLevel}</Badge>}
                </div>
                <p>{c.name}</p>
                <p className="text-xs text-muted mt-1">{c.modules.length} modules</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
