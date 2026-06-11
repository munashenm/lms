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
  | "TrendingDown";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
}

export const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "LayoutDashboard" },
  { label: "Students", href: "/admin/students", icon: "Users" },
  { label: "Staff", href: "/admin/staff", icon: "UserCheck" },
  { label: "Classes", href: "/admin/classes", icon: "GraduationCap" },
  { label: "Subjects", href: "/admin/subjects", icon: "BookOpen" },
  { label: "Timetable", href: "/admin/timetable", icon: "Calendar" },
  { label: "Attendance", href: "/admin/attendance", icon: "ClipboardCheck" },
  { label: "Assessments", href: "/admin/assessments", icon: "FileText" },
  { label: "Report Cards", href: "/admin/report-cards", icon: "Award" },
  { label: "Applications", href: "/admin/applications", icon: "ClipboardList" },
  { label: "Finance", href: "/admin/finance", icon: "CreditCard" },
  { label: "Announcements", href: "/admin/announcements", icon: "Megaphone" },
  { label: "Documents", href: "/admin/documents", icon: "FolderOpen" },
  { label: "Reports", href: "/admin/reports", icon: "BarChart3" },
  { label: "Settings", href: "/admin/settings", icon: "Settings" },
];

export const teacherNav: NavItem[] = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: "LayoutDashboard" },
  { label: "My Classes", href: "/teacher/classes", icon: "GraduationCap" },
  { label: "Assessments", href: "/teacher/assessments", icon: "FileText" },
  { label: "Timetable", href: "/teacher/timetable", icon: "Calendar" },
  { label: "Attendance", href: "/teacher/attendance", icon: "ClipboardCheck" },
  { label: "Materials", href: "/teacher/materials", icon: "Upload" },
  { label: "Announcements", href: "/teacher/announcements", icon: "Megaphone" },
];

export const studentNav: NavItem[] = [
  { label: "Dashboard", href: "/student/dashboard", icon: "LayoutDashboard" },
  { label: "Results", href: "/student/results", icon: "Award" },
  { label: "Assignments", href: "/student/assignments", icon: "FileText" },
  { label: "Report Cards", href: "/student/report-cards", icon: "Award" },
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
];

export const parentNav: NavItem[] = [
  { label: "Dashboard", href: "/parent/dashboard", icon: "LayoutDashboard" },
  { label: "My Children", href: "/parent/children", icon: "Users" },
  { label: "Fees", href: "/parent/fees", icon: "CreditCard" },
  { label: "Attendance", href: "/parent/attendance", icon: "ClipboardCheck" },
  { label: "Results", href: "/parent/results", icon: "Award" },
  { label: "Announcements", href: "/parent/announcements", icon: "Megaphone" },
];
