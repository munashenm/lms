import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import type { SessionPayload } from "@/lib/auth";
import { canAccessSchool, requirePermission, requireStaffPermission } from "@/lib/rbac";
import { authorize } from "@/lib/authorize";
import {
  assessmentSchoolId,
  denyCrossTenant,
  enrolmentIdentityWhere,
  institutionScope,
  requireBoundSchoolId,
  scopedStudentIdFilter,
  studentCanAccessAssessment,
  scopedTimetableWhere,
  scopedId,
} from "@/lib/tenant";
import { canAccessUploadPath, isPublicUploadPath, parseUploadPath } from "@/lib/upload-access";
import { publicApplicationStatus } from "@/lib/application-public";
import { authorizeAcademicDocument } from "@/lib/fee-clearance";
import { sessionCanAccessStudentCard } from "@/lib/student-card";

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

  it("does not let visitor staff fetch student, HR or finance uploads", () => {
    const staff = schoolUser("school-a", UserRole.STAFF);
    const student = schoolUser("school-a", UserRole.STUDENT);
    const parent = schoolUser("school-a", UserRole.PARENT);
    expect(canAccessUploadPath(staff, "/uploads/school-a/students/s1/id.pdf")).toBe(false);
    expect(canAccessUploadPath(staff, "/uploads/school-a/hr/emp1/contract.pdf")).toBe(false);
    expect(canAccessUploadPath(staff, "/uploads/school-a/expenses/slip.pdf")).toBe(false);
    expect(canAccessUploadPath(staff, "/uploads/school-a/notes.pdf")).toBe(false);
    expect(canAccessUploadPath(staff, "/uploads/school-a/leave/sick-note.pdf")).toBe(true);
    expect(canAccessUploadPath(teacherA, "/uploads/school-a/students/s1/id.pdf")).toBe(true);
    expect(canAccessUploadPath(teacherA, "/uploads/school-a/hr/emp1/contract.pdf")).toBe(false);
    expect(canAccessUploadPath(teacherA, "/uploads/school-a/expenses/slip.pdf")).toBe(false);
    expect(canAccessUploadPath(financeA, "/uploads/school-a/expenses/slip.pdf")).toBe(true);
    expect(canAccessUploadPath(financeA, "/uploads/school-a/hr/emp1/contract.pdf")).toBe(false);
    expect(canAccessUploadPath(student, "/uploads/school-a/students/s1/photo.jpg")).toBe(true);
    expect(canAccessUploadPath(student, "/uploads/school-a/hr/emp1/contract.pdf")).toBe(false);
    expect(canAccessUploadPath(parent, "/uploads/school-a/expenses/slip.pdf")).toBe(false);
    expect(canAccessUploadPath(parent, "/uploads/school-a/students/s1/photo.jpg")).toBe(true);
  });

  it("requires marks:read for staff academic PDF downloads", async () => {
    const staff = schoolUser("school-a", UserRole.STAFF);
    const finance = schoolUser("school-a", UserRole.FINANCE_OFFICER);
    await expect(
      authorizeAcademicDocument({ session: staff, studentId: "s1", schoolId: "school-a" })
    ).resolves.toMatchObject({ ok: false, status: 403 });
    await expect(
      authorizeAcademicDocument({ session: finance, studentId: "s1", schoolId: "school-a" })
    ).resolves.toMatchObject({ ok: false, status: 403 });
    await expect(
      authorizeAcademicDocument({ session: teacherA, studentId: "s1", schoolId: "school-a" })
    ).resolves.toMatchObject({ ok: true });
    await expect(
      authorizeAcademicDocument({ session: schoolA, studentId: "s1", schoolId: "school-a" })
    ).resolves.toMatchObject({ ok: true });
  });

  it("honours permission denies on student card access", async () => {
    const deniedTeacher: SessionPayload = {
      ...teacherA,
      permissionDenies: ["students:read"],
    };
    await expect(sessionCanAccessStudentCard(teacherA, "s1")).resolves.toBe(true);
    await expect(sessionCanAccessStudentCard(deniedTeacher, "s1")).resolves.toBe(false);
    await expect(sessionCanAccessStudentCard(schoolUser("school-a", UserRole.STAFF), "s1")).resolves.toBe(
      false
    );
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

  it("denies exam and homework access when the assessment school is missing or foreign", () => {
    const orphan = { subject: null, module: null, teacher: null };
    const schoolB = { subject: { schoolId: "school-b" }, module: null, teacher: null };
    const schoolA = { subject: null, module: { course: { schoolId: "school-a" } }, teacher: null };
    expect(assessmentSchoolId(orphan)).toBeNull();
    expect(assessmentSchoolId({ schoolId: "school-a", ...orphan })).toBe("school-a");
    expect(studentCanAccessAssessment("school-a", orphan)).toBe(false);
    expect(studentCanAccessAssessment("school-a", schoolB)).toBe(false);
    expect(studentCanAccessAssessment("school-a", schoolA)).toBe(true);
    expect(studentCanAccessAssessment("school-a", { schoolId: "school-b" })).toBe(false);
    expect(denyCrossTenant(schoolUser("school-a"), null)).toBe(true);
    expect(denyCrossTenant(schoolUser("school-a"), "school-a")).toBe(false);
  });

  it("ignores a learner query for another student's invoices or attendance", () => {
    const student = schoolUser("school-a", UserRole.STUDENT);
    const parent = schoolUser("school-a", UserRole.PARENT);
    expect(scopedStudentIdFilter(student, "other-learner", { ownStudentId: "child-1" })).toEqual({
      studentId: "child-1",
    });
    expect(scopedStudentIdFilter(parent, "other-learner", { childIds: ["child-1", "child-2"] })).toEqual({
      studentId: { in: ["child-1", "child-2"] },
    });
    expect(scopedStudentIdFilter(parent, "child-2", { childIds: ["child-1", "child-2"] })).toEqual({
      studentId: "child-2",
    });
    expect(scopedStudentIdFilter(schoolA, "student-99")).toEqual({ studentId: "student-99" });
  });

  it("keeps school-year enrolments distinct from extra TVET courses", () => {
    expect(enrolmentIdentityWhere("stu-1", "year-1", null)).toEqual({
      studentId: "stu-1",
      academicYearId: "year-1",
      courseId: null,
    });
    expect(enrolmentIdentityWhere("stu-1", "year-1", "nated-4")).toEqual({
      studentId: "stu-1",
      academicYearId: "year-1",
      courseId: "nated-4",
    });
  });

  it("does not let a parent use finance:read on staff payment and charge desks", () => {
    const parent = schoolUser("school-a", UserRole.PARENT);
    expect(requirePermission(parent, "finance:read")).toBe(true);
    expect(requireStaffPermission(parent, "finance:read")).toBe(false);
    expect(requireStaffPermission(schoolA, "finance:read")).toBe(true);
    expect(requireStaffPermission(teacherA, "finance:read")).toBe(false);
  });

  it("always joins timetable lookups through the session school", () => {
    expect(scopedTimetableWhere(schoolA, "class-from-b")).toEqual({
      classId: "class-from-b",
      schoolId: "school-a",
    });
    expect(scopedTimetableWhere(schoolA)).toEqual({
      schoolId: "school-a",
    });
  });

  it("scopes id lookups to the session institution", () => {
    expect(scopedId(schoolA, "row-1")).toEqual({ id: "row-1", schoolId: "school-a" });
    expect(scopedId(schoolB, "row-1")).toEqual({ id: "row-1", schoolId: "school-b" });
    expect(scopedId({ ...schoolA, role: UserRole.SUPER_ADMIN, schoolId: null }, "row-1")).toEqual({
      id: "row-1",
    });
    expect(scopedId(schoolA, "inv-school-b")).not.toEqual({ id: "inv-school-b" });
    expect(scopedId(schoolA, "inv-school-b")).not.toMatchObject({ schoolId: "school-b" });
  });

  it("honours permission denies on portal write actions", () => {
    const deniedAdmin: SessionPayload = {
      ...schoolA,
      permissionDenies: ["users.edit", "classes:write", "settings:write", "hr.view"],
    };
    expect(requirePermission(schoolA, "users.edit")).toBe(true);
    expect(requirePermission(deniedAdmin, "users.edit")).toBe(false);
    expect(requirePermission(deniedAdmin, "classes:write")).toBe(false);
    expect(requirePermission(deniedAdmin, "settings:write")).toBe(false);
    expect(requirePermission(deniedAdmin, "hr.view")).toBe(false);
    expect(requirePermission(deniedAdmin, "students:read")).toBe(true);
  });
});
