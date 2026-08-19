import { InstalmentStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getGuardianForSession, DAYS_ORDER } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { ChildFilter } from "@/components/finance/child-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
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

  const [assessments, instalments, termRows, announcements] = schoolId
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
      ])
    : [[], [], [], []];

  const events = [
    ...assessments.map((a) => ({
      date: a.dueDate!,
      label: calendarAssessmentLabel({
        type: a.type,
        title: a.title,
        homeworkLabel: terms.homework,
      }),
      detail: a.subject?.name,
    })),
    ...instalments.map((row) => ({
      date: row.dueDate,
      label: `Payment: ${row.charge.description}`,
      detail: `${row.charge.student.firstName} ${row.charge.student.lastName}`,
    })),
    ...termRows.flatMap((term) => [
      { date: term.startDate, label: `${term.name} starts`, detail: null as string | null },
      { date: term.endDate, label: `${term.name} ends`, detail: null as string | null },
    ]),
    ...announcements.map((a) => ({
      date: a.publishAt,
      label: `Event/notice: ${a.title}`,
      detail: null as string | null,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-muted">Nothing scheduled in the next 60 days.</p>
          ) : (
            events.map((event, index) => (
              <div
                key={`${event.label}-${index}`}
                className="flex justify-between gap-3 text-sm border-b border-border pb-2 last:border-0"
              >
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
