import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getTeacherForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, ClipboardCheck, Calendar, Users } from "lucide-react";

export default async function TeacherDashboardPage() {
  const session = await getSession();
  const teacher = await getTeacherForSession(session!);

  const classIds = teacher?.classTeachers.map((ct) => ct.classId) ?? [];
  const studentCount = classIds.length
    ? await prisma.student.count({ where: { classId: { in: classIds }, status: "ACTIVE" } })
    : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayPresent = teacher
    ? await prisma.attendanceRecord.count({
        where: {
          classId: { in: classIds },
          date: today,
          status: "PRESENT",
          markedBy: teacher.id,
        },
      })
    : 0;

  const slotCount = teacher
    ? await prisma.timetableSlot.count({ where: { teacherId: teacher.id } })
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted text-sm mt-1">
          Welcome, {session!.firstName}. {teacher?.department ?? "Academic"} department.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="My Classes" value={classIds.length} icon={GraduationCap} />
        <StatCard title="Students" value={studentCount} icon={Users} />
        <StatCard title="Timetable Slots" value={slotCount} icon={Calendar} />
        <StatCard
          title="Present Today"
          value={todayPresent}
          subtitle="Marked by you"
          icon={ClipboardCheck}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">My Classes</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/teacher/classes">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!teacher || teacher.classTeachers.length === 0 ? (
            <p className="text-sm text-muted">No classes assigned yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teacher.classTeachers.map((ct) => (
                <div key={ct.id} className="rounded-lg border border-border p-4">
                  <p className="font-medium">{ct.class.name}</p>
                  <p className="text-xs text-muted mt-1">
                    {ct.class.grade?.name} · {ct.class._count.students} students
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/teacher/attendance?classId=${ct.classId}`}>Attendance</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
