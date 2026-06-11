import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function StaffPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const teachers = await prisma.teacher.findMany({
    where: filter,
    include: {
      campus: { select: { name: true } },
      classTeachers: { include: { class: { select: { name: true } } } },
    },
    orderBy: { lastName: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff</h1>
        <p className="text-muted text-sm mt-1">{teachers.length} teachers and lecturers</p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Employee No.</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden md:table-cell">Department</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden lg:table-cell">Campus</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Classes</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{t.employeeNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.firstName} {t.lastName}</p>
                    <p className="text-xs text-muted">{t.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell">{t.department ?? "—"}</td>
                  <td className="px-4 py-3 text-muted hidden lg:table-cell">{t.campus?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {t.classTeachers.map((ct) => ct.class.name).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={t.status === "ACTIVE" ? "success" : "secondary"}>{t.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {teachers.length === 0 && (
          <CardContent className="py-12 text-center text-muted">No staff records yet.</CardContent>
        )}
      </Card>
    </div>
  );
}
