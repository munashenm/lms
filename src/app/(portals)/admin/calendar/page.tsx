import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { SchoolEventForm } from "@/components/calendar/school-event-form";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

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
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {events.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">No events yet.</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="px-4 py-3">
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-muted">
                  {formatDate(event.startsAt)}
                  {event.isPublic ? " · Public" : " · Internal"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
