import { UserRole } from "@prisma/client";
import { ROLE_DASHBOARD } from "./constants";

export type LoginPortal = "student" | "parent" | "staff";

const STUDENT_ROLES: UserRole[] = [UserRole.STUDENT];
const PARENT_ROLES: UserRole[] = [UserRole.PARENT];
const STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.PRINCIPAL,
  UserRole.TEACHER,
  UserRole.FINANCE_OFFICER,
  UserRole.ADMISSIONS_OFFICER,
  UserRole.HR_OFFICER,
  UserRole.STAFF,
];

export const LOGIN_PORTAL_ROLES: Record<LoginPortal, UserRole[]> = {
  student: STUDENT_ROLES,
  parent: PARENT_ROLES,
  staff: STAFF_ROLES,
};

export function portalForRole(role: UserRole): LoginPortal {
  if (role === UserRole.STUDENT) return "student";
  if (role === UserRole.PARENT) return "parent";
  return "staff";
}

export function portalLoginPath(portal: LoginPortal): string {
  if (portal === "student") return "/student/login";
  if (portal === "parent") return "/parent/login";
  return "/login";
}

export function roleAllowedForPortal(role: UserRole, portal: LoginPortal): boolean {
  return LOGIN_PORTAL_ROLES[portal].includes(role);
}

export function portalMismatchMessage(role: UserRole, portal: LoginPortal): {
  message: string;
  redirect: string;
} {
  const correct = portalForRole(role);
  const labels: Record<LoginPortal, string> = {
    student: "Student Portal",
    parent: "Parent Portal",
    staff: "Staff Portal",
  };
  return {
    message: `This login is for the ${labels[portal]}. Please use the ${labels[correct]}.`,
    redirect: portalLoginPath(correct),
  };
}

export function dashboardForRole(role: UserRole): string {
  return ROLE_DASHBOARD[role];
}

export function unauthenticatedLoginPath(pathname: string): string {
  if (pathname.startsWith("/student")) return "/student/login";
  if (pathname.startsWith("/parent")) return "/parent/login";
  return "/login";
}
