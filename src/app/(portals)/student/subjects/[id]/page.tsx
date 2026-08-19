import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { curriculumProgress } from "@/lib/learner-portal";
import { formatDate } from "@/lib/utils";
import { getTerminology } from "@/lib/terminology";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentSubjectWorkspacePage({ params }: PageProps) {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const { id } = await params;
  if (!student) notFound();
  const terms = getTerminology(student.school.institutionType);

  const classSubject = student.classId
    ? await prisma.classSubject.findFirst({
        where: { classId: student.classId, subjectId: id },
        include: {
          subject: true,
          teacher: { select: { firstName: true, lastName: true } },
        },
      })
    : null;
  const courseModule = student.enrolments
    .flatMap((e) => e.course?.modules ?? [])
    .find((m) => m.id === id);

  if (!classSubject && !courseModule) notFound();

  const subjectId = classSubject?.subjectId;
  const [topics, assignments, assessments, slots, materials] = await Promise.all([
    subjectId
      ? prisma.curriculumTopic.findMany({
          where: {
            schoolId: student.schoolId,
            subjectId,
            OR: [{ classId: student.classId }, { classId: null }],
          },
          orderBy: { sortOrder: "asc" },
        })
      : Promise.resolve([]),
    subjectId
      ? prisma.assignment.findMany({
          where: {
            assessment: {
              isPublished: true,
              type: "ASSIGNMENT",
              subjectId,
            },
          },
          include: { assessment: true, submissions: { where: { studentId: student.id } } },
          take: 12,
        })
      : Promise.resolve([]),
    subjectId
      ? prisma.assessment.findMany({
          where: { isPublished: true, subjectId },
          orderBy: { dueDate: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    student.classId
      ? prisma.timetableSlot.findMany({
          where: { classId: student.classId, subjectId: classSubject?.subjectId },
          include: { teacher: { select: { firstName: true, lastName: true } } },
        })
      : Promise.resolve([]),
    prisma.document.findMany({
      where: {
        schoolId: student.schoolId,
        type: "LEARNING_MATERIAL",
        isPublic: true,
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const progress = curriculumProgress(topics);
  const title = classSubject?.subject.name ?? courseModule?.name ?? "Subject";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/student/subjects" className="text-sm text-muted hover:text-primary">← My subjects</Link>
        <h1 className="text-2xl font-bold mt-2">{title}</h1>
        <p className="text-muted text-sm mt-1">
          {classSubject?.subject.code ?? courseModule?.code}
          {classSubject?.teacher ? ` · ${classSubject.teacher.firstName} ${classSubject.teacher.lastName}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted">Progress</p><p className="text-2xl font-bold">{progress.percentage}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted">{terms.homework}</p><p className="text-2xl font-bold">{assignments.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted">Assessments</p><p className="text-2xl font-bold">{assessments.length}</p></CardContent></Card>
      </div>

      {slots.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {slots.map((slot) => (
              <p key={slot.id}>{slot.dayOfWeek} · {slot.startTime}–{slot.endTime}{slot.room ? ` · ${slot.room}` : ""}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle className="text-base">Curriculum</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {topics.length === 0 ? <p className="text-sm text-muted">No curriculum topics published yet.</p> : topics.map((topic) => (
            <div key={topic.id} className="flex justify-between text-sm">
              <span>{topic.title}</span>
              <Badge variant={topic.status === "COMPLETED" ? "success" : topic.status === "CURRENT" ? "warning" : "secondary"}>{topic.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Homework</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {assignments.length === 0 ? <p className="text-sm text-muted">No assignments.</p> : assignments.map((a) => (
            <Link key={a.id} href={`/student/assignments#${a.id}`} className="flex justify-between text-sm">
              <span>{a.assessment.title}</span>
              <span className="text-muted">{a.assessment.dueDate ? formatDate(a.assessment.dueDate) : ""}</span>
            </Link>
          ))}
        </CardContent>
      </Card>

      {materials.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Resources</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {materials.map((doc) => (
              <a key={doc.id} href={doc.fileUrl} className="block text-sm text-primary hover:underline" target="_blank" rel="noreferrer">
                {doc.title}
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
