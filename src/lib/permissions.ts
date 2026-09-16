import { UserRole } from "@prisma/client";

/** Action-level permission keys used by Super Admin screens and access checks. */
export const ACTION_PERMISSIONS = [
  "students.view",
  "students.create",
  "students.edit",
  "students.archive",
  "students.delete",
  "students.export",
  "students.promote",
  "students.transfer",
  "students.promotion_override",
  "attendance.view",
  "attendance.capture",
  "attendance.edit",
  "attendance.reports",
  "finance.view",
  "finance.create_charge",
  "finance.record_payment",
  "finance.reverse_payment",
  "finance.send_statement",
  "finance.reports",
  "academics.view",
  "academics.manage_classes",
  "academics.manage_subjects",
  "academics.capture_marks",
  "academics.publish_results",
  "users.view",
  "users.create",
  "users.edit",
  "users.disable",
  "users.permissions",
  "settings.manage",
  "reports.view",
  "reports.export",
] as const;

export type ActionPermission = (typeof ACTION_PERMISSIONS)[number];

export type LegacyPermission =
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

export type AnyPermission = ActionPermission | LegacyPermission;

/** Maps a new action permission onto the existing role-matrix keys it satisfies. */
export const ACTION_TO_LEGACY: Record<ActionPermission, LegacyPermission[]> = {
  "students.view": ["students:read"],
  "students.create": ["students:write"],
  "students.edit": ["students:write"],
  "students.archive": ["students:write"],
  "students.delete": ["students:write"],
  "students.export": ["students:read"],
  "students.promote": ["students:write"],
  "students.transfer": ["students:write"],
  "students.promotion_override": ["settings:write"],
  "attendance.view": ["attendance:read"],
  "attendance.capture": ["attendance:write"],
  "attendance.edit": ["attendance:write"],
  "attendance.reports": ["attendance:read"],
  "finance.view": ["finance:read", "finance.view"],
  "finance.create_charge": ["finance:write", "finance.fees.manage"],
  "finance.record_payment": ["finance.payments.create"],
  "finance.reverse_payment": ["finance.payments.reverse"],
  "finance.send_statement": ["finance:write"],
  "finance.reports": ["finance.reports.view"],
  "academics.view": ["classes:read"],
  "academics.manage_classes": ["classes:write"],
  "academics.manage_subjects": ["classes:write"],
  "academics.capture_marks": ["marks:write"],
  "academics.publish_results": ["marks:write"],
  "users.view": ["settings:read"],
  "users.create": ["settings:write"],
  "users.edit": ["settings:write"],
  "users.disable": ["settings:write"],
  "users.permissions": ["settings:write"],
  "settings.manage": ["settings:write"],
  "reports.view": ["reports:read"],
  "reports.export": ["reports:read"],
};

export const PERMISSION_GROUPS: Array<{
  id: string;
  label: string;
  permissions: ActionPermission[];
}> = [
  {
    id: "students",
    label: "Students",
    permissions: [
      "students.view",
      "students.create",
      "students.edit",
      "students.archive",
      "students.delete",
      "students.export",
      "students.promote",
      "students.transfer",
      "students.promotion_override",
    ],
  },
  {
    id: "attendance",
    label: "Attendance",
    permissions: ["attendance.view", "attendance.capture", "attendance.edit", "attendance.reports"],
  },
  {
    id: "finance",
    label: "Finance",
    permissions: [
      "finance.view",
      "finance.create_charge",
      "finance.record_payment",
      "finance.reverse_payment",
      "finance.send_statement",
      "finance.reports",
    ],
  },
  {
    id: "academics",
    label: "Academics",
    permissions: [
      "academics.view",
      "academics.manage_classes",
      "academics.manage_subjects",
      "academics.capture_marks",
      "academics.publish_results",
    ],
  },
  {
    id: "users",
    label: "Users",
    permissions: ["users.view", "users.create", "users.edit", "users.disable", "users.permissions"],
  },
  {
    id: "settings",
    label: "Settings & reports",
    permissions: ["settings.manage", "reports.view", "reports.export"],
  },
];

export const PERMISSION_LABELS: Record<ActionPermission, string> = {
  "students.view": "View Students",
  "students.create": "Create Students",
  "students.edit": "Edit Students",
  "students.archive": "Archive Students",
  "students.delete": "Delete Students",
  "students.export": "Export Students",
  "students.promote": "Promote Students",
  "students.transfer": "Transfer Students",
  "students.promotion_override": "Override Promotion Decision",
  "attendance.view": "View Attendance",
  "attendance.capture": "Capture Attendance",
  "attendance.edit": "Edit Attendance",
  "attendance.reports": "Attendance Reports",
  "finance.view": "View Finance",
  "finance.create_charge": "Create Charges",
  "finance.record_payment": "Record Payments",
  "finance.reverse_payment": "Reverse Payments",
  "finance.send_statement": "Send Statements",
  "finance.reports": "Finance Reports",
  "academics.view": "View Classes",
  "academics.manage_classes": "Manage Classes",
  "academics.manage_subjects": "Manage Subjects",
  "academics.capture_marks": "Capture Marks",
  "academics.publish_results": "Publish Results",
  "users.view": "View Users",
  "users.create": "Create Users",
  "users.edit": "Edit Users",
  "users.disable": "Disable Users",
  "users.permissions": "Manage Permissions",
  "settings.manage": "Manage Settings",
  "reports.view": "View Reports",
  "reports.export": "Export Reports",
};

export function isActionPermission(value: string): value is ActionPermission {
  return (ACTION_PERMISSIONS as readonly string[]).includes(value);
}

export function roleHasLegacy(owned: Iterable<string>, needed: AnyPermission): boolean {
  const set = owned instanceof Set ? owned : new Set(owned);
  if (set.has(needed)) return true;

  if (isActionPermission(needed)) {
    return ACTION_TO_LEGACY[needed].some((legacy) => set.has(legacy));
  }

  for (const [action, legacy] of Object.entries(ACTION_TO_LEGACY) as Array<[ActionPermission, LegacyPermission[]]>) {
    if (legacy.includes(needed as LegacyPermission) && set.has(action)) return true;
  }
  return false;
}

export function defaultActionPermissionsForRole(role: UserRole, legacyOwned: Iterable<string>): ActionPermission[] {
  return ACTION_PERMISSIONS.filter((permission) => roleHasLegacy(legacyOwned, permission));
}
