import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { TimetableGrid } from "@/components/academics/timetable-grid";
import { Card, CardContent } from "@/components/ui/card";
import { getTodayDayOfWeek } from "@/lib/timetable-conflicts";
import { DAY_LABELS } from "@/lib/portal-data";

export default async function StudentTimetablePage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const today = getTodayDayOfWeek();

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

  const todaySlots = slots.filter((s) => s.dayOfWeek === today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Timetable</h1>
        <p className="text-muted text-sm mt-1">
          {student?.class ? `Class: ${student.class.name}` : "No class assigned"}
        </p>
      </div>

      {!student?.classId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            You are not assigned to a class yet.
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
