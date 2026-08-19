import { AssessmentType, InstalmentStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { DAYS_ORDER } from "@/lib/portal-data";

export default async function StudentCalendarPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const now = new Date();
  const horizon = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 60);

  const [assessments, instalments, terms, announcements] = student
    ? await Promise.all([
        prisma.assessment.findMany({
          where: {
            isPublished: true,
            dueDate: { gte: now, lte: horizon },
            OR: [
              { subject: { schoolId: student.schoolId } },
              { module: { course: { schoolId: student.schoolId } } },
            ],
          },
          include: { subject: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
        }),
        prisma.chargeInstalment.findMany({
          where: {
            charge: { studentId: student.id, reversedAt: null },
            dueDate: { gte: now, lte: horizon },
            status: { in: [InstalmentStatus.PENDING, InstalmentStatus.PARTIAL] },
          },
          include: { charge: { select: { description: true } } },
          orderBy: { dueDate: "asc" },
        }),
        prisma.term.findMany({
          where: { academicYear: { schoolId: student.schoolId, isCurrent: true } },
          orderBy: { startDate: "asc" },
        }),
        prisma.announcement.findMany({
          where: {
            schoolId: student.schoolId,
            audience: { in: ["ALL", "STUDENTS"] },
            publishAt: { gte: now, lte: horizon },
          },
          orderBy: { publishAt: "asc" },
          take: 20,
        }),
      ])
    : [[], [], [], []];

  const events = [
    ...assessments.map((a) => ({
      date: a.dueDate!,
      label: `${a.type === AssessmentType.EXAM ? "Exam" : a.type === AssessmentType.ASSIGNMENT ? "Assignment" : "Assessment"}: ${a.title}`,
      detail: a.subject?.name,
    })),
    ...instalments.map((row) => ({
      date: row.dueDate,
      label: `Payment: ${row.charge.description}`,
      detail: null as string | null,
    })),
    ...terms.flatMap((term) => [
      { date: term.startDate, label: `${term.name} starts`, detail: null },
      { date: term.endDate, label: `${term.name} ends`, detail: null },
    ]),
    ...announcements.map((a) => ({ date: a.publishAt, label: `Event/notice: ${a.title}`, detail: null })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Academic Calendar</h1>
        <p className="text-muted text-sm mt-1">
          Classes follow {DAYS_ORDER.slice(0, 5).join(", ").toLowerCase()}. Upcoming assessments, payments and term dates are listed below.
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Upcoming</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-muted">Nothing scheduled in the next 60 days.</p>
          ) : (
            events.map((event, index) => (
              <div key={`${event.label}-${index}`} className="flex justify-between gap-3 text-sm border-b border-border pb-2 last:border-0">
                <div>
                  <p className="font-medium">{event.label}</p>
                  {event.detail ? <p className="text-xs text-muted">{event.detail}</p> : null}
                </div>
                <p className="text-muted shrink-0">{formatDate(event.date)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
