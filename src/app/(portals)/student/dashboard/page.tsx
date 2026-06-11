import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Calendar, ClipboardCheck, Megaphone } from "lucide-react";
import { AnnouncementList } from "@/components/announcements/announcement-list";

export default async function StudentDashboardPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);

  const [attendanceStats, announcements] = await Promise.all([
    student
      ? prisma.attendanceRecord.groupBy({
          by: ["status"],
          where: { studentId: student.id },
          _count: true,
        })
      : Promise.resolve([]),
    prisma.announcement.findMany({
      where: {
        ...(session!.schoolId ? { schoolId: session!.schoolId } : {}),
        audience: { in: ["ALL", "STUDENTS"] },
      },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { publishAt: "desc" },
      take: 3,
    }),
  ]);

  const present = attendanceStats.find((a) => a.status === "PRESENT")?._count ?? 0;
  const total = attendanceStats.reduce((sum, a) => sum + a._count, 0);
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted text-sm mt-1">
          Welcome, {session!.firstName}
          {student?.grade && ` · ${student.grade.name}`}
          {student?.class && ` · ${student.class.name}`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Attendance Rate"
          value={`${attendanceRate}%`}
          subtitle={`${present} of ${total} days`}
          icon={ClipboardCheck}
        />
        <StatCard
          title="Class"
          value={student?.class?.name ?? "—"}
          icon={BookOpen}
        />
        <StatCard
          title="Campus"
          value={student?.campus?.name ?? "—"}
          icon={Calendar}
        />
        <StatCard
          title="Announcements"
          value={announcements.length}
          icon={Megaphone}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/student/timetable">Timetable</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/student/subjects">Subjects</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/student/attendance">Attendance</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enrolled Course</CardTitle>
          </CardHeader>
          <CardContent>
            {student?.enrolments[0]?.course ? (
              <div>
                <p className="font-medium">{student.enrolments[0].course.name}</p>
                <p className="text-sm text-muted mt-1">
                  {student.enrolments[0].course.modules.length} modules
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">No course enrolment</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Latest Announcements</h2>
        <AnnouncementList announcements={announcements} />
      </div>
    </div>
  );
}
