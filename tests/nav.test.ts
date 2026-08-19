import { describe, expect, it } from "vitest";
import {
  getAdminNav,
  getAdminFinanceNavItems,
  getParentNav,
  getStudentNav,
  getTeacherNav,
  financeNav,
  isNavHrefActive,
} from "@/lib/navigation";

describe("admin nav groups", () => {
  it("places licence, backup, system health and SA-SAMS under Settings", () => {
    const nav = getAdminNav();
    const settings = nav.filter((item) => item.section === "Settings");
    const hrefs = settings.map((item) => item.href);
    expect(hrefs).toContain("/admin/settings");
    expect(hrefs).toContain("/admin/settings/licence");
    expect(hrefs).toContain("/admin/settings/backup");
    expect(hrefs).toContain("/admin/system-health");
    expect(hrefs).toContain("/admin/integrations/sa-sams");
    expect(settings.find((item) => item.href === "/admin/settings")?.label).toBe("School settings");
    expect(settings.every((item) => item.sectionIcon === "Settings")).toBe(true);
    expect(nav.some((item) => item.href === "/admin/settings/licence" && !item.section)).toBe(false);
  });

  it("includes issue licences under Settings only for vendor tools", () => {
    expect(getAdminNav().some((item) => item.href === "/admin/settings/licence-server")).toBe(false);
    expect(
      getAdminNav(undefined, { vendorTools: true }).some(
        (item) => item.href === "/admin/settings/licence-server" && item.section === "Settings"
      )
    ).toBe(true);
  });

  it("groups people, academics and organisation together", () => {
    const nav = getAdminNav();
    expect(nav.find((item) => item.href === "/admin/students")?.section).toBe("People");
    expect(nav.find((item) => item.href === "/admin/classes")?.section).toBe("Academics");
    expect(nav.find((item) => item.href === "/admin/hr")?.section).toBe("Organisation");
    expect(nav.find((item) => item.href === "/admin/visitors")?.section).toBe("School");
  });

  it("lists finance tools in a Finance dropdown", () => {
    const nav = getAdminNav();
    const finance = nav.filter((item) => item.section === "Finance");
    expect(finance.map((item) => item.label)).toEqual([
      "Overview",
      "Fee Schedule",
      "Fee Structures",
      "Charges & plans",
      "Expenses",
      "Credits & aid",
      "Reports",
      "Income & Expenses",
      "Debtors",
      "Fee Reminders",
      "Collect fees",
      "New Invoice",
    ]);
    expect(finance.every((item) => item.sectionIcon === "CreditCard")).toBe(true);
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
    expect(getTeacherNav().find((item) => item.href === "/staff/payslips")?.section).toBe("My work");
  });

  it("puts the listed finance tools under the Finance dropdown", () => {
    const finance = financeNav.filter((item) => item.section === "Finance");
    expect(finance.map((item) => item.label).slice(0, 11)).toEqual([
      "Fee Schedule",
      "Fee Structures",
      "Charges & plans",
      "Expenses",
      "Credits & aid",
      "Reports",
      "Income & Expenses",
      "Debtors",
      "Fee Reminders",
      "Collect fees",
      "New Invoice",
    ]);
    expect(finance.map((item) => item.href)).toContain("/finance/invoices");
    expect(finance.map((item) => item.href)).toContain("/finance/payments");
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
});
