import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, hasPermission } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubjectsManager } from "@/components/academics/subjects-manager";
import { StructureRecordRow } from "@/components/academics/structure-record-row";

export default async function SubjectsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const canWrite = hasPermission(session!.role, "classes:write");

  const [grades, subjects, courses] = await Promise.all([
    prisma.grade.findMany({
      where: filter,
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { subjects: true, students: true } } },
    }),
    prisma.subject.findMany({
      where: filter,
      include: { grade: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.course.findMany({
      where: filter,
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
        grades={grades.filter((g) => g.isActive)}
        subjects={subjects.filter((s) => s.isActive)}
        courses={courses.filter((c) => c.isActive)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Grades ({grades.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {grades.map((g) => (
              <StructureRecordRow
                key={g.id}
                endpoint={`/api/grades/${g.id}`}
                name={g.name}
                extra={`${g._count.students} students`}
                isActive={g.isActive}
                canWrite={canWrite}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Subjects ({subjects.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {subjects.map((s) => (
              <StructureRecordRow
                key={s.id}
                endpoint={`/api/subjects/${s.id}`}
                name={s.name}
                extra={`${s.code}${s.grade ? ` · ${s.grade.name}` : ""}`}
                isActive={s.isActive}
                canWrite={canWrite}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Courses ({courses.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {courses.map((c) => (
              <StructureRecordRow
                key={c.id}
                endpoint={`/api/courses/${c.id}`}
                name={c.name}
                extra={`${c.code}${c.nqfLevel ? ` · NQF ${c.nqfLevel}` : ""} · ${c.modules.length} modules`}
                isActive={c.isActive}
                canWrite={canWrite}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
