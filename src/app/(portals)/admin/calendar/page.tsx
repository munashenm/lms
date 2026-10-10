import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { SchoolEventForm } from "@/components/calendar/school-event-form";
import { SchoolEventList } from "@/components/calendar/school-event-list";
import { AcademicCalendarList } from "@/components/calendar/academic-calendar-list";
import { calendarKindForAssessment, type CalendarEntry } from "@/lib/academic-calendar";

export default async function AdminCalendarPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const schoolId = "schoolId" in filter ? filter.schoolId : null;
  const now = new Date();
  const horizon = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 60);
  const [events, assessments] = await Promise.all([
    prisma.schoolEvent.findMany({
      where: schoolId ? { schoolId } : {},
      orderBy: { startsAt: "asc" },
    }),
    schoolId
      ? prisma.assessment.findMany({
          where: {
            isPublished: true,
            dueDate: { gte: now, lte: horizon },
            OR: [{ subject: { schoolId } }, { module: { course: { schoolId } } }],
          },
          include: { subject: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const upcoming: CalendarEntry[] = [
    ...assessments.flatMap((assessment) => assessment.dueDate ? [{
      date: assessment.dueDate,
      kind: calendarKindForAssessment(assessment.type),
      label: assessment.title,
      detail: assessment.subject?.name ?? null,
    }] : []),
    ...events
      .filter((event) => event.startsAt >= now && event.startsAt <= horizon)
      .map((event) => ({
        date: event.startsAt,
        kind: "EVENT" as const,
        label: event.title,
        detail: event.isPublic ? "Public event" : "Internal event",
      })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">School calendar</h1>
        <p className="text-muted text-sm mt-1">
          Public events appear on the website calendar. Tick “Show on the public website”.
        </p>
      </div>
      <AcademicCalendarList entries={upcoming} />
      <SchoolEventForm />
      <SchoolEventList
        events={events.map((event) => ({
          id: event.id,
          title: event.title,
          startsAt: event.startsAt,
          isPublic: event.isPublic,
        }))}
      />
    </div>
  );
}
