import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { TimetableGrid } from "@/components/academics/timetable-grid";
import { Card, CardContent } from "@/components/ui/card";

export default async function StudentTimetablePage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);

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
        <TimetableGrid slots={slots} />
      )}
    </div>
  );
}
