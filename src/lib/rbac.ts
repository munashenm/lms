import { UserRole } from "@prisma/client";
import type { SessionPayload } from "./auth";

export type Permission =
  | "students:read"
  | "students:write"
  | "staff:read"
  | "staff:write"
  | "classes:read"
  | "classes:write"
  | "attendance:read"
  | "attendance:write"
  | "marks:read"
  | "marks:write"
  | "finance:read"
  | "finance:write"
  | "finance.view"
  | "finance.fees.manage"
  | "finance.payments.create"
  | "finance.payments.reverse"
  | "finance.receipts.view"
  | "finance.expenses.manage"
  | "finance.reports.view"
  | "hr.view"
  | "hr.employees.manage"
  | "hr.documents.manage"
  | "hr.leave.manage"
  | "hr.leave.approve"
  | "payroll.view"
  | "payroll.prepare"
  | "payroll.approve"
  | "payroll.finalise"
  | "reports:read"
  | "settings:read"
  | "settings:write"
  | "audit:read"
  | "announcements:write"
  | "license.view"
  | "license.manage"
  | "backup.view"
  | "backup.create"
  | "backup.download"
  | "backup.restore"
  | "backup.delete"
  | "backup.settings"
  | "sasams.view"
  | "sasams.import"
  | "sasams.map"
  | "sasams.execute"
  | "sasams.rollback"
  | "visitors:read"
  | "visitors:write";

const ENTERPRISE_FULL: Permission[] = [
  "license.view", "license.manage",
  "backup.view", "backup.create", "backup.download", "backup.restore",
  "backup.delete", "backup.settings",
  "sasams.view", "sasams.import", "sasams.map", "sasams.execute", "sasams.rollback",
];

const ENTERPRISE_VIEW: Permission[] = [
  "license.view", "backup.view", "sasams.view",
];

const FINANCE_ALL: Permission[] = [
  "finance:read", "finance:write",
  "finance.view", "finance.fees.manage", "finance.payments.create",
  "finance.payments.reverse", "finance.receipts.view", "finance.expenses.manage",
  "finance.reports.view",
];

const HR_ALL: Permission[] = [
  "hr.view", "hr.employees.manage", "hr.documents.manage",
  "hr.leave.manage", "hr.leave.approve",
];

const PAYROLL_ALL: Permission[] = [
  "payroll.view", "payroll.prepare", "payroll.approve", "payroll.finalise",
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    "students:read", "students:write", "staff:read", "staff:write",
    "classes:read", "classes:write", "attendance:read", "attendance:write",
    "marks:read", "marks:write",
    "reports:read", "settings:read", "settings:write", "audit:read",
    "announcements:write",
    "visitors:read", "visitors:write",
    ...FINANCE_ALL, ...HR_ALL, ...PAYROLL_ALL,
    ...ENTERPRISE_FULL,
  ],
  SCHOOL_ADMIN: [
    "students:read", "students:write", "staff:read", "staff:write",
    "classes:read", "classes:write", "attendance:read", "attendance:write",
    "marks:read", "marks:write",
    "reports:read", "settings:read", "settings:write", "audit:read",
    "announcements:write",
    "visitors:read", "visitors:write",
    ...FINANCE_ALL, ...HR_ALL, ...PAYROLL_ALL,
    ...ENTERPRISE_FULL,
  ],
  PRINCIPAL: [
    "students:read", "staff:read", "classes:read", "attendance:read",
    "marks:read", "finance:read", "finance.view", "finance.reports.view",
    "hr.view", "payroll.view",
    "reports:read", "settings:read",
    "audit:read", "announcements:write",
    "visitors:read", "visitors:write",
    ...ENTERPRISE_VIEW,
  ],
  TEACHER: [
    "students:read", "classes:read", "attendance:read", "attendance:write",
    "marks:read", "marks:write", "announcements:write",
    "visitors:read", "visitors:write",
  ],
  STUDENT: ["marks:read", "attendance:read"],
  PARENT: ["students:read", "marks:read", "attendance:read", "finance:read", "finance.receipts.view"],
  FINANCE_OFFICER: [
    "students:read", ...FINANCE_ALL, "reports:read",
    "visitors:read", "visitors:write",
  ],
  ADMISSIONS_OFFICER: [
    "students:read", "students:write", "reports:read",
    "visitors:read", "visitors:write",
  ],
  HR_OFFICER: [
    "staff:read", "staff:write", ...HR_ALL, ...PAYROLL_ALL, "reports:read",
    "visitors:read", "visitors:write",
  ],
  STAFF: ["visitors:read", "visitors:write"],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.PRINCIPAL,
  UserRole.ADMISSIONS_OFFICER,
];

const FINANCE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.FINANCE_OFFICER,
];

export function canAccessAdmin(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function canAccessFinance(role: UserRole): boolean {
  return FINANCE_ROLES.includes(role);
}

const HR_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.HR_OFFICER,
];

export function canAccessHr(role: UserRole): boolean {
  return HR_ROLES.includes(role) || role === UserRole.PRINCIPAL;
}

export function requirePermission(
  session: SessionPayload | null,
  permission: Permission
): session is SessionPayload {
  if (!session) return false;
  return hasPermission(session.role, permission);
}

export function getSchoolFilter(session: SessionPayload): { schoolId: string } | Record<string, never> {
  if (session.role === UserRole.SUPER_ADMIN) return {};
  if (!session.schoolId) return { schoolId: "none" };
  return { schoolId: session.schoolId };
}

/** Tenant isolation: school users may only access their own institution. */
export function canAccessSchool(session: SessionPayload, schoolId: string): boolean {
  if (session.role === UserRole.SUPER_ADMIN) return true;
  return Boolean(session.schoolId && session.schoolId === schoolId);
}

export function canManageEnterprise(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SCHOOL_ADMIN;
}
