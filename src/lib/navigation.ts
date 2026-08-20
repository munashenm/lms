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
  group?: string;
}

function grouped(
  section: string,
  sectionIcon: NavIconName,
  items: Array<Omit<NavItem, "section" | "sectionIcon">>
): NavItem[] {
  return items.map((item) => ({ ...item, section, sectionIcon }));
}

function cluster(
  group: string,
  items: Array<Omit<NavItem, "section" | "sectionIcon" | "group">>
): Array<Omit<NavItem, "section" | "sectionIcon">> {
  return items.map((item) => ({ ...item, group }));
}

export function navClusters(items: NavItem[]): Array<{ group?: string; items: NavItem[] }> {
  const clusters: Array<{ group?: string; items: NavItem[] }> = [];
  for (const item of items) {
    const last = clusters[clusters.length - 1];
    if (last && last.group === item.group) {
      last.items.push(item);
    } else {
      clusters.push({ group: item.group, items: [item] });
    }
  }
  return clusters;
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

/** Sibling tabs for the current page: a named group, or the whole section when it is short. */
export function navPageTabs(
  pathname: string,
  navItems: NavItem[]
): Array<{ label: string; href: string }> {
  const hrefs = navItems.map((item) => item.href);
  const current = navItems.find((item) => isNavHrefActive(pathname, item.href, hrefs));
  if (!current?.section) return [];
  const sectionItems = navItems.filter((item) => item.section === current.section);

  if (current.group) {
    return sectionItems
      .filter((item) => item.group === current.group)
      .map((item) => ({ label: item.label, href: item.href }));
  }

  if (sectionItems.some((item) => item.group)) {
    const tabs: Array<{ label: string; href: string }> = [];
    const seen = new Set<string>();
    for (const item of sectionItems) {
      const key = item.group ?? item.href;
      if (seen.has(key)) continue;
      seen.add(key);
      tabs.push({ label: item.group ?? item.label, href: item.href });
    }
    return tabs.length >= 2 ? tabs : [];
  }

  if (sectionItems.length >= 2 && sectionItems.length <= 8) {
    return sectionItems.map((item) => ({ label: item.label, href: item.href }));
  }
  return [];
}

/** Admin Finance dropdown — billing, collections and ledgers. */
export function getAdminFinanceNavItems(): Array<Omit<NavItem, "section" | "sectionIcon">> {
  return [
    { label: "Overview", href: "/admin/finance", icon: "LayoutDashboard" },
    ...cluster("Fees", [
      { label: "Fee Schedule", href: "/admin/finance/fee-schedule", icon: "CreditCard" },
      { label: "Fee Structures", href: "/admin/finance/structures", icon: "FileText" },
      { label: "Charges & plans", href: "/admin/finance/charges", icon: "CreditCard" },
      { label: "Invoices", href: "/admin/finance/invoices", icon: "FileText" },
      { label: "New Invoice", href: "/admin/finance/invoices/new", icon: "FileText" },
    ]),
    ...cluster("Collections", [
      { label: "Collect fees", href: "/admin/finance/collect", icon: "Wallet" },
      { label: "Debtors", href: "/admin/finance/debtors", icon: "TrendingDown" },
      { label: "Fee Reminders", href: "/admin/finance/reminders", icon: "Megaphone" },
    ]),
    ...cluster("Books", [
      { label: "Expenses", href: "/admin/finance/expenses", icon: "TrendingDown" },
      { label: "Credits & aid", href: "/admin/finance/adjustments", icon: "FileText" },
      { label: "Income & Expenses", href: "/admin/finance/ledger", icon: "Wallet" },
      { label: "Reports", href: "/admin/finance/reports", icon: "BarChart3" },
    ]),
  ];
}

/** Admin Students dropdown — applications, registration and records. */
export function getAdminStudentNavItems(
  _terms?: Terminology
): Array<Omit<NavItem, "section" | "sectionIcon">> {
  return [
    ...cluster("Admission", [
      { label: "Online applications", href: "/admin/applications", icon: "ClipboardList" },
      { label: "Registration", href: "/admin/students/new", icon: "UserCheck" },
    ]),
    ...cluster("Records", [
      { label: "Student details", href: "/admin/students", icon: "Users" },
      { label: "Student absent request", href: "/admin/learner-leave", icon: "Palmtree" },
    ]),
  ];
}

/** Admin Human Resource dropdown — staff, time and payroll. Stays on /admin paths. */
export function getAdminHrNavItems(): Array<Omit<NavItem, "section" | "sectionIcon">> {
  return [
    ...cluster("Directory", [
      { label: "Staff", href: "/admin/staff", icon: "UserCheck" },
      { label: "Employees", href: "/admin/hr", icon: "Briefcase" },
    ]),
    ...cluster("Time", [
      { label: "Staff Attendance", href: "/admin/staff-attendance", icon: "ClipboardCheck" },
      { label: "Staff Leave", href: "/admin/leave", icon: "Palmtree" },
      { label: "Timesheets", href: "/admin/hr/timesheets", icon: "ClipboardCheck" },
    ]),
    ...cluster("Pay", [
      { label: "Payroll", href: "/admin/payroll", icon: "Banknote" },
      { label: "Leave policies", href: "/admin/hr/leave-policies", icon: "FileText" },
      { label: "HR Reports", href: "/admin/hr/reports", icon: "BarChart3" },
    ]),
  ];
}

export function getAdminNav(
  terms?: Terminology,
  opts?: { vendorTools?: boolean }
): NavItem[] {
  const t = terms;
  return [
    { label: "Dashboard", href: "/admin/dashboard", icon: "LayoutDashboard" },
    ...grouped("Students", "Users", getAdminStudentNavItems(t)),
    ...grouped("Human Resource", "Briefcase", getAdminHrNavItems()),
    ...grouped("Academics", "BookOpen", [
      ...cluster("Setup", [
        {
          label: t?.academicSession ? `${t.academicSession}s` : "Academic Sessions",
          href: "/admin/academic",
          icon: "Calendar",
        },
        { label: t?.classes ?? "Classes", href: "/admin/classes", icon: "GraduationCap" },
        { label: t?.subjects ?? "Subjects", href: "/admin/subjects", icon: "BookOpen" },
        { label: "Timetable", href: "/admin/timetable", icon: "Calendar" },
      ]),
      ...cluster("Classroom", [
        { label: "Attendance", href: "/admin/attendance/dashboard", icon: "ClipboardCheck" },
        { label: "Assessments", href: "/admin/assessments", icon: "FileText" },
      ]),
      ...cluster("Results", [
        { label: t?.reportCards ?? "Reports", href: "/admin/report-cards", icon: "Award" },
        { label: "Certificates", href: "/admin/certificates", icon: "Award" },
      ]),
    ]),
    ...grouped("Finance", "CreditCard", getAdminFinanceNavItems()),
    ...grouped("Communication", "Megaphone", [
      { label: "Announcements", href: "/admin/announcements", icon: "Megaphone" },
      { label: "Email & SMS", href: "/admin/communications", icon: "Megaphone" },
    ]),
    ...grouped("School", "FolderOpen", [
      { label: "Visitor Book", href: "/admin/visitors", icon: "NotebookPen" },
      { label: "Documents", href: "/admin/documents", icon: "FolderOpen" },
    ]),
    ...grouped("Insights", "BarChart3", [
      { label: "Reports", href: "/admin/reports", icon: "BarChart3" },
    ]),
    ...grouped("Settings", "Settings", [
      ...cluster("School", [
        { label: "Users", href: "/admin/users", icon: "Users" },
        { label: "School settings", href: "/admin/settings", icon: "Settings" },
        { label: "Licence", href: "/admin/settings/licence", icon: "Shield" },
        ...(opts?.vendorTools
          ? [{ label: "Issue licences", href: "/admin/settings/licence-server", icon: "Shield" as const }]
          : []),
      ]),
      ...cluster("Platform", [
        { label: "Backup & Restore", href: "/admin/settings/backup", icon: "DatabaseBackup" },
        { label: "System Health", href: "/admin/system-health", icon: "Shield" },
        { label: "SA-SAMS", href: "/admin/integrations/sa-sams", icon: "Plug" },
        { label: "Audit Log", href: "/admin/audit", icon: "FileText" },
      ]),
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
      ...cluster("Classwork", [
        { label: `My ${t.classes}`, href: "/teacher/classes", icon: "GraduationCap" },
        { label: "Assessments", href: "/teacher/assessments", icon: "FileText" },
        { label: "Timetable", href: "/teacher/timetable", icon: "Calendar" },
        { label: "Attendance", href: "/teacher/attendance", icon: "ClipboardCheck" },
        { label: "Materials", href: "/teacher/materials", icon: "Upload" },
        { label: "Lesson Plans", href: "/teacher/lesson-plans", icon: "BookOpen" },
        { label: "Curriculum", href: "/teacher/curriculum", icon: "ClipboardList" },
      ]),
      ...cluster("Campus", [
        { label: `${t.student} Leave`, href: "/teacher/learner-leave", icon: "Palmtree" },
        { label: "Visitor Book", href: "/teacher/visitors", icon: "NotebookPen" },
        { label: "Announcements", href: "/teacher/announcements", icon: "Megaphone" },
      ]),
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
      ...cluster("Classroom", [
        { label: `My ${t.subjects}`, href: "/student/subjects", icon: "BookOpen" },
        { label: "Timetable", href: "/student/timetable", icon: "Calendar" },
        { label: "Lesson Plan", href: "/student/lesson-plans", icon: "ClipboardList" },
        { label: "Curriculum Progress", href: "/student/progress", icon: "BarChart3" },
        { label: t.homework, href: "/student/assignments", icon: "FileText" },
        { label: "Attendance", href: "/student/attendance", icon: "ClipboardCheck" },
      ]),
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
    { label: "Fee Schedule", href: "/finance/fee-schedule", icon: "CreditCard" },
    { label: "Fee Structures", href: "/finance/structures", icon: "FileText" },
    { label: "Charges & plans", href: "/finance/charges", icon: "CreditCard" },
    { label: "Invoices", href: "/finance/invoices", icon: "FileText" },
    { label: "New Invoice", href: "/finance/invoices/new", icon: "FileText" },
  ]),
  ...grouped("Collections", "Wallet", [
    { label: "Collect fees", href: "/finance/collect", icon: "Wallet" },
    { label: "Payments", href: "/finance/payments", icon: "Wallet" },
    { label: "Debtors", href: "/finance/debtors", icon: "TrendingDown" },
    { label: "Fee Reminders", href: "/finance/reminders", icon: "Megaphone" },
  ]),
  ...grouped("Books", "BarChart3", [
    { label: "Expenses", href: "/finance/expenses", icon: "TrendingDown" },
    { label: "Credits & aid", href: "/finance/adjustments", icon: "FileText" },
    { label: "Income & Expenses", href: "/finance/ledger", icon: "Wallet" },
    { label: "Reports", href: "/finance/reports", icon: "BarChart3" },
  ]),
  ...grouped("Operations", "Wallet", [
    { label: "Income", href: "/finance/income", icon: "Wallet" },
    { label: "Suppliers", href: "/finance/suppliers", icon: "Users" },
    { label: "Accounts", href: "/finance/accounts", icon: "Wallet" },
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
  ...grouped("Human Resource", "Briefcase", [
    ...cluster("Directory", [
      { label: "Staff", href: "/hr/staff", icon: "UserCheck" },
      { label: "Employees", href: "/hr/employees", icon: "Users" },
    ]),
    ...cluster("Time", [
      { label: "Staff Attendance", href: "/hr/staff-attendance", icon: "ClipboardCheck" },
      { label: "Staff Leave", href: "/hr/leave", icon: "Palmtree" },
      { label: "Timesheets", href: "/hr/timesheets", icon: "ClipboardCheck" },
    ]),
    ...cluster("Pay", [
      { label: "Payroll", href: "/hr/payroll", icon: "Banknote" },
      { label: "Leave policies", href: "/hr/leave-policies", icon: "FileText" },
      { label: "HR Reports", href: "/hr/reports", icon: "BarChart3" },
    ]),
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
      ...cluster("Classroom", [
        { label: t.homework, href: "/parent/assignments", icon: "FileText" },
        { label: "Materials", href: "/parent/materials", icon: "FolderOpen" },
        { label: "Timetable", href: "/parent/timetable", icon: "Calendar" },
        { label: "Academic Calendar", href: "/parent/calendar", icon: "CalendarDays" },
      ]),
      ...cluster("Results", [
        { label: "Examinations", href: "/parent/exams", icon: "Award" },
        { label: "Results", href: "/parent/results", icon: "Award" },
        { label: t.reportCards, href: "/parent/report-cards", icon: "Award" },
        { label: "Certificates", href: "/parent/certificates", icon: "Award" },
      ]),
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
