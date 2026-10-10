import { prisma } from "@/lib/db";
import { johannesburgDayStart } from "@/lib/school-day";
import { attendanceOccupancyGaps } from "@/lib/attendance-occupancy";
import { splitOpenPresence } from "./queries";

export async function attendanceOccupancyForSchool(schoolId: string, now = new Date()) {
  const day = johannesburgDayStart(now);
  const [presence, records] = await Promise.all([
    splitOpenPresence(schoolId, now),
    prisma.attendanceRecord.findMany({
      where: { schoolId, date: day },
      select: {
        studentId: true,
        status: true,
        student: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const onSiteStudentIds = presence.onSite
    .map((row) => row.studentId)
    .filter((id): id is string => Boolean(id));
  return attendanceOccupancyGaps({
    onSiteStudentIds,
    attendance: records.map((row) => ({
      studentId: row.studentId,
      status: row.status,
      name: `${row.student.firstName} ${row.student.lastName}`,
    })),
  });
}
