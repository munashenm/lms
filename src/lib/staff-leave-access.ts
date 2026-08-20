import { UserRole } from "@prisma/client";

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
