import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_NEXT,
} from "@/lib/application-status";
import { invoiceBasePathForRole, admissionsHomeForRole } from "@/lib/portal-paths";
import type { SchoolSetupStep } from "@/lib/school-setup";

describe("role portal paths", () => {
  it("keeps finance officers on /finance invoice routes", () => {
    expect(invoiceBasePathForRole(UserRole.FINANCE_OFFICER)).toBe("/finance/invoices");
    expect(invoiceBasePathForRole(UserRole.SCHOOL_ADMIN)).toBe("/admin/finance/invoices");
    expect(invoiceBasePathForRole(UserRole.SUPER_ADMIN)).toBe("/admin/finance/invoices");
  });

  it("sends finance officers to invoices instead of admin admissions", () => {
    expect(admissionsHomeForRole(UserRole.FINANCE_OFFICER)).toBe("/finance/invoices");
    expect(admissionsHomeForRole(UserRole.ADMISSIONS_OFFICER)).toBe("/admin/applications");
  });
});

describe("plain-language admissions", () => {
  it("uses human status chips for deposit stages", () => {
    expect(APPLICATION_STATUS_LABELS.DEPOSIT_PENDING).toBe("Waiting for deposit");
    expect(APPLICATION_STATUS_LABELS.DEPOSIT_PAID).toBe("Ready to enrol");
    expect(APPLICATION_STATUS_NEXT.DEPOSIT_PENDING).toMatch(/pay the deposit/i);
    expect(APPLICATION_STATUS_NEXT.DEPOSIT_PAID).toMatch(/accept the offer/i);
  });
});

describe("school setup checklist shape", () => {
  it("defines the first-10-minutes steps in order", () => {
    const ids: SchoolSetupStep["id"][] = [
      "school",
      "academic",
      "grades_classes",
      "fees",
      "people",
      "applications",
    ];
    expect(ids).toHaveLength(6);
  });
});
