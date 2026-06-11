import { getSession } from "@/lib/auth";
import { getTeacherForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { TimetableGrid } from "@/components/academics/timetable-grid";

export default async function TeacherTimetablePage() {
  const session = await getSession();
  const teacher = await getTeacherForSession(session!);

  const slots = teacher
    ? await prisma.timetableSlot.findMany({
        where: { teacherId: teacher.id },
        include: {
          class: { select: { name: true } },
          subject: { select: { name: true, code: true } },
          module: { select: { name: true, code: true } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Timetable</h1>
        <p className="text-muted text-sm mt-1">Your weekly teaching schedule</p>
      </div>
      <TimetableGrid slots={slots} showClass />
    </div>
  );
}
