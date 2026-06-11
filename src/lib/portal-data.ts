import { prisma } from "./db";
import type { SessionPayload } from "./auth";
import { UserRole } from "@prisma/client";

export async function getTeacherForSession(session: SessionPayload) {
  return prisma.teacher.findFirst({
    where: { userId: session.userId, ...(session.schoolId ? { schoolId: session.schoolId } : {}) },
    include: {
      campus: { select: { name: true } },
      classTeachers: {
        include: {
          class: {
            include: {
              grade: { select: { name: true } },
              _count: { select: { students: true } },
            },
          },
        },
      },
    },
  });
}

export async function getStudentForSession(session: SessionPayload) {
  return prisma.student.findFirst({
    where: { userId: session.userId, ...(session.schoolId ? { schoolId: session.schoolId } : {}) },
    include: {
      grade: { select: { name: true } },
      class: { select: { id: true, name: true } },
      campus: { select: { name: true } },
      enrolments: {
        include: { course: { include: { modules: { orderBy: { sortOrder: "asc" } } } } },
      },
    },
  });
}

export async function getGuardianForSession(session: SessionPayload) {
  return prisma.guardian.findFirst({
    where: {
      userId: session.userId,
      ...(session.schoolId ? { schoolId: session.schoolId } : {}),
    },
    include: {
      students: {
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studentNumber: true,
              status: true,
              grade: { select: { name: true } },
              class: { select: { name: true } },
            },
          },
        },
      },
    },
  });
}

export async function getChildStudentIds(session: SessionPayload): Promise<string[]> {
  const guardian = await getGuardianForSession(session);
  return guardian?.students.map((sg) => sg.studentId) ?? [];
}

export function resolveSchoolId(session: SessionPayload): string | null {
  return session.schoolId;
}

export async function requireSchoolId(session: SessionPayload): Promise<string> {
  if (session.schoolId) return session.schoolId;
  if (session.role === UserRole.SUPER_ADMIN) {
    const school = await prisma.school.findFirst({ where: { isActive: true } });
    if (school) return school.id;
  }
  throw new Error("School context required");
}

export const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
};

export const DAYS_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;
