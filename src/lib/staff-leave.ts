import { UserRole } from "@prisma/client";
import type { SessionPayload } from "./auth";
import { getTeacherForSession } from "./portal-data";

export const STAFF_LEAVE_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.FINANCE_OFFICER,
  UserRole.ADMISSIONS_OFFICER,
  UserRole.SCHOOL_ADMIN,
  UserRole.PRINCIPAL,
  UserRole.SUPER_ADMIN,
];

export function canApplyForLeave(role: UserRole): boolean {
  return STAFF_LEAVE_ROLES.includes(role);
}

export async function getStaffLeaveApplicant(session: SessionPayload) {
  if (!session.schoolId) return null;

  const teacher = await getTeacherForSession(session);

  return {
    userId: session.userId,
    schoolId: session.schoolId,
    teacherId: teacher?.id ?? null,
    firstName: teacher?.firstName ?? session.firstName,
    lastName: teacher?.lastName ?? session.lastName,
    employeeNumber: teacher?.employeeNumber ?? null,
    department: teacher?.department ?? null,
  };
}

export const SICK_NOTE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const SICK_NOTE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
