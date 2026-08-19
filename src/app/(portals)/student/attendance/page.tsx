import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatDate } from "@/lib/utils";
import { attendanceSummary } from "@/lib/learner-portal";
import { ClipboardCheck } from "lucide-react";

export default async function StudentAttendancePage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);

  const records = student
    ? await prisma.attendanceRecord.findMany({
        where: { studentId: student.id },
        include: {
          class: { select: { name: true } },
          subject: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: 90,
      })
    : [];

  const stats = attendanceSummary(records);
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
        <p className="text-muted text-sm mt-1">Your own attendance record. Status cannot be edited here.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Attendance" value={`${stats.percentage}%`} icon={ClipboardCheck} />
        <Card><CardContent className="p-4"><p className="text-xs text-muted">Present</p><p className="text-xl font-bold">{stats.present}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted">Absent</p><p className="text-xl font-bold">{stats.absent}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted">Late</p><p className="text-xl font-bold">{stats.late}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted">Excused</p><p className="text-xl font-bold">{stats.excused}</p></CardContent></Card>
      </div>

      <div className="h-3 rounded-full bg-background overflow-hidden flex">
        {stats.total > 0 ? (
          <>
            <div className="bg-emerald-500" style={{ width: `${(stats.present / stats.total) * 100}%` }} />
            <div className="bg-amber-400" style={{ width: `${(stats.late / stats.total) * 100}%` }} />
            <div className="bg-slate-400" style={{ width: `${(stats.excused / stats.total) * 100}%` }} />
            <div className="bg-rose-500" style={{ width: `${(stats.absent / stats.total) * 100}%` }} />
          </>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {records.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No attendance records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[36rem]">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="text-left px-4 py-3 font-medium text-muted">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Class / subject</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Arrival</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted hidden md:table-cell">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{formatDate(r.date)}</td>
                      <td className="px-4 py-3 text-muted">{r.subject?.name ?? r.class?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{r.sessionStart ?? "—"}</td>
                      <td className="px-4 py-3"><Badge variant={variant[r.status] ?? "secondary"}>{r.status}</Badge></td>
                      <td className="px-4 py-3 text-muted hidden md:table-cell">{r.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
