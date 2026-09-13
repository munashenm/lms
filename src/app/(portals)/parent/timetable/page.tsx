import { getSession } from "@/lib/auth";
import { DAY_LABELS, getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { ChildFilter } from "@/components/finance/child-filter";
import { TimetableGrid } from "@/components/academics/timetable-grid";
import { Card, CardContent } from "@/components/ui/card";
import { getTodayDayOfWeek, orderDaysWithTodayFirst } from "@/lib/timetable-conflicts";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentTimetablePage({ searchParams }: PageProps) {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const { studentId } = await searchParams;
  const today = getTodayDayOfWeek();
  const weekOrder = orderDaysWithTodayFirst(today);

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

  const todaySlots = today ? slots.filter((s) => s.dayOfWeek === today) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timetable</h1>
        <p className="text-muted text-sm mt-1">
          {selected?.class?.name ? `Class: ${selected.class.name}` : "No class assigned"}
          {" · "}
          Full week
          {today ? ` · ${DAY_LABELS[today]} first` : " · week starts Monday"}
        </p>
      </div>

      <ChildFilter
        students={children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }))}
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
          {today ? (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-5">
                <h2 className="font-semibold text-sm text-primary mb-3">
                  Today — {DAY_LABELS[today]}
                </h2>
                {todaySlots.length === 0 ? (
                  <p className="text-sm text-muted">No classes scheduled for today.</p>
                ) : (
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
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-5">
                <h2 className="font-semibold text-sm mb-1">Sunday</h2>
                <p className="text-sm text-muted">
                  No school timetable today. The week below starts with Monday.
                </p>
              </CardContent>
            </Card>
          )}
          <div>
            <h2 className="font-semibold text-sm mb-3">
              Week overview
              <span className="ml-2 text-xs font-normal text-muted">
                {weekOrder.map((d) => DAY_LABELS[d]).join(" → ")}
              </span>
            </h2>
            <TimetableGrid
              slots={slots}
              highlightDay={today ?? undefined}
              prioritizeToday
            />
          </div>
        </>
      )}
    </div>
  );
}
