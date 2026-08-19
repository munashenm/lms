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
  | "sasams.rollback";

const ENTERPRISE_FULL: Permission[] = [
  "license.view", "license.manage",
  "backup.view", "backup.create", "backup.download", "backup.restore",
  "backup.delete", "backup.settings",
  "sasams.view", "sasams.import", "sasams.map", "sasams.execute", "sasams.rollback",
];

const ENTERPRISE_VIEW: Permission[] = [
  "license.view", "backup.view", "sasams.view",
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    "students:read", "students:write", "staff:read", "staff:write",
    "classes:read", "classes:write", "attendance:read", "attendance:write",
    "marks:read", "marks:write", "finance:read", "finance:write",
    "reports:read", "settings:read", "settings:write", "audit:read",
    "announcements:write",
    ...ENTERPRISE_FULL,
  ],
  SCHOOL_ADMIN: [
    "students:read", "students:write", "staff:read", "staff:write",
    "classes:read", "classes:write", "attendance:read", "attendance:write",
    "marks:read", "marks:write", "finance:read", "finance:write",
    "reports:read", "settings:read", "settings:write", "audit:read",
    "announcements:write",
    ...ENTERPRISE_FULL,
  ],
  PRINCIPAL: [
    "students:read", "staff:read", "classes:read", "attendance:read",
    "marks:read", "finance:read", "reports:read", "settings:read",
    "audit:read", "announcements:write",
    ...ENTERPRISE_VIEW,
  ],
  TEACHER: [
    "students:read", "classes:read", "attendance:read", "attendance:write",
    "marks:read", "marks:write", "announcements:write",
  ],
  STUDENT: ["marks:read", "attendance:read"],
  PARENT: ["students:read", "marks:read", "attendance:read", "finance:read"],
  FINANCE_OFFICER: [
    "students:read", "finance:read", "finance:write", "reports:read",
  ],
  ADMISSIONS_OFFICER: [
    "students:read", "students:write", "reports:read",
  ],
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
