import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getTeacherForSession, classIdsForTeacher, DAY_LABELS } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTerminology } from "@/lib/terminology";
import { getTodayDayOfWeek } from "@/lib/timetable-conflicts";

export default async function TeacherDashboardPage() {
  const session = await getSession();
  const teacher = await getTeacherForSession(session!);
  const terms = getTerminology(teacher?.school.institutionType);

  const classIds = classIdsForTeacher(teacher);
  const todayDow = getTodayDayOfWeek();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [todaySlots, markedClassIds, openAssessments, unreadMessages] = await Promise.all([
    teacher && todayDow
      ? prisma.timetableSlot.findMany({
          where: { teacherId: teacher.id, dayOfWeek: todayDow },
          include: {
            class: { select: { id: true, name: true } },
            subject: { select: { name: true, code: true } },
          },
          orderBy: { startTime: "asc" },
        })
      : Promise.resolve([]),
    classIds.length
      ? prisma.attendanceRecord.findMany({
          where: {
            classId: { in: classIds },
            date: dayStart,
            ...(teacher ? { markedBy: teacher.id } : {}),
          },
          select: { classId: true },
          distinct: ["classId"],
        })
      : Promise.resolve([]),
    teacher
      ? prisma.assessment.findMany({
          where: {
            teacherId: teacher.id,
            isPublished: true,
          },
          include: {
            _count: { select: { marks: true } },
            subject: { select: { name: true } },
          },
          orderBy: { dueDate: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    prisma.messageRecipient.count({
      where: { userId: session!.userId, readAt: null },
    }),
  ]);

  const markedSet = new Set(
    markedClassIds.map((r) => r.classId).filter((id): id is string => Boolean(id))
  );
  const classesNeedingAttendance = classIds.filter((id) => !markedSet.has(id));
  const assessmentsNeedingMarks = openAssessments.filter((a) => a._count.marks === 0);

  const classNameById = new Map<string, string>();
  if (teacher) {
    for (const ct of teacher.classTeachers) classNameById.set(ct.classId, ct.class.name);
    for (const row of teacher.classSubjects) classNameById.set(row.classId, row.class.name);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-muted text-sm mt-1">
          {todayDow ? DAY_LABELS[todayDow] : "Today"}
          {teacher?.department ? ` · ${teacher.department}` : ""} — attendance, marks, messages.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link
            href={
              classesNeedingAttendance[0]
                ? `/teacher/attendance?classId=${classesNeedingAttendance[0]}`
                : "/teacher/attendance"
            }
          >
            Mark attendance
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/teacher/assessments">Capture marks</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/teacher/homework">Homework</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/teacher/messages">
            Messages{unreadMessages > 0 ? ` (${unreadMessages})` : ""}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today&apos;s classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todaySlots.length === 0 ? (
              <p className="text-sm text-muted">
                {todayDow
                  ? "No timetable slots for today. Use your classes list below."
                  : "No school day today."}
              </p>
            ) : (
              todaySlots.map((slot) => {
                const needsAttendance = !markedSet.has(slot.classId);
                return (
                  <div
                    key={slot.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {slot.startTime}–{slot.endTime} · {slot.class.name}
                      </p>
                      <p className="text-xs text-muted">
                        {slot.subject?.name ?? slot.subject?.code ?? "Period"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {needsAttendance ? (
                        <Badge variant="warning">Attendance due</Badge>
                      ) : (
                        <Badge variant="success">Attendance done</Badge>
                      )}
                      <Button size="sm" variant={needsAttendance ? "default" : "outline"} asChild>
                        <Link href={`/teacher/attendance?classId=${slot.classId}`}>Attendance</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/teacher/assessments">Marks</Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Attendance</p>
              <p className="font-medium mt-0.5">
                {classesNeedingAttendance.length === 0
                  ? "All assigned classes marked"
                  : `${classesNeedingAttendance.length} class${classesNeedingAttendance.length === 1 ? "" : "es"} still need marking`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Marks / homework</p>
              <p className="font-medium mt-0.5">
                {assessmentsNeedingMarks.length === 0
                  ? "No open mark capture"
                  : `${assessmentsNeedingMarks.length} assessment${assessmentsNeedingMarks.length === 1 ? "" : "s"} with missing marks`}
              </p>
              {assessmentsNeedingMarks[0] ? (
                <Button size="sm" variant="outline" className="mt-2" asChild>
                  <Link href={`/teacher/assessments/${assessmentsNeedingMarks[0].id}`}>
                    Open {assessmentsNeedingMarks[0].title}
                  </Link>
                </Button>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Messages</p>
              <p className="font-medium mt-0.5">
                {unreadMessages === 0 ? "Inbox clear" : `${unreadMessages} unread`}
              </p>
              <Button size="sm" variant="outline" className="mt-2" asChild>
                <Link href="/teacher/messages">Open messages</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">My {terms.classes}</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/teacher/classes">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!teacher || classIds.length === 0 ? (
            <p className="text-sm text-muted">No classes assigned yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {classIds.map((classId) => (
                <div key={classId} className="rounded-lg border border-border p-4">
                  <p className="font-medium">{classNameById.get(classId) ?? "Class"}</p>
                  <p className="text-xs text-muted mt-1">
                    {markedSet.has(classId) ? "Attendance marked today" : "Attendance not marked today"}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/teacher/classes/${classId}`}>Open class</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/teacher/attendance?classId=${classId}`}>Attendance</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/teacher/assessments">Marks</Link>
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
