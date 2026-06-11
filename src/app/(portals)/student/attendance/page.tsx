import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function StudentAttendancePage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);

  const records = student
    ? await prisma.attendanceRecord.findMany({
        where: { studentId: student.id },
        include: { class: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: 60,
      })
    : [];

  const stats = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const variant: Record<string, "success" | "danger" | "warning" | "secondary"> = {
    PRESENT: "success",
    ABSENT: "danger",
    LATE: "warning",
    EXCUSED: "secondary",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Attendance</h1>
        <p className="text-muted text-sm mt-1">Your attendance history</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {Object.entries(stats).map(([status, count]) => (
          <Badge key={status} variant={variant[status] ?? "secondary"}>
            {status}: {count}
          </Badge>
        ))}
      </div>

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
                    <p className="text-xs text-muted">{r.class?.name}</p>
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
