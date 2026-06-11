import { UserRole } from "@prisma/client";

export const APP_NAME = "SchoolHub SA";
export const APP_TAGLINE = "School Management for South Africa";
export const COMPANY_NAME = "Cyber Developers";
export const TIMEZONE = "Africa/Johannesburg";
export const CURRENCY = "ZAR";

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  SCHOOL_ADMIN: "School Admin",
  PRINCIPAL: "Principal",
  TEACHER: "Teacher / Lecturer",
  STUDENT: "Student",
  PARENT: "Parent / Guardian",
  FINANCE_OFFICER: "Finance Officer",
  ADMISSIONS_OFFICER: "Admissions Officer",
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
