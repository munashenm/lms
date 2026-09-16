import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { hasPermission, requirePermission, rolePermissionSet } from "@/lib/rbac";
import {
  defaultActionPermissionsForRole,
  roleHasLegacy,
} from "@/lib/permissions";
import { permissionModule, navHrefModule } from "@/lib/modules";
import { FORBIDDEN_MESSAGE } from "@/lib/http";
import { continuesToTarget, outcomeToEnrolmentStatus } from "@/lib/promotion";
import { PromotionOutcome, EnrolmentStatus } from "@prisma/client";

describe("granular permissions", () => {
  it("gives Super Admin every action including promotion override", () => {
    expect(hasPermission(UserRole.SUPER_ADMIN, "students.promotion_override")).toBe(true);
    expect(hasPermission(UserRole.SUPER_ADMIN, "users.permissions")).toBe(true);
    expect(hasPermission(UserRole.SUPER_ADMIN, "finance.view")).toBe(true);
  });

  it("maps teacher defaults to view/capture without finance or student edit", () => {
    const owned = rolePermissionSet(UserRole.TEACHER);
    const defaults = defaultActionPermissionsForRole(UserRole.TEACHER, owned);
    expect(defaults).toContain("students.view");
    expect(defaults).toContain("attendance.capture");
    expect(defaults).not.toContain("students.edit");
    expect(defaults).not.toContain("finance.view");
    expect(hasPermission(UserRole.TEACHER, "students.edit")).toBe(false);
  });

  it("applies user grants and denies on top of the role", () => {
    expect(
      hasPermission(UserRole.TEACHER, "students.edit", { grants: ["students.edit"] })
    ).toBe(true);
    expect(
      hasPermission(UserRole.TEACHER, "students.view", { denies: ["students.view"] })
    ).toBe(false);
    expect(
      requirePermission(
        {
          userId: "u1",
          email: "t@school.co.za",
          role: UserRole.TEACHER,
          schoolId: "s1",
          firstName: "Sarah",
          lastName: "Mokoena",
          permissionGrants: ["attendance.reports"],
          permissionDenies: ["academics.capture_marks"],
        },
        "attendance.reports"
      )
    ).toBe(true);
    expect(
      requirePermission(
        {
          userId: "u1",
          email: "t@school.co.za",
          role: UserRole.TEACHER,
          schoolId: "s1",
          firstName: "Sarah",
          lastName: "Mokoena",
          permissionDenies: ["marks:write"],
        },
        "academics.capture_marks"
      )
    ).toBe(false);
  });

  it("blocks a disabled institution module even when the role would allow it", () => {
    expect(
      requirePermission(
        {
          userId: "u1",
          email: "admin@school.co.za",
          role: UserRole.SCHOOL_ADMIN,
          schoolId: "s1",
          firstName: "A",
          lastName: "B",
          disabledModules: ["finance"],
        },
        "finance.view"
      )
    ).toBe(false);
    expect(
      requirePermission(
        {
          userId: "sa",
          email: "admin@cyberdevelopers.co.za",
          role: UserRole.SUPER_ADMIN,
          schoolId: null,
          firstName: "Super",
          lastName: "Admin",
          disabledModules: ["finance"],
        },
        "finance.view"
      )
    ).toBe(true);
  });

  it("keeps legacy permission strings working", () => {
    expect(roleHasLegacy(["students:write"], "students.edit")).toBe(true);
    expect(hasPermission(UserRole.SCHOOL_ADMIN, "students:write")).toBe(true);
    expect(hasPermission(UserRole.FINANCE_OFFICER, "payroll.finalise")).toBe(false);
  });

  it("maps permissions and nav hrefs onto modules", () => {
    expect(permissionModule("finance.record_payment")).toBe("finance");
    expect(permissionModule("students.promote")).toBe("students");
    expect(navHrefModule("/admin/academic/promotion")).toBe("academics");
    expect(navHrefModule("/admin/finance/collect")).toBe("finance");
  });

  it("exposes a stable 403 message", () => {
    expect(FORBIDDEN_MESSAGE).toBe("You do not have permission to perform this action.");
  });

  it("builds a branded promotion PDF", async () => {
    const { generatePromotionReportPdf } = await import("@/lib/pdf-promotion");
    const bytes = await generatePromotionReportPdf({
      brand: { name: "ABC Primary School" },
      title: "2026 Grade 8 Promotion Report",
      sessionName: "2026",
      rows: [
        {
          learner: "Thabo Mokoena",
          studentNumber: "ADM001",
          grade: "Grade 8A",
          average: 68,
          attendance: 94,
          resultStatus: "PASS",
          eligibility: "Eligible",
          decision: "Promoted",
          destination: "Grade 9A",
          overridden: false,
        },
      ],
    });
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("promotion outcomes", () => {
  it("creates a new enrolment path for promoted and progressed learners", () => {
    expect(continuesToTarget(PromotionOutcome.PROMOTED)).toBe(true);
    expect(continuesToTarget(PromotionOutcome.PROGRESSED)).toBe(true);
    expect(continuesToTarget(PromotionOutcome.GRADUATED)).toBe(false);
    expect(outcomeToEnrolmentStatus(PromotionOutcome.PROGRESSED)).toBe(EnrolmentStatus.PROGRESSED);
    expect(outcomeToEnrolmentStatus(PromotionOutcome.DEFERRED)).toBe(EnrolmentStatus.DEFERRED);
  });
});
