import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTeacherForSession, classIdsForTeacher } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTerminology } from "@/lib/terminology";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeacherClassDeskPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  const teacher = await getTeacherForSession(session!);
  const classIds = classIdsForTeacher(teacher);
  if (!classIds.includes(id)) notFound();

  const terms = getTerminology(teacher?.school.institutionType);
  const cls = await prisma.class.findFirst({
    where: { id, schoolId: teacher?.schoolId },
    include: {
      grade: { select: { name: true } },
      classSubjects: {
        include: { subject: { select: { name: true, code: true } } },
      },
    },
  });
  if (!cls) notFound();

  const [students, assessments, slots] = await Promise.all([
    prisma.student.findMany({
      where: { classId: id, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentNumber: true,
      },
    }),
    teacher
      ? prisma.assessment.findMany({
          where: { teacherId: teacher.id },
          include: {
            subject: { select: { code: true, name: true } },
            _count: { select: { marks: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    teacher
      ? prisma.timetableSlot.findMany({
          where: { teacherId: teacher.id, classId: id },
          include: { subject: { select: { name: true, code: true } } },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const marks = students.length
    ? await prisma.mark.findMany({
        where: {
          studentId: { in: students.map((student) => student.id) },
          assessment: teacher ? { teacherId: teacher.id } : undefined,
        },
        include: {
          assessment: { select: { title: true, maxMarks: true } },
          student: { select: { firstName: true, lastName: true } },
        },
        orderBy: { recordedAt: "desc" },
        take: 12,
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">
          <Link href="/teacher/classes" className="hover:text-primary">
            My {terms.classes}
          </Link>
        </p>
        <h1 className="text-2xl font-bold mt-1">{cls.name}</h1>
        <p className="text-muted text-sm mt-1">
          {cls.grade?.name ?? terms.grade} · {students.length} {terms.students.toLowerCase()}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/teacher/attendance?classId=${cls.id}`}>Mark register</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/teacher/assessments">Capture / view marks</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/teacher/timetable">Timetable</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/teacher/announcements">Message class</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/teacher/report-cards">Reports</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/teacher/materials">Upload materials</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {students.length === 0 ? (
            <p className="py-12 text-center text-muted text-sm">No learners in this class.</p>
          ) : (
            <div className="divide-y divide-border">
              {students.map((student) => (
                <div key={student.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-medium">
                      {student.lastName}, {student.firstName}
                    </p>
                    <p className="text-xs text-muted font-mono">{student.studentNumber}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold">Recent marks</h2>
            {marks.length === 0 ? (
              <p className="text-sm text-muted">No marks captured yet. Open Assessments to enter scores.</p>
            ) : (
              marks.map((mark) => (
                <div key={mark.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">
                      {mark.student.firstName} {mark.student.lastName}
                    </p>
                    <p className="text-xs text-muted">{mark.assessment.title}</p>
                  </div>
                  <Badge variant="secondary">
                    {Number(mark.score)}/{Number(mark.assessment.maxMarks)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold">This class</h2>
            {assessments.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">Your assessments</p>
                {assessments.map((assessment) => (
                  <div key={assessment.id} className="flex items-center justify-between text-sm">
                    <span>{assessment.title}</span>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/teacher/assessments/${assessment.id}`}>Marks</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Create an assessment to capture marks for this class.</p>
            )}
            {slots.length > 0 ? (
              <div className="space-y-1 pt-2">
                <p className="text-xs font-medium text-muted">Periods</p>
                {slots.map((slot) => (
                  <p key={slot.id} className="text-sm text-muted">
                    {slot.subject?.code ?? "Period"} · {slot.startTime}–{slot.endTime}
                    {slot.room ? ` · ${slot.room}` : ""}
                  </p>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
