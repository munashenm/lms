import type { Terminology } from "./terminology";

export type NavIconName =
  | "LayoutDashboard"
  | "Users"
  | "UserCheck"
  | "GraduationCap"
  | "BookOpen"
  | "Calendar"
  | "ClipboardCheck"
  | "FileText"
  | "CreditCard"
  | "Megaphone"
  | "Settings"
  | "BarChart3"
  | "FolderOpen"
  | "ClipboardList"
  | "Award"
  | "Upload"
  | "Wallet"
  | "TrendingDown"
  | "Palmtree"
  | "Shield"
  | "DatabaseBackup"
  | "Plug"
  | "Briefcase"
  | "Banknote";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
}

export function getAdminNav(
  terms?: Terminology,
  opts?: { vendorTools?: boolean }
): NavItem[] {
  const t = terms;
  const items: NavItem[] = [
    { label: "Dashboard", href: "/admin/dashboard", icon: "LayoutDashboard" },
    { label: t?.students ?? "Students", href: "/admin/students", icon: "Users" },
    { label: "Staff", href: "/admin/staff", icon: "UserCheck" },
    { label: "Leave", href: "/admin/leave", icon: "Palmtree" },
    { label: "Staff Attendance", href: "/admin/staff-attendance", icon: "ClipboardCheck" },
    { label: "My Leave", href: "/staff/leave", icon: "Palmtree" },
    { label: "Academic Sessions", href: "/admin/academic", icon: "Calendar" },
    { label: t?.classes ?? "Classes", href: "/admin/classes", icon: "GraduationCap" },
    { label: t?.subjects ?? "Subjects", href: "/admin/subjects", icon: "BookOpen" },
    { label: "Timetable", href: "/admin/timetable", icon: "Calendar" },
    { label: "Attendance", href: "/admin/attendance/dashboard", icon: "ClipboardCheck" },
    { label: "Assessments", href: "/admin/assessments", icon: "FileText" },
    { label: "Report Cards", href: "/admin/report-cards", icon: "Award" },
    { label: "Certificates", href: "/admin/certificates", icon: "Award" },
    { label: "Applications", href: "/admin/applications", icon: "ClipboardList" },
    { label: "Finance", href: "/admin/finance", icon: "CreditCard" },
    { label: "HR", href: "/admin/hr", icon: "Briefcase" },
    { label: "Payroll", href: "/admin/payroll", icon: "Banknote" },
    { label: "Announcements", href: "/admin/announcements", icon: "Megaphone" },
    { label: "Communications", href: "/admin/communications", icon: "Megaphone" },
    { label: "Documents", href: "/admin/documents", icon: "FolderOpen" },
    { label: "Reports", href: "/admin/reports", icon: "BarChart3" },
    { label: "Audit Log", href: "/admin/audit", icon: "FileText" },
    { label: "System Health", href: "/admin/system-health", icon: "Shield" },
    { label: "Licence", href: "/admin/settings/licence", icon: "Shield" },
    ...(opts?.vendorTools
      ? [{ label: "Issue licences", href: "/admin/settings/licence-server", icon: "Shield" as const }]
      : []),
    { label: "Backup & Restore", href: "/admin/settings/backup", icon: "DatabaseBackup" },
    { label: "SA-SAMS", href: "/admin/integrations/sa-sams", icon: "Plug" },
    { label: "Settings", href: "/admin/settings", icon: "Settings" },
  ];
  return items;
}

/** @deprecated Use getAdminNav(terms) for institution-aware labels */
export const adminNav: NavItem[] = getAdminNav();

export const teacherNav: NavItem[] = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: "LayoutDashboard" },
  { label: "My Classes", href: "/teacher/classes", icon: "GraduationCap" },
  { label: "Assessments", href: "/teacher/assessments", icon: "FileText" },
  { label: "Timetable", href: "/teacher/timetable", icon: "Calendar" },
  { label: "Attendance", href: "/teacher/attendance", icon: "ClipboardCheck" },
  { label: "My Attendance", href: "/staff/attendance", icon: "ClipboardCheck" },
  { label: "My Leave", href: "/staff/leave", icon: "Palmtree" },
  { label: "Materials", href: "/teacher/materials", icon: "Upload" },
  { label: "My Payslips", href: "/staff/payslips", icon: "Banknote" },
  { label: "My Timesheets", href: "/staff/timesheets", icon: "ClipboardCheck" },
  { label: "Announcements", href: "/teacher/announcements", icon: "Megaphone" },
];

export const studentNav: NavItem[] = [
  { label: "Dashboard", href: "/student/dashboard", icon: "LayoutDashboard" },
  { label: "Results", href: "/student/results", icon: "Award" },
  { label: "Assignments", href: "/student/assignments", icon: "FileText" },
  { label: "Report Cards", href: "/student/report-cards", icon: "Award" },
  { label: "Certificates", href: "/student/certificates", icon: "Award" },
  { label: "Fees", href: "/student/fees", icon: "CreditCard" },
  { label: "Timetable", href: "/student/timetable", icon: "Calendar" },
  { label: "Subjects", href: "/student/subjects", icon: "BookOpen" },
  { label: "Materials", href: "/student/materials", icon: "FolderOpen" },
  { label: "Attendance", href: "/student/attendance", icon: "ClipboardCheck" },
  { label: "Announcements", href: "/student/announcements", icon: "Megaphone" },
];

export const financeNav: NavItem[] = [
  { label: "Dashboard", href: "/finance/dashboard", icon: "LayoutDashboard" },
  { label: "Invoices", href: "/finance/invoices", icon: "FileText" },
  { label: "Payments", href: "/finance/payments", icon: "Wallet" },
  { label: "Debtors", href: "/finance/debtors", icon: "TrendingDown" },
  { label: "Fee Reminders", href: "/finance/reminders", icon: "Megaphone" },
  { label: "Fee Schedule", href: "/finance/fee-schedule", icon: "CreditCard" },
  { label: "Fee Structures", href: "/finance/structures", icon: "FileText" },
  { label: "Charges & plans", href: "/finance/charges", icon: "CreditCard" },
  { label: "Expenses", href: "/finance/expenses", icon: "TrendingDown" },
  { label: "Adjustments", href: "/finance/adjustments", icon: "FileText" },
  { label: "Income", href: "/finance/income", icon: "Wallet" },
  { label: "Suppliers", href: "/finance/suppliers", icon: "Users" },
  { label: "Accounts", href: "/finance/accounts", icon: "Wallet" },
  { label: "Reports", href: "/finance/reports", icon: "BarChart3" },
  { label: "Ledger", href: "/finance/ledger", icon: "Wallet" },
  { label: "My Attendance", href: "/staff/attendance", icon: "ClipboardCheck" },
  { label: "My Leave", href: "/staff/leave", icon: "Palmtree" },
  { label: "My Payslips", href: "/staff/payslips", icon: "Banknote" },
  { label: "My Timesheets", href: "/staff/timesheets", icon: "ClipboardCheck" },
];

export const hrNav: NavItem[] = [
  { label: "Dashboard", href: "/hr/dashboard", icon: "LayoutDashboard" },
  { label: "Employees", href: "/hr/employees", icon: "Users" },
  { label: "Leave", href: "/hr/leave", icon: "Palmtree" },
  { label: "Leave policies", href: "/hr/leave-policies", icon: "FileText" },
  { label: "Timesheets", href: "/hr/timesheets", icon: "ClipboardCheck" },
  { label: "Payroll", href: "/hr/payroll", icon: "Banknote" },
  { label: "Reports", href: "/hr/reports", icon: "BarChart3" },
  { label: "My Attendance", href: "/staff/attendance", icon: "ClipboardCheck" },
  { label: "My Leave", href: "/staff/leave", icon: "Palmtree" },
  { label: "My Payslips", href: "/staff/payslips", icon: "Banknote" },
  { label: "My Timesheets", href: "/staff/timesheets", icon: "ClipboardCheck" },
];

export const parentNav: NavItem[] = [
  { label: "Dashboard", href: "/parent/dashboard", icon: "LayoutDashboard" },
  { label: "My Children", href: "/parent/children", icon: "Users" },
  { label: "Fees", href: "/parent/fees", icon: "CreditCard" },
  { label: "Attendance", href: "/parent/attendance", icon: "ClipboardCheck" },
  { label: "Results", href: "/parent/results", icon: "Award" },
  { label: "Report Cards", href: "/parent/report-cards", icon: "Award" },
  { label: "Timetable", href: "/parent/timetable", icon: "Calendar" },
  { label: "Certificates", href: "/parent/certificates", icon: "Award" },
  { label: "Announcements", href: "/parent/announcements", icon: "Megaphone" },
];
