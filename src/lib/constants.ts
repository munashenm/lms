import { UserRole } from "@prisma/client";

export const APP_NAME = "SchoolHub SA";
export const APP_TAGLINE = "School Management for South Africa";
export const COMPANY_NAME = "Cyber Developers";
export const COMPANY_WEBSITE = "https://www.cyberdevelopers.co.za";
export const DEFAULT_BRAND_LOGO_URL = "/brand/logo.png";
export const DEFAULT_BRAND_MARK_URL = "/brand/mark.png";
export const TIMEZONE = "Africa/Johannesburg";
export const CURRENCY = "ZAR";

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  SCHOOL_ADMIN: "School Admin",
  PRINCIPAL: "Principal",
  TEACHER: "Teacher / Lecturer",
  STUDENT: "Learner",
  PARENT: "Parent / Guardian",
  FINANCE_OFFICER: "Finance Officer",
  ADMISSIONS_OFFICER: "Admissions Officer",
  HR_OFFICER: "HR Officer",
  STAFF: "Staff",
};

export const ROLE_DASHBOARD: Record<UserRole, string> = {
  SUPER_ADMIN: "/admin/dashboard",
  SCHOOL_ADMIN: "/admin/dashboard",
  PRINCIPAL: "/admin/dashboard",
  TEACHER: "/teacher/dashboard",
  STUDENT: "/student/dashboard",
  PARENT: "/parent/dashboard",
  FINANCE_OFFICER: "/finance/dashboard",
  ADMISSIONS_OFFICER: "/admin/applications",
  HR_OFFICER: "/hr/dashboard",
  STAFF: "/staff/leave",
};

export const ROLE_MESSAGES: Record<UserRole, string> = {
  SUPER_ADMIN: "/admin/messages",
  SCHOOL_ADMIN: "/admin/messages",
  PRINCIPAL: "/admin/messages",
  TEACHER: "/teacher/messages",
  STUDENT: "/student/messages",
  PARENT: "/parent/messages",
  FINANCE_OFFICER: "/finance/messages",
  ADMISSIONS_OFFICER: "/admin/messages",
  HR_OFFICER: "/hr/messages",
  STAFF: "/staff/messages",
};

export const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.PRINCIPAL,
  UserRole.ADMISSIONS_OFFICER,
];

export const SA_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
] as const;

export const GRADE_PHASES = {
  FOUNDATION: "Foundation Phase (R–3)",
  INTERMEDIATE: "Intermediate Phase (4–6)",
  SENIOR: "Senior Phase (7–9)",
  FET: "FET Phase (10–12)",
} as const;
