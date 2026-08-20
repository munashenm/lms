import { describe, expect, it } from "vitest";
import {
  getAdminNav,
  getAdminFinanceNavItems,
  getAdminHrNavItems,
  getAdminStudentNavItems,
  getParentNav,
  getStudentNav,
  getTeacherNav,
  financeNav,
  hrNav,
  isNavHrefActive,
  navClusters,
  navPageTabs,
} from "@/lib/navigation";

describe("admin nav groups", () => {
  it("places licence, backup, system health and SA-SAMS under Settings", () => {
    const nav = getAdminNav();
    const settings = nav.filter((item) => item.section === "Settings");
    const hrefs = settings.map((item) => item.href);
    expect(hrefs).toContain("/admin/users");
    expect(hrefs).toContain("/admin/settings");
    expect(hrefs).toContain("/admin/settings/licence");
    expect(hrefs).toContain("/admin/settings/backup");
    expect(hrefs).toContain("/admin/system-health");
    expect(hrefs).toContain("/admin/integrations/sa-sams");
    expect(settings.find((item) => item.href === "/admin/settings")?.label).toBe("School settings");
    expect(settings.every((item) => item.sectionIcon === "Settings")).toBe(true);
    expect(nav.some((item) => item.href === "/admin/settings/licence" && !item.section)).toBe(false);
    expect(settings.find((item) => item.href === "/admin/users")?.group).toBe("School");
    expect(settings.find((item) => item.href === "/admin/settings")?.group).toBe("School");
    expect(settings.find((item) => item.href === "/admin/audit")?.group).toBe("Platform");
  });

  it("includes issue licences under Settings only for vendor tools", () => {
    expect(getAdminNav().some((item) => item.href === "/admin/settings/licence-server")).toBe(false);
    expect(
      getAdminNav(undefined, { vendorTools: true }).some(
        (item) => item.href === "/admin/settings/licence-server" && item.section === "Settings"
      )
    ).toBe(true);
  });

  it("groups students, academics and human resource together", () => {
    const nav = getAdminNav();
    expect(nav.find((item) => item.href === "/admin/students")?.section).toBe("Students");
    expect(nav.find((item) => item.href === "/admin/students")?.label).toBe("Student details");
    expect(nav.find((item) => item.href === "/admin/classes")?.section).toBe("Academics");
    expect(nav.find((item) => item.href === "/admin/classes")?.group).toBe("Setup");
    expect(nav.find((item) => item.href === "/admin/assessments")?.group).toBe("Classroom");
    expect(nav.find((item) => item.href === "/admin/hr")?.section).toBe("Human Resource");
    expect(nav.find((item) => item.href === "/admin/visitors")?.section).toBe("School");
    expect(nav.some((item) => item.section === "Organisation")).toBe(false);
    expect(nav.some((item) => item.section === "People")).toBe(false);
    expect(nav.some((item) => item.section === "Admissions")).toBe(false);
  });

  it("puts applications, registration and student details under Students", () => {
    const nav = getAdminNav();
    const students = nav.filter((item) => item.section === "Students");
    expect(students.map((item) => item.label)).toEqual([
      "Applications",
      "Registration",
      "Student details",
      "Student Leave",
    ]);
    expect(navClusters(students).map((cluster) => cluster.group)).toEqual(["Admission", "Records"]);
    expect(nav.find((item) => item.href === "/admin/applications")?.group).toBe("Admission");
    expect(nav.find((item) => item.href === "/admin/students/new")?.group).toBe("Admission");
    expect(nav.find((item) => item.href === "/admin/students")?.group).toBe("Records");
    expect(nav.find((item) => item.href === "/admin/learner-leave")?.section).toBe("Students");
    expect(getAdminStudentNavItems().every((item) => item.href.startsWith("/admin"))).toBe(true);
  });

  it("puts staff, attendance, leave and payroll under Human Resource", () => {
    const nav = getAdminNav();
    const hr = nav.filter((item) => item.section === "Human Resource");
    expect(hr.map((item) => item.label)).toEqual([
      "Staff",
      "Employees",
      "Staff Attendance",
      "Staff Leave",
      "Timesheets",
      "Payroll",
      "Leave policies",
      "HR Reports",
    ]);
    expect(navClusters(hr).map((cluster) => cluster.group)).toEqual(["Directory", "Time", "Pay"]);
    expect(nav.find((item) => item.href === "/admin/staff")?.section).toBe("Human Resource");
    expect(nav.find((item) => item.href === "/admin/staff-attendance")?.group).toBe("Time");
    expect(nav.find((item) => item.href === "/admin/leave")?.label).toBe("Staff Leave");
    expect(nav.find((item) => item.href === "/admin/payroll")?.group).toBe("Pay");
    expect(getAdminHrNavItems().every((item) => item.href.startsWith("/admin"))).toBe(true);
  });

  it("places Users under Settings, not People", () => {
    const nav = getAdminNav();
    expect(nav.find((item) => item.href === "/admin/users")?.section).toBe("Settings");
    expect(nav.find((item) => item.href === "/admin/users")?.group).toBe("School");
    expect(nav.find((item) => item.href === "/admin/staff")?.section).not.toBe("Settings");
  });

  it("lists finance tools in Fees, Collections and Books groups", () => {
    const nav = getAdminNav();
    const finance = nav.filter((item) => item.section === "Finance");
    expect(finance.map((item) => item.label)).toEqual([
      "Overview",
      "Fee Schedule",
      "Fee Structures",
      "Charges & plans",
      "Invoices",
      "New Invoice",
      "Collect fees",
      "Debtors",
      "Fee Reminders",
      "Expenses",
      "Credits & aid",
      "Income & Expenses",
      "Reports",
    ]);
    expect(navClusters(finance).map((cluster) => cluster.group)).toEqual([
      undefined,
      "Fees",
      "Collections",
      "Books",
    ]);
    expect(finance.every((item) => item.href.startsWith("/admin/finance"))).toBe(true);
    expect(getAdminFinanceNavItems().find((item) => item.label === "Collect fees")?.href).toBe(
      "/admin/finance/collect"
    );
    expect(getAdminFinanceNavItems().find((item) => item.label === "Fee Structures")?.href).toBe(
      "/admin/finance/structures"
    );
  });
});

describe("other portal groups", () => {
  it("keeps learner services grouped", () => {
    const nav = getStudentNav();
    expect(nav.filter((item) => item.section === "Learner Services").map((item) => item.href)).toEqual([
      "/student/leave",
      "/student/downloads",
      "/student/calendar",
    ]);
  });

  it("groups parent academics and teacher self-service", () => {
    expect(getParentNav().find((item) => item.href === "/parent/exams")?.section).toBe("Academics");
    expect(getParentNav().find((item) => item.href === "/parent/exams")?.group).toBe("Results");
    expect(getTeacherNav().find((item) => item.href === "/staff/payslips")?.section).toBe("My work");
    expect(getTeacherNav().find((item) => item.href === "/teacher/classes")?.group).toBe("Classwork");
  });

  it("splits finance officer tools into Fees, Collections and Books", () => {
    expect(financeNav.find((item) => item.href === "/finance/collect")?.section).toBe("Collections");
    expect(financeNav.find((item) => item.href === "/finance/structures")?.section).toBe("Fees");
    expect(financeNav.find((item) => item.href === "/finance/ledger")?.section).toBe("Books");
    expect(financeNav.map((item) => item.href)).toContain("/finance/invoices");
    expect(financeNav.map((item) => item.href)).toContain("/finance/payments");
  });

  it("groups HR officer tools under Human Resource", () => {
    expect(hrNav.find((item) => item.href === "/hr/staff")?.section).toBe("Human Resource");
    expect(hrNav.find((item) => item.href === "/hr/staff-attendance")?.group).toBe("Time");
    expect(hrNav.find((item) => item.href === "/hr/leave")?.label).toBe("Staff Leave");
    expect(hrNav.find((item) => item.href === "/hr/payroll")?.group).toBe("Pay");
    expect(hrNav.find((item) => item.href === "/hr/employees")?.group).toBe("Directory");
  });
});

describe("nav active matching", () => {
  const hrefs = ["/admin/settings", "/admin/settings/licence", "/admin/settings/backup"];

  it("does not mark School settings active on the licence page", () => {
    expect(isNavHrefActive("/admin/settings/licence", "/admin/settings", hrefs)).toBe(false);
    expect(isNavHrefActive("/admin/settings/licence", "/admin/settings/licence", hrefs)).toBe(true);
  });

  it("marks the school settings page itself", () => {
    expect(isNavHrefActive("/admin/settings", "/admin/settings", hrefs)).toBe(true);
  });

  it("does not mark Finance overview active on Collect fees", () => {
    const financeHrefs = getAdminFinanceNavItems().map((item) => item.href);
    expect(isNavHrefActive("/admin/finance/collect", "/admin/finance", financeHrefs)).toBe(false);
    expect(isNavHrefActive("/admin/finance/collect", "/admin/finance/collect", financeHrefs)).toBe(true);
    expect(isNavHrefActive("/admin/finance", "/admin/finance", financeHrefs)).toBe(true);
    expect(isNavHrefActive("/admin/finance/structures", "/admin/finance", financeHrefs)).toBe(false);
    expect(isNavHrefActive("/admin/finance/structures", "/admin/finance/structures", financeHrefs)).toBe(
      true
    );
  });

  it("does not mark student details active on the registration page", () => {
    const studentHrefs = getAdminStudentNavItems().map((item) => item.href);
    expect(isNavHrefActive("/admin/students/new", "/admin/students", studentHrefs)).toBe(false);
    expect(isNavHrefActive("/admin/students/new", "/admin/students/new", studentHrefs)).toBe(true);
    expect(isNavHrefActive("/admin/students", "/admin/students", studentHrefs)).toBe(true);
  });
});

describe("page tabs", () => {
  const nav = getAdminNav();

  it("shows Fees / Collections / Books on the finance overview", () => {
    expect(navPageTabs("/admin/finance", nav).map((tab) => tab.label)).toEqual([
      "Overview",
      "Fees",
      "Collections",
      "Books",
    ]);
  });

  it("shows sibling fee screens as tabs", () => {
    expect(navPageTabs("/admin/finance/structures", nav).map((tab) => tab.label)).toEqual([
      "Fee Schedule",
      "Fee Structures",
      "Charges & plans",
      "Invoices",
      "New Invoice",
    ]);
  });

  it("shows Directory / Time / Pay on a Human Resource screen", () => {
    expect(navPageTabs("/admin/staff", nav).map((tab) => tab.label)).toEqual([
      "Staff",
      "Employees",
    ]);
    expect(navPageTabs("/admin/leave", nav).map((tab) => tab.label)).toEqual([
      "Staff Attendance",
      "Staff Leave",
      "Timesheets",
    ]);
    expect(navPageTabs("/admin/payroll", nav).map((tab) => tab.label)).toEqual([
      "Payroll",
      "Leave policies",
      "HR Reports",
    ]);
  });

  it("shows Admission and Records tabs on student screens", () => {
    expect(navPageTabs("/admin/applications", nav).map((tab) => tab.label)).toEqual([
      "Applications",
      "Registration",
    ]);
    expect(navPageTabs("/admin/students", nav).map((tab) => tab.label)).toEqual([
      "Student details",
      "Student Leave",
    ]);
  });
});
