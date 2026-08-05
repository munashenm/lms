import { AttendanceStatus, type Prisma } from "@prisma/client";
import { prisma } from "./db";

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
  SICK: "Sick",
};

export function buildAttendanceSessionKey(params: {
  classId?: string | null;
  moduleId?: string | null;
  subjectId?: string | null;
  sessionStart?: string | null;
  sessionEnd?: string | null;
}): string {
  if (params.moduleId) {
    const start = params.sessionStart?.trim() || "any";
    const end = params.sessionEnd?.trim() || "any";
    return `module:${params.moduleId}:${start}-${end}`;
  }
  if (params.subjectId && params.classId) {
    return `subject:${params.subjectId}:class:${params.classId}`;
  }
  if (params.classId) {
    return `class:${params.classId}`;
  }
  return "daily";
}

export function isPresentLike(status: AttendanceStatus): boolean {
  return status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE;
}

export function attendanceRate(presentLike: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((presentLike / total) * 1000) / 10;
}

export async function getAttendanceDashboard(params: {
  schoolId: string;
  date?: Date;
  termId?: string | null;
  academicYearId?: string | null;
  gradeId?: string | null;
  classId?: string | null;
  threshold?: number;
}) {
  const day = params.date ?? new Date();
  const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));

  const studentWhere: Prisma.StudentWhereInput = {
    schoolId: params.schoolId,
    status: "ACTIVE",
    ...(params.gradeId ? { gradeId: params.gradeId } : {}),
    ...(params.classId ? { classId: params.classId } : {}),
  };

  const recordWhere: Prisma.AttendanceRecordWhereInput = {
    student: studentWhere,
    ...(params.termId ? { termId: params.termId } : {}),
    ...(params.academicYearId
      ? { term: { academicYearId: params.academicYearId } }
      : {}),
  };

  const [activeStudents, todayRecords, termRecords, classGroups] = await Promise.all([
    prisma.student.count({ where: studentWhere }),
    prisma.attendanceRecord.findMany({
      where: { ...recordWhere, date: dayStart },
      select: { status: true, studentId: true, classId: true },
    }),
    params.termId || params.academicYearId
      ? prisma.attendanceRecord.findMany({
          where: recordWhere,
          select: { status: true, studentId: true },
        })
      : prisma.attendanceRecord.findMany({
          where: {
            ...recordWhere,
            date: {
              gte: new Date(new Date(dayStart).setDate(dayStart.getDate() - 30)),
            },
          },
          select: { status: true, studentId: true },
        }),
    prisma.student.groupBy({
      by: ["classId"],
      where: { ...studentWhere, classId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const todayPresent = todayRecords.filter((r) => isPresentLike(r.status)).length;
  const todayAbsent = todayRecords.filter((r) => r.status === AttendanceStatus.ABSENT).length;
  const todayLate = todayRecords.filter((r) => r.status === AttendanceStatus.LATE).length;
  const todaySick = todayRecords.filter((r) => r.status === AttendanceStatus.SICK).length;
  const todayExcused = todayRecords.filter(
    (r) => r.status === AttendanceStatus.EXCUSED
  ).length;

  const byStudent = new Map<string, { total: number; presentLike: number }>();
  for (const record of termRecords) {
    const current = byStudent.get(record.studentId) ?? { total: 0, presentLike: 0 };
    current.total += 1;
    if (isPresentLike(record.status)) current.presentLike += 1;
    byStudent.set(record.studentId, current);
  }

  const threshold = params.threshold ?? 80;
  const lowAttendanceIds = [...byStudent.entries()]
    .filter(([, stats]) => stats.total >= 3 && attendanceRate(stats.presentLike, stats.total) < threshold)
    .map(([studentId, stats]) => ({
      studentId,
      rate: attendanceRate(stats.presentLike, stats.total),
      total: stats.total,
      presentLike: stats.presentLike,
    }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 25);

  const lowStudents =
    lowAttendanceIds.length > 0
      ? await prisma.student.findMany({
          where: { id: { in: lowAttendanceIds.map((s) => s.studentId) } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentNumber: true,
            grade: { select: { name: true } },
            class: { select: { name: true } },
          },
        })
      : [];

  const lowAttendance = lowAttendanceIds.map((row) => {
    const student = lowStudents.find((s) => s.id === row.studentId);
    return {
      ...row,
      firstName: student?.firstName ?? "",
      lastName: student?.lastName ?? "",
      studentNumber: student?.studentNumber ?? "",
      gradeName: student?.grade?.name ?? null,
      className: student?.class?.name ?? null,
    };
  });

  const classIds = classGroups.map((g) => g.classId).filter(Boolean) as string[];
  const classes =
    classIds.length > 0
      ? await prisma.class.findMany({
          where: { id: { in: classIds } },
          select: { id: true, name: true },
        })
      : [];

  const classAttendance = classes.map((cls) => {
    const marked = todayRecords.filter((r) => r.classId === cls.id);
    const present = marked.filter((r) => isPresentLike(r.status)).length;
    return {
      classId: cls.id,
      className: cls.name,
      marked: marked.length,
      present,
      rate: attendanceRate(present, marked.length),
    };
  });

  return {
    date: dayStart.toISOString().slice(0, 10),
    activeStudents,
    today: {
      marked: todayRecords.length,
      present: todayPresent,
      absent: todayAbsent,
      late: todayLate,
      sick: todaySick,
      excused: todayExcused,
      rate: attendanceRate(todayPresent, todayRecords.length),
    },
    classAttendance,
    lowAttendance,
    threshold,
  };
}
