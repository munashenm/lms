import { describe, expect, it } from "vitest";
import { InstitutionType } from "@prisma/client";
import {
  admissionYearLabel,
  admissionYearNumber,
  isApplicationsOpen,
  nextApplicationReference,
} from "@/lib/admissions";
import { publicAcademicsHref, publicAcademicsLabel } from "@/lib/terminology";
import { parseWhyChooseUs, publishedStats } from "@/lib/public-site";
import { portalForRole, roleAllowedForPortal, unauthenticatedLoginPath } from "@/lib/login-portals";
import { UserRole } from "@prisma/client";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";

describe("admissions helpers", () => {
  it("builds APP-YYYY-##### references", () => {
    expect(nextApplicationReference(2027, 482)).toBe("APP-2027-00482");
    expect(nextApplicationReference(2026, 1)).toBe("APP-2026-00001");
  });

  it("reads the later year from a session name", () => {
    expect(admissionYearNumber({ name: "2026/2027", startDate: new Date("2026-01-15") })).toBe(2027);
    expect(admissionYearLabel({ name: "2027" })).toBe("2027");
  });

  it("honours open/closed windows", () => {
    const now = new Date("2026-03-01T10:00:00Z");
    expect(isApplicationsOpen({ applicationsOpen: false, applicationsOpenFrom: null, applicationsOpenUntil: null }, now).open).toBe(false);
    expect(
      isApplicationsOpen(
        {
          applicationsOpen: true,
          applicationsOpenFrom: new Date("2026-04-01"),
          applicationsOpenUntil: null,
        },
        now
      ).open
    ).toBe(false);
    expect(
      isApplicationsOpen(
        { applicationsOpen: true, applicationsOpenFrom: null, applicationsOpenUntil: new Date("2026-12-01") },
        now
      ).open
    ).toBe(true);
  });
});

describe("public website terminology", () => {
  it("routes schools to academics and colleges to programmes", () => {
    expect(publicAcademicsHref(InstitutionType.HIGH_SCHOOL)).toBe("/academics");
    expect(publicAcademicsLabel(InstitutionType.HIGH_SCHOOL)).toBe("Academics");
    expect(publicAcademicsHref(InstitutionType.COLLEGE)).toBe("/programmes");
    expect(publicAcademicsLabel(InstitutionType.TVET)).toBe("Programmes");
  });

  it("does not publish empty statistics", () => {
    expect(
      publishedStats({
        publishPublicStats: false,
        institutionType: InstitutionType.COLLEGE,
        _count: { students: 10, teachers: 2, courses: 3 },
      } as never)
    ).toBeNull();
    expect(parseWhyChooseUs([{ title: "Care", description: "Safe campus" }])).toEqual([
      { title: "Care", description: "Safe campus" },
    ]);
  });
});

describe("portal login separation", () => {
  it("sends learners to the student portal", () => {
    expect(portalForRole(UserRole.STUDENT)).toBe("student");
    expect(roleAllowedForPortal(UserRole.TEACHER, "student")).toBe(false);
    expect(roleAllowedForPortal(UserRole.TEACHER, "staff")).toBe(true);
    expect(unauthenticatedLoginPath("/student/dashboard")).toBe("/student/login");
    expect(unauthenticatedLoginPath("/parent/fees")).toBe("/parent/login");
    expect(unauthenticatedLoginPath("/admin/dashboard")).toBe("/login");
  });
});

describe("application statuses", () => {
  it("covers the public admissions workflow", () => {
    expect(APPLICATION_STATUS_LABELS.DOCUMENTS_OUTSTANDING).toBe("Documents Outstanding");
    expect(APPLICATION_STATUS_LABELS.ENROLLED).toBe("Enrolled");
    expect(APPLICATION_STATUS_LABELS.PROVISIONALLY_ACCEPTED).toBe("Provisionally Accepted");
  });
});
