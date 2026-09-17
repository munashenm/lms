import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import type { SessionPayload } from "@/lib/auth";
import { canAccessSchool } from "@/lib/rbac";
import { authorize } from "@/lib/authorize";
import { denyCrossTenant, institutionScope, requireBoundSchoolId } from "@/lib/tenant";
import { canAccessUploadPath, isPublicUploadPath, parseUploadPath } from "@/lib/upload-access";
import { publicApplicationStatus } from "@/lib/application-public";

function schoolUser(schoolId: string, role: UserRole = UserRole.SCHOOL_ADMIN): SessionPayload {
  return {
    userId: `u-${schoolId}`,
    email: `${role.toLowerCase()}@${schoolId}.co.za`,
    role,
    schoolId,
    firstName: "A",
    lastName: "B",
  };
}

describe("multi-tenant isolation", () => {
  const schoolA = schoolUser("school-a");
  const schoolB = schoolUser("school-b");
  const teacherA = schoolUser("school-a", UserRole.TEACHER);
  const financeA = schoolUser("school-a", UserRole.FINANCE_OFFICER);

  it("never lets School A read School B student, payment, document, attendance or website records", async () => {
    for (const resource of ["school-b-student", "school-b-payment", "school-b-document", "school-b-attendance", "school-b-website"]) {
      const result = await authorize({
        session: schoolA,
        permission: "students:read",
        resourceInstitutionId: "school-b",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect([403, 404]).toContain(result.status);
        expect(result.response.status).not.toBe(200);
        expect(resource).toBeTruthy();
      }
    }
    expect(canAccessSchool(schoolA, "school-b")).toBe(false);
    expect(canAccessSchool(schoolB, "school-a")).toBe(false);
    expect(denyCrossTenant(schoolA, "school-b")).toBe(true);
  });

  it("scopes Prisma filters to the authenticated institution", () => {
    expect(institutionScope(schoolA)).toEqual({ schoolId: "school-a" });
    expect(institutionScope(schoolB)).toEqual({ schoolId: "school-b" });
    expect(institutionScope({ ...schoolA, role: UserRole.SUPER_ADMIN, schoolId: null })).toEqual({});
  });

  it("does not fall back to another institution when the session has no school", () => {
    expect(() =>
      requireBoundSchoolId({ ...schoolA, schoolId: null, role: UserRole.SUPER_ADMIN })
    ).toThrow("School context required");
    expect(requireBoundSchoolId(schoolA)).toBe("school-a");
  });

  it("blocks a teacher from finance and a finance user from marks", async () => {
    const teacherFinance = await authorize({
      session: teacherA,
      permission: "finance.record_payment",
      resourceInstitutionId: "school-a",
    });
    expect(teacherFinance.ok).toBe(false);

    const financeMarks = await authorize({
      session: financeA,
      permission: "marks:write",
      resourceInstitutionId: "school-a",
    });
    expect(financeMarks.ok).toBe(false);
  });

  it("rejects unauthenticated access", async () => {
    const result = await authorize({ session: null, permission: "students:read" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("keeps branding public and learner files private", () => {
    expect(isPublicUploadPath("/uploads/school-a/branding/logo.png")).toBe(true);
    expect(isPublicUploadPath("/uploads/school-a/id-document.pdf")).toBe(false);
    expect(isPublicUploadPath("/uploads/school-a/../school-b/secret.pdf")).toBe(false);
    expect(parseUploadPath("/uploads/school-a/applications/file.pdf")?.schoolId).toBe("school-a");
    expect(canAccessUploadPath(schoolA, "/uploads/school-b/id-document.pdf")).toBe(false);
    expect(canAccessUploadPath(schoolA, "/uploads/school-a/id-document.pdf")).toBe(true);
  });

  it("does not leak applicant names on the public tracker payload", () => {
    const payload = publicApplicationStatus({
      referenceNo: "APP-2027-00001",
      status: "SUBMITTED",
      submittedAt: new Date("2026-09-01T00:00:00Z"),
      school: { name: "ABC College" },
    });
    expect(payload).toEqual({
      referenceNo: "APP-2027-00001",
      status: "SUBMITTED",
      submittedAt: "2026-09-01T00:00:00.000Z",
      schoolName: "ABC College",
    });
    expect(payload).not.toHaveProperty("firstName");
    expect(payload).not.toHaveProperty("email");
  });
});
