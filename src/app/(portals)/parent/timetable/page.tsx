import { getSession } from "@/lib/auth";
import { DAY_LABELS, getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { ChildFilter } from "@/components/finance/child-filter";
import { TimetableGrid } from "@/components/academics/timetable-grid";
import { Card, CardContent } from "@/components/ui/card";
import { getTodayDayOfWeek } from "@/lib/timetable-conflicts";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentTimetablePage({ searchParams }: PageProps) {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const { studentId } = await searchParams;
  const today = getTodayDayOfWeek();

  const children = guardian?.students.map((sg) => sg.student) ?? [];
  const selected =
    (studentId ? children.find((c) => c.id === studentId) : null) ?? children[0] ?? null;
  const classId = selected?.class?.id ?? null;

  const slots = classId
    ? await prisma.timetableSlot.findMany({
        where: { classId },
        include: {
          subject: { select: { name: true, code: true } },
          module: { select: { name: true, code: true } },
          teacher: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      })
    : [];

  const todaySlots = slots.filter((s) => s.dayOfWeek === today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timetable</h1>
        <p className="text-muted text-sm mt-1">
          {selected?.class?.name ? `Class: ${selected.class.name}` : "No class assigned"}
        </p>
      </div>

      <ChildFilter
        children={children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }))}
        selectedId={selected?.id}
        basePath="/parent/timetable"
      />

      {!classId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            This child is not assigned to a class yet.
          </CardContent>
        </Card>
      ) : (
        <>
          {todaySlots.length > 0 && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-5">
                <h2 className="font-semibold text-sm text-primary mb-3">
                  Today — {DAY_LABELS[today as keyof typeof DAY_LABELS] ?? today}
                </h2>
                <div className="space-y-2">
                  {todaySlots.map((slot) => (
                    <div key={slot.id} className="flex justify-between text-sm">
                      <span className="font-medium">
                        {slot.subject?.name ?? slot.module?.name ?? "Period"}
                      </span>
                      <span className="text-muted">
                        {slot.startTime}–{slot.endTime}
                        {slot.room && ` · ${slot.room}`}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <TimetableGrid slots={slots} highlightDay={today} />
        </>
      )}
    </div>
  );
}
