import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { hasPermission } from "@/lib/rbac";
import { navHrefFeature } from "@/lib/licensing/portal";
import { getAdminNav, getTeacherNav } from "@/lib/navigation";
import { DEFAULT_LICENSE_FEATURES } from "@/lib/licensing/features";
import { visitorSignInSchema } from "@/lib/validators";
import {
  canSignOutVisitor,
  canViewVisitorBook,
  canWriteVisitorBook,
  publicIdentityNumber,
  toPublicVisitorEntry,
} from "@/lib/visitors";

describe("visitor book access", () => {
  it("lets office and teaching staff use the register, not learners or parents", () => {
    expect(canViewVisitorBook(UserRole.SCHOOL_ADMIN)).toBe(true);
    expect(canWriteVisitorBook(UserRole.STAFF)).toBe(true);
    expect(canWriteVisitorBook(UserRole.TEACHER)).toBe(true);
    expect(canViewVisitorBook(UserRole.STUDENT)).toBe(false);
    expect(canWriteVisitorBook(UserRole.PARENT)).toBe(false);
    expect(hasPermission(UserRole.STUDENT, "visitors:read")).toBe(false);
  });

  it("maps visitor routes to the visitor_management licence", () => {
    expect(navHrefFeature("/admin/visitors")).toBe("visitor_management");
    expect(navHrefFeature("/staff/visitors")).toBe("visitor_management");
    expect(navHrefFeature("/teacher/visitors")).toBe("visitor_management");
    expect(navHrefFeature("/staff/leave")).toBe("hr_payroll");
  });

  it("shows Visitor Book on admin and educator nav", () => {
    expect(getAdminNav().some((item) => item.href === "/admin/visitors")).toBe(true);
    expect(getTeacherNav().some((item) => item.href === "/teacher/visitors")).toBe(true);
  });

  it("is included in the default licence now that the register exists", () => {
    expect(DEFAULT_LICENSE_FEATURES.visitor_management).toBe(true);
  });
});

describe("visitor records", () => {
  it("masks a 13-digit SA ID and never returns the full number", () => {
    expect(publicIdentityNumber("8001015009087")).toBe("8001••••87");
    expect(publicIdentityNumber("AB123456")).toBe("AB••••56");
  });

  it("only allows sign-out while the visitor is still on site", () => {
    expect(canSignOutVisitor(null)).toBe(true);
    expect(canSignOutVisitor(new Date())).toBe(false);
  });

  it("strips the full identity number when publishing a row", () => {
    const published = toPublicVisitorEntry({
      id: "v1",
      firstName: "Thabo",
      lastName: "Molefe",
      organisation: null,
      phone: "0821234567",
      identityType: "SA_ID",
      identityNumber: "8001015009087",
      hostKind: "STAFF",
      hostName: "Office",
      purpose: "MEETING",
      purposeDetail: null,
      vehicleRegistration: null,
      badgeNumber: null,
      notes: null,
      signedInAt: new Date("2026-08-19T08:00:00Z"),
      signedOutAt: null,
      signedInBy: { firstName: "Ane", lastName: "Botha" },
    });
    expect(published.identityNumber).toBe("8001••••87");
    expect(published.signedInByName).toBe("Ane Botha");
  });

  it("rejects an invalid SA ID on sign-in", () => {
    const parsed = visitorSignInSchema.safeParse({
      firstName: "Thabo",
      lastName: "Molefe",
      hostKind: "STAFF",
      hostName: "Office",
      purpose: "MEETING",
      identityType: "SA_ID",
      identityNumber: "123",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a valid sign-in without an identity number", () => {
    const parsed = visitorSignInSchema.safeParse({
      firstName: "Thabo",
      lastName: "Molefe",
      hostKind: "LEARNER",
      hostName: "Grade 4",
      purpose: "PARENT_GUARDIAN",
    });
    expect(parsed.success).toBe(true);
  });
});
