import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClassForm } from "@/components/academics/class-form";

export default async function ClassesPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const [classes, grades, campuses, academicYears] = await Promise.all([
    prisma.class.findMany({
      where: { ...filter, isActive: true },
      include: {
        grade: { select: { name: true } },
        campus: { select: { name: true } },
        classTeachers: { include: { teacher: { select: { firstName: true, lastName: true } } } },
        _count: { select: { students: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.grade.findMany({ where: { ...filter, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.campus.findMany({ where: { ...filter, isActive: true } }),
    prisma.academicYear.findMany({ where: filter, orderBy: { name: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Classes</h1>
          <p className="text-muted text-sm mt-1">{classes.length} active classes</p>
        </div>
        <ClassForm
          grades={grades.map((g) => ({ id: g.id, name: g.name }))}
          campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
          academicYears={academicYears.map((y) => ({ id: y.id, name: y.name }))}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Class</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Grade</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden md:table-cell">Campus</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden md:table-cell">Teacher</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Students</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden sm:table-cell">Room</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls) => (
                <tr key={cls.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{cls.name}</td>
                  <td className="px-4 py-3 text-muted">{cls.grade?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell">{cls.campus?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell">
                    {cls.classTeachers[0]
                      ? `${cls.classTeachers[0].teacher.firstName} ${cls.classTeachers[0].teacher.lastName}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="default">{cls._count.students}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted hidden sm:table-cell">{cls.room ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {classes.length === 0 && (
          <CardContent className="py-12 text-center text-muted">No classes yet.</CardContent>
        )}
      </Card>
    </div>
  );
}
