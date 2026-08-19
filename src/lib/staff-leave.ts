import { UserRole } from "@prisma/client";
import type { SessionPayload } from "./auth";
import { getTeacherForSession } from "./portal-data";
import { prisma } from "./db";

export const STAFF_LEAVE_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.FINANCE_OFFICER,
  UserRole.ADMISSIONS_OFFICER,
  UserRole.HR_OFFICER,
  UserRole.SCHOOL_ADMIN,
  UserRole.PRINCIPAL,
  UserRole.SUPER_ADMIN,
  UserRole.STAFF,
];

export function canApplyForLeave(role: UserRole): boolean {
  return STAFF_LEAVE_ROLES.includes(role);
}

export async function getStaffLeaveApplicant(session: SessionPayload) {
  if (!session.schoolId) return null;

  const [teacher, employee] = await Promise.all([
    getTeacherForSession(session),
    prisma.employee.findFirst({
      where: { userId: session.userId, schoolId: session.schoolId },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: true },
    }),
  ]);

  return {
    userId: session.userId,
    schoolId: session.schoolId,
    teacherId: teacher?.id ?? null,
    employeeId: employee?.id ?? null,
    firstName: employee?.firstName ?? teacher?.firstName ?? session.firstName,
    lastName: employee?.lastName ?? teacher?.lastName ?? session.lastName,
    employeeNumber: employee?.employeeNumber ?? teacher?.employeeNumber ?? null,
    department: employee?.department ?? teacher?.department ?? null,
  };
}

export const SICK_NOTE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const SICK_NOTE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
