import type { LicenseFeatureKey } from "@/lib/licensing/features";
import type { ActionPermission, AnyPermission } from "@/lib/permissions";

export const SYSTEM_MODULES = [
  "students",
  "admissions",
  "academics",
  "attendance",
  "assessments",
  "finance",
  "communications",
  "parent_portal",
  "student_portal",
  "website",
  "hr",
  "payroll",
  "student_cards",
  "transfers",
  "online_classes",
  "biometrics",
  "gate_security",
  "visitor_management",
  "reports",
] as const;

export type SystemModuleKey = (typeof SYSTEM_MODULES)[number];

export const SYSTEM_MODULE_LABELS: Record<SystemModuleKey, string> = {
  students: "Students",
  admissions: "Admissions",
  academics: "Academics",
  attendance: "Attendance",
  assessments: "Assessments",
  finance: "Finance",
  communications: "Communications",
  parent_portal: "Parent Portal",
  student_portal: "Student Portal",
  website: "Website Management",
  hr: "HR",
  payroll: "Payroll",
  student_cards: "Student Cards",
  transfers: "Transfers",
  online_classes: "Online Classes",
  biometrics: "Biometrics",
  gate_security: "Gate/Security",
  visitor_management: "Visitor Management",
  reports: "Reports",
};

export const MODULE_LICENSE_FEATURE: Partial<Record<SystemModuleKey, LicenseFeatureKey>> = {
  admissions: "admissions",
  attendance: "attendance",
  assessments: "assessments",
  finance: "finance",
  parent_portal: "parent_portal",
  student_portal: "student_portal",
  hr: "hr_payroll",
  payroll: "hr_payroll",
  biometrics: "biometrics",
  visitor_management: "visitor_management",
  reports: "reporting",
  online_classes: "online_exams",
};

export function isSystemModuleKey(value: string): value is SystemModuleKey {
  return (SYSTEM_MODULES as readonly string[]).includes(value);
}

export function permissionModule(permission: AnyPermission): SystemModuleKey | null {
  const key = String(permission);
  if (key.startsWith("students")) return "students";
  if (key.startsWith("attendance")) return "attendance";
  if (key.startsWith("finance")) return "finance";
  if (key.startsWith("marks") || key.startsWith("academics") || key.startsWith("classes")) return "academics";
  if (key.startsWith("payroll") || key.startsWith("hr")) return key.startsWith("payroll") ? "payroll" : "hr";
  if (key.startsWith("reports")) return "reports";
  if (key.startsWith("visitors")) return "visitor_management";
  return null;
}

export function navHrefModule(href: string): SystemModuleKey | null {
  if (href.includes("/applications") || href.includes("/website/admissions")) return "admissions";
  if (href.includes("/students/new") || href.includes("/students")) return "students";
  if (href.includes("/finance") || href.includes("/fees") || href.includes("/debtors") || href.includes("/ledger") || href.includes("/expenses")) {
    return "finance";
  }
  if (href.includes("/payroll") || href.includes("/payslips")) return "payroll";
  if (href.includes("/hr") || href.includes("/leave-policies") || href.includes("/timesheets") || href.includes("/staff")) {
    return "hr";
  }
  if (href.includes("/assessments") || href.includes("/assignments") || href.includes("/report-cards") || href.includes("/certificates") || href.includes("/exams")) {
    return "assessments";
  }
  if (href.includes("/attendance") && !href.includes("staff-attendance")) return "attendance";
  if (href.includes("/academic") || href.includes("/classes") || href.includes("/subjects") || href.includes("/timetable") || href.includes("/promotion")) {
    return "academics";
  }
  if (href.includes("/announcements") || href.includes("/communications") || href.includes("/messages") || href.includes("/calendar")) {
    return "communications";
  }
  if (href.includes("/website")) return "website";
  if (href.includes("/visitor")) return "visitor_management";
  if (href === "/admin/reports" || href.startsWith("/admin/reports/")) return "reports";
  if (href.includes("/letters")) return "transfers";
  return null;
}
