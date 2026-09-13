import { getSession } from "@/lib/auth";
import { getStudentForSession, DAY_LABELS } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { TimetableGrid } from "@/components/academics/timetable-grid";
import { Card, CardContent } from "@/components/ui/card";
import { getTodayDayOfWeek, orderDaysWithTodayFirst } from "@/lib/timetable-conflicts";
import { PrintPageButton } from "@/components/learner/print-page-button";

export default async function StudentTimetablePage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const today = getTodayDayOfWeek();
  const weekOrder = orderDaysWithTodayFirst(today);

  const slots = student?.classId
    ? await prisma.timetableSlot.findMany({
        where: { classId: student.classId },
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Timetable</h1>
          <p className="text-muted text-sm mt-1">
            {student?.class ? `Class: ${student.class.name}` : "No class assigned"}
            {" · "}
            Full week
            {today ? ` · ${DAY_LABELS[today]} first` : " · week starts Monday"}
          </p>
        </div>
        {student?.classId ? <PrintPageButton /> : null}
      </div>

      {!student?.classId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            You are not assigned to a class yet.
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
                  No school timetable today. Your week below starts with Monday.
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
