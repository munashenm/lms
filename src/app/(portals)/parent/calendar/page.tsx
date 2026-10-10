import { InstalmentStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getGuardianForSession, DAYS_ORDER } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { ChildFilter } from "@/components/finance/child-filter";
import { AcademicCalendarList } from "@/components/calendar/academic-calendar-list";
import { calendarKindForAssessment, type CalendarEntry } from "@/lib/academic-calendar";
import { getTerminology } from "@/lib/terminology";
import { calendarAssessmentLabel } from "@/lib/learner-portal";
import { linkedStudentIdsOrForbidden } from "@/lib/parent-scope";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentCalendarPage({ searchParams }: PageProps) {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const { studentId } = await searchParams;
  const terms = getTerminology(guardian?.school.institutionType);
  const children = guardian?.students.map((sg) => sg.student) ?? [];
  const childIds = children.map((c) => c.id);
  const scoped = linkedStudentIdsOrForbidden(childIds, studentId);
  const schoolId = session?.schoolId ?? guardian?.schoolId;
  const now = new Date();
  const horizon = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 60);

  const instalmentIds = scoped.ok ? scoped.studentIds : [];

  const [assessments, instalments, termRows, announcements, schoolEvents] = schoolId
    ? await Promise.all([
        prisma.assessment.findMany({
          where: {
            isPublished: true,
            dueDate: { gte: now, lte: horizon },
            OR: [{ subject: { schoolId } }, { module: { course: { schoolId } } }],
          },
          include: { subject: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
        }),
        prisma.chargeInstalment.findMany({
          where: {
            charge: { studentId: { in: instalmentIds }, reversedAt: null },
            dueDate: { gte: now, lte: horizon },
            status: { in: [InstalmentStatus.PENDING, InstalmentStatus.PARTIAL] },
          },
          include: {
            charge: {
              select: {
                description: true,
                student: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { dueDate: "asc" },
        }),
        prisma.term.findMany({
          where: { academicYear: { schoolId, isCurrent: true } },
          orderBy: { startDate: "asc" },
        }),
        prisma.announcement.findMany({
          where: {
            schoolId,
            audience: { in: ["ALL", "PARENTS"] },
            publishAt: { gte: now, lte: horizon },
          },
          orderBy: { publishAt: "asc" },
          take: 20,
        }),
        prisma.schoolEvent.findMany({
          where: { schoolId, startsAt: { gte: now, lte: horizon } },
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
      detail: `${row.charge.student.firstName} ${row.charge.student.lastName}`,
    })),
    ...termRows.flatMap((term) => [
      { date: term.startDate, kind: "EVENT" as const, label: `${term.name} starts`, detail: null },
      { date: term.endDate, kind: "EVENT" as const, label: `${term.name} ends`, detail: null },
    ]),
    ...announcements.map((a) => ({
      date: a.publishAt,
      kind: "EVENT" as const,
      label: a.title,
      detail: "Notice",
    })),
    ...schoolEvents.map((event) => ({
      date: event.startsAt,
      kind: "EVENT" as const,
      label: event.title,
      detail: "School event",
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Academic Calendar</h1>
        <p className="text-muted text-sm mt-1">
          Classes follow {DAYS_ORDER.slice(0, 5).join(", ").toLowerCase()}. Upcoming assessments,
          payments and {terms.period.toLowerCase()} dates for linked children are listed below.
        </p>
      </div>

      <ChildFilter
        students={children.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
        }))}
        selectedId={studentId && childIds.includes(studentId) ? studentId : undefined}
        basePath="/parent/calendar"
      />

      <AcademicCalendarList entries={events} />
    </div>
  );
}
