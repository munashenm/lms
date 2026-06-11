import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { ChildFilter } from "@/components/finance/child-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentAttendancePage({ searchParams }: PageProps) {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const { studentId } = await searchParams;

  const children = guardian?.students.map((sg) => sg.student) ?? [];
  const childIds = children.map((c) => c.id);
  const filterIds = studentId && childIds.includes(studentId) ? [studentId] : childIds;

  const records = filterIds.length
    ? await prisma.attendanceRecord.findMany({
        where: { studentId: { in: filterIds } },
        include: {
          student: { select: { firstName: true, lastName: true } },
          class: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: 60,
      })
    : [];

  const variant: Record<string, "success" | "danger" | "warning" | "secondary"> = {
    PRESENT: "success",
    ABSENT: "danger",
    LATE: "warning",
    EXCUSED: "secondary",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-muted text-sm mt-1">Attendance records for your children</p>
      </div>

      <ChildFilter
        children={children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }))}
        selectedId={studentId}
        basePath="/parent/attendance"
      />

      <Card>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No attendance records yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {records.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{formatDate(r.date)}</p>
                    <p className="text-xs text-muted">
                      {r.student.firstName} {r.student.lastName}
                      {r.class?.name && ` · ${r.class.name}`}
                    </p>
                  </div>
                  <Badge variant={variant[r.status] ?? "secondary"}>{r.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
