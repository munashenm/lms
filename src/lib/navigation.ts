import { getTerminology, type Terminology } from "./terminology";

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
  | "Banknote"
  | "User"
  | "Bell"
  | "Download"
  | "MessageSquare"
  | "Star"
  | "CalendarDays"
  | "NotebookPen";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
  section?: string;
  sectionIcon?: NavIconName;
}

function grouped(
  section: string,
  sectionIcon: NavIconName,
  items: Array<Omit<NavItem, "section" | "sectionIcon">>
): NavItem[] {
  return items.map((item) => ({ ...item, section, sectionIcon }));
}

export function isNavHrefActive(pathname: string, href: string, allHrefs: string[]): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !allHrefs.some(
    (other) =>
      other !== href &&
      (other === pathname || pathname.startsWith(`${other}/`)) &&
      other.startsWith(`${href}/`)
  );
}

export function getAdminNav(
  terms?: Terminology,
  opts?: { vendorTools?: boolean }
): NavItem[] {
  const t = terms;
  return [
    { label: "Dashboard", href: "/admin/dashboard", icon: "LayoutDashboard" },
    ...grouped("People", "Users", [
      { label: t?.students ?? "Learners", href: "/admin/students", icon: "Users" },
      { label: "Staff", href: "/admin/staff", icon: "UserCheck" },
      { label: "Users", href: "/admin/users", icon: "Users" },
    ]),
    ...grouped("Staff", "UserCheck", [
      { label: "Leave", href: "/admin/leave", icon: "Palmtree" },
      { label: "Staff Attendance", href: "/admin/staff-attendance", icon: "ClipboardCheck" },
      { label: "My Leave", href: "/staff/leave", icon: "Palmtree" },
    ]),
    ...grouped("Academics", "BookOpen", [
      {
        label: t?.academicSession ? `${t.academicSession}s` : "Academic Sessions",
        href: "/admin/academic",
        icon: "Calendar",
      },
      { label: t?.classes ?? "Classes", href: "/admin/classes", icon: "GraduationCap" },
      { label: t?.subjects ?? "Subjects", href: "/admin/subjects", icon: "BookOpen" },
      { label: "Timetable", href: "/admin/timetable", icon: "Calendar" },
      { label: "Attendance", href: "/admin/attendance/dashboard", icon: "ClipboardCheck" },
      { label: "Assessments", href: "/admin/assessments", icon: "FileText" },
      { label: t?.reportCards ?? "Reports", href: "/admin/report-cards", icon: "Award" },
      { label: "Certificates", href: "/admin/certificates", icon: "Award" },
    ]),
    ...grouped("Admissions", "ClipboardList", [
      { label: "Applications", href: "/admin/applications", icon: "ClipboardList" },
    ]),
    ...grouped("Organisation", "Briefcase", [
      { label: "Finance", href: "/admin/finance", icon: "CreditCard" },
      { label: "HR", href: "/admin/hr", icon: "Briefcase" },
      { label: "Payroll", href: "/admin/payroll", icon: "Banknote" },
    ]),
    ...grouped("Communication", "Megaphone", [
      { label: "Announcements", href: "/admin/announcements", icon: "Megaphone" },
      { label: "Communications", href: "/admin/communications", icon: "Megaphone" },
    ]),
    ...grouped("School", "FolderOpen", [
      { label: `${t?.student ?? "Learner"} Leave`, href: "/admin/learner-leave", icon: "Palmtree" },
      { label: "Visitor Book", href: "/admin/visitors", icon: "NotebookPen" },
      { label: "Documents", href: "/admin/documents", icon: "FolderOpen" },
    ]),
    ...grouped("Insights", "BarChart3", [
      { label: "Reports", href: "/admin/reports", icon: "BarChart3" },
    ]),
    ...grouped("Settings", "Settings", [
      { label: "School", href: "/admin/settings", icon: "Settings" },
      { label: "Licence", href: "/admin/settings/licence", icon: "Shield" },
      ...(opts?.vendorTools
        ? [{ label: "Issue licences", href: "/admin/settings/licence-server", icon: "Shield" as const }]
        : []),
      { label: "Backup & Restore", href: "/admin/settings/backup", icon: "DatabaseBackup" },
      { label: "System Health", href: "/admin/system-health", icon: "Shield" },
      { label: "SA-SAMS", href: "/admin/integrations/sa-sams", icon: "Plug" },
      { label: "Audit Log", href: "/admin/audit", icon: "FileText" },
    ]),
  ];
}

/** @deprecated Use getAdminNav(terms) for institution-aware labels */
export const adminNav: NavItem[] = getAdminNav();

export function getTeacherNav(terms?: Terminology): NavItem[] {
  const t = terms ?? getTerminology();
  return [
    { label: "Dashboard", href: "/teacher/dashboard", icon: "LayoutDashboard" },
    ...grouped("Teaching", "GraduationCap", [
      { label: `My ${t.classes}`, href: "/teacher/classes", icon: "GraduationCap" },
      { label: "Assessments", href: "/teacher/assessments", icon: "FileText" },
      { label: "Timetable", href: "/teacher/timetable", icon: "Calendar" },
      { label: "Attendance", href: "/teacher/attendance", icon: "ClipboardCheck" },
      { label: "Materials", href: "/teacher/materials", icon: "Upload" },
      { label: "Lesson Plans", href: "/teacher/lesson-plans", icon: "BookOpen" },
      { label: "Curriculum", href: "/teacher/curriculum", icon: "ClipboardList" },
      { label: `${t.student} Leave`, href: "/teacher/learner-leave", icon: "Palmtree" },
      { label: "Visitor Book", href: "/teacher/visitors", icon: "NotebookPen" },
      { label: "Announcements", href: "/teacher/announcements", icon: "Megaphone" },
    ]),
    ...grouped("My work", "User", [
      { label: "My Attendance", href: "/staff/attendance", icon: "ClipboardCheck" },
      { label: "My Leave", href: "/staff/leave", icon: "Palmtree" },
      { label: "My Payslips", href: "/staff/payslips", icon: "Banknote" },
      { label: "My Timesheets", href: "/staff/timesheets", icon: "ClipboardCheck" },
    ]),
  ];
}

/** @deprecated Use getTeacherNav(terms) */
export const teacherNav: NavItem[] = getTeacherNav();

export function getStudentNav(terms?: Terminology): NavItem[] {
  const t = terms ?? getTerminology();
  return [
    { label: "Dashboard", href: "/student/dashboard", icon: "LayoutDashboard" },
    ...grouped("Profile", "User", [
      { label: "My Profile", href: "/student/profile", icon: "User" },
      { label: "My Documents", href: "/student/documents", icon: "FolderOpen" },
    ]),
    ...grouped("Academics", "BookOpen", [
      { label: `My ${t.subjects}`, href: "/student/subjects", icon: "BookOpen" },
      { label: "Timetable", href: "/student/timetable", icon: "Calendar" },
      { label: "Lesson Plan", href: "/student/lesson-plans", icon: "ClipboardList" },
      { label: "Curriculum Progress", href: "/student/progress", icon: "BarChart3" },
      { label: t.homework, href: "/student/assignments", icon: "FileText" },
      { label: "Attendance", href: "/student/attendance", icon: "ClipboardCheck" },
    ]),
    ...grouped("Examinations", "Award", [
      { label: "Examinations", href: "/student/exams", icon: "Award" },
      { label: "Results", href: "/student/results", icon: "Award" },
      { label: t.reportCards, href: "/student/report-cards", icon: "Award" },
      { label: "Certificates", href: "/student/certificates", icon: "Award" },
    ]),
    ...grouped("Finance", "CreditCard", [
      { label: t.fees, href: "/student/fees", icon: "CreditCard" },
    ]),
    ...grouped("Communication", "Megaphone", [
      { label: "Notice Board", href: "/student/announcements", icon: "Megaphone" },
      { label: "Notifications", href: "/student/notifications", icon: "Bell" },
      { label: `${t.teacher} Reviews`, href: "/student/reviews", icon: "Star" },
    ]),
    ...grouped(t.services, "CalendarDays", [
      { label: "Apply Leave", href: "/student/leave", icon: "Palmtree" },
      { label: "Download Centre", href: "/student/downloads", icon: "Download" },
      { label: "Academic Calendar", href: "/student/calendar", icon: "CalendarDays" },
    ]),
  ];
}

/** @deprecated Use getStudentNav(terms) */
export const studentNav: NavItem[] = getStudentNav();

export const financeNav: NavItem[] = [
  { label: "Dashboard", href: "/finance/dashboard", icon: "LayoutDashboard" },
  ...grouped("Fees", "CreditCard", [
    { label: "Invoices", href: "/finance/invoices", icon: "FileText" },
    { label: "Payments", href: "/finance/payments", icon: "Wallet" },
    { label: "Debtors", href: "/finance/debtors", icon: "TrendingDown" },
    { label: "Fee Reminders", href: "/finance/reminders", icon: "Megaphone" },
    { label: "Fee Schedule", href: "/finance/fee-schedule", icon: "CreditCard" },
    { label: "Fee Structures", href: "/finance/structures", icon: "FileText" },
    { label: "Charges & plans", href: "/finance/charges", icon: "CreditCard" },
  ]),
  ...grouped("Operations", "Wallet", [
    { label: "Expenses", href: "/finance/expenses", icon: "TrendingDown" },
    { label: "Adjustments", href: "/finance/adjustments", icon: "FileText" },
    { label: "Income", href: "/finance/income", icon: "Wallet" },
    { label: "Suppliers", href: "/finance/suppliers", icon: "Users" },
    { label: "Accounts", href: "/finance/accounts", icon: "Wallet" },
  ]),
  ...grouped("Insights", "BarChart3", [
    { label: "Reports", href: "/finance/reports", icon: "BarChart3" },
    { label: "Ledger", href: "/finance/ledger", icon: "Wallet" },
  ]),
  ...grouped("My work", "User", [
    { label: "My Attendance", href: "/staff/attendance", icon: "ClipboardCheck" },
    { label: "Visitor Book", href: "/staff/visitors", icon: "NotebookPen" },
    { label: "My Leave", href: "/staff/leave", icon: "Palmtree" },
    { label: "My Payslips", href: "/staff/payslips", icon: "Banknote" },
    { label: "My Timesheets", href: "/staff/timesheets", icon: "ClipboardCheck" },
  ]),
];

export const hrNav: NavItem[] = [
  { label: "Dashboard", href: "/hr/dashboard", icon: "LayoutDashboard" },
  ...grouped("People", "Users", [
    { label: "Employees", href: "/hr/employees", icon: "Users" },
  ]),
  ...grouped("Leave", "Palmtree", [
    { label: "Leave", href: "/hr/leave", icon: "Palmtree" },
    { label: "Leave policies", href: "/hr/leave-policies", icon: "FileText" },
  ]),
  ...grouped("Payroll", "Banknote", [
    { label: "Timesheets", href: "/hr/timesheets", icon: "ClipboardCheck" },
    { label: "Payroll", href: "/hr/payroll", icon: "Banknote" },
    { label: "Reports", href: "/hr/reports", icon: "BarChart3" },
  ]),
  ...grouped("My work", "User", [
    { label: "My Attendance", href: "/staff/attendance", icon: "ClipboardCheck" },
    { label: "Visitor Book", href: "/staff/visitors", icon: "NotebookPen" },
    { label: "My Leave", href: "/staff/leave", icon: "Palmtree" },
    { label: "My Payslips", href: "/staff/payslips", icon: "Banknote" },
    { label: "My Timesheets", href: "/staff/timesheets", icon: "ClipboardCheck" },
  ]),
];

export function getParentNav(terms?: Terminology): NavItem[] {
  const t = terms ?? getTerminology();
  return [
    { label: "Dashboard", href: "/parent/dashboard", icon: "LayoutDashboard" },
    { label: "My Children", href: "/parent/children", icon: "Users" },
    ...grouped("Academics", "BookOpen", [
      { label: t.homework, href: "/parent/assignments", icon: "FileText" },
      { label: "Materials", href: "/parent/materials", icon: "FolderOpen" },
      { label: "Timetable", href: "/parent/timetable", icon: "Calendar" },
      { label: "Academic Calendar", href: "/parent/calendar", icon: "CalendarDays" },
      { label: "Examinations", href: "/parent/exams", icon: "Award" },
      { label: "Results", href: "/parent/results", icon: "Award" },
      { label: t.reportCards, href: "/parent/report-cards", icon: "Award" },
      { label: "Certificates", href: "/parent/certificates", icon: "Award" },
    ]),
    ...grouped("Wellbeing", "ClipboardCheck", [
      { label: "Attendance", href: "/parent/attendance", icon: "ClipboardCheck" },
      { label: "Apply Leave", href: "/parent/leave", icon: "Palmtree" },
    ]),
    ...grouped("Finance", "CreditCard", [
      { label: t.fees, href: "/parent/fees", icon: "CreditCard" },
    ]),
    ...grouped("Communication", "Megaphone", [
      { label: "Notice Board", href: "/parent/announcements", icon: "Megaphone" },
    ]),
    ...grouped("Resources", "Download", [
      { label: "Download Centre", href: "/parent/downloads", icon: "Download" },
    ]),
  ];
}

/** @deprecated Use getParentNav(terms) */
export const parentNav: NavItem[] = getParentNav();

export const staffNav: NavItem[] = [
  ...grouped("School", "NotebookPen", [
    { label: "Visitor Book", href: "/staff/visitors", icon: "NotebookPen" },
  ]),
  ...grouped("My work", "User", [
    { label: "My Attendance", href: "/staff/attendance", icon: "ClipboardCheck" },
    { label: "My Leave", href: "/staff/leave", icon: "Palmtree" },
    { label: "My Timesheets", href: "/staff/timesheets", icon: "ClipboardCheck" },
    { label: "My Payslips", href: "/staff/payslips", icon: "Banknote" },
  ]),
];
