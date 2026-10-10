import { InstalmentStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { DAYS_ORDER } from "@/lib/portal-data";
import { AcademicCalendarList } from "@/components/calendar/academic-calendar-list";
import { calendarKindForAssessment, type CalendarEntry } from "@/lib/academic-calendar";
import { getTerminology } from "@/lib/terminology";
import { calendarAssessmentLabel } from "@/lib/learner-portal";

export default async function StudentCalendarPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const now = new Date();
  const horizon = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 60);

  const terms = getTerminology(student?.school.institutionType);

  const [assessments, instalments, termRows, announcements, schoolEvents] = student
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
        prisma.schoolEvent.findMany({
          where: { schoolId: student.schoolId, startsAt: { gte: now, lte: horizon } },
          orderBy: { startsAt: "asc" },
          take: 20,
        }),
      ])
    : [[], [], [], [], []];

  const events: CalendarEntry[] = [
    ...assessments.map((a) => ({
      date: a.dueDate!,
      kind: calendarKindForAssessment(a.type),
      label: calendarAssessmentLabel({
        type: a.type,
        title: a.title,
        homeworkLabel: terms.homework,
      }),
      detail: a.subject?.name,
    })),
    ...instalments.map((row) => ({
      date: row.dueDate,
      kind: "DEADLINE" as const,
      label: `Payment: ${row.charge.description}`,
      detail: null,
    })),
    ...termRows.flatMap((term) => [
      { date: term.startDate, kind: "EVENT" as const, label: `${term.name} starts`, detail: null },
      { date: term.endDate, kind: "EVENT" as const, label: `${term.name} ends`, detail: null },
    ]),
    ...announcements.map((a) => ({ date: a.publishAt, kind: "EVENT" as const, label: a.title, detail: "Notice" })),
    ...schoolEvents.map((event) => ({ date: event.startsAt, kind: "EVENT" as const, label: event.title, detail: "School event" })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Academic Calendar</h1>
        <p className="text-muted text-sm mt-1">
          Classes follow {DAYS_ORDER.slice(0, 5).join(", ").toLowerCase()}. Upcoming assessments, payments and {terms.period.toLowerCase()} dates are listed below.
        </p>
      </div>
      <AcademicCalendarList entries={events} />
    </div>
  );
}
