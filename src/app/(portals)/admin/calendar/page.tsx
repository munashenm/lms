import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { SchoolEventForm } from "@/components/calendar/school-event-form";
import { SchoolEventList } from "@/components/calendar/school-event-list";

export default async function AdminCalendarPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const events = await prisma.schoolEvent.findMany({
    where: "schoolId" in filter ? { schoolId: filter.schoolId } : {},
    orderBy: { startsAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">School calendar</h1>
        <p className="text-muted text-sm mt-1">
          Public events appear on the website calendar. Tick “Show on the public website”.
        </p>
      </div>
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
