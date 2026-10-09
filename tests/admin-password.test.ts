import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canSetUserPassword } from "@/lib/admin-password";
import { userPatchSchema } from "@/lib/validators";

describe("admin password authority", () => {
  it("lets a Super Admin set a password for any user", () => {
    expect(
      canSetUserPassword(
        { role: UserRole.SUPER_ADMIN, schoolId: null },
        { role: UserRole.SECURITY, schoolId: "school-a" }
      ).ok
    ).toBe(true);
    expect(
      canSetUserPassword(
        { role: UserRole.SUPER_ADMIN, schoolId: null },
        { role: UserRole.SCHOOL_ADMIN, schoolId: "school-a" }
      ).ok
    ).toBe(true);
    expect(
      canSetUserPassword(
        { role: UserRole.SUPER_ADMIN, schoolId: null },
        { role: UserRole.SUPER_ADMIN, schoolId: null }
      ).ok
    ).toBe(true);
  });

  it("lets a School Admin set passwords for users at their school", () => {
    expect(
      canSetUserPassword(
        { role: UserRole.SCHOOL_ADMIN, schoolId: "school-a" },
        { role: UserRole.SECURITY, schoolId: "school-a" }
      ).ok
    ).toBe(true);
    expect(
      canSetUserPassword(
        { role: UserRole.SCHOOL_ADMIN, schoolId: "school-a" },
        { role: UserRole.SCHOOL_ADMIN, schoolId: "school-a" }
      ).ok
    ).toBe(true);
  });

  it("refuses a School Admin for another school or a Super Admin", () => {
    expect(
      canSetUserPassword(
        { role: UserRole.SCHOOL_ADMIN, schoolId: "school-a" },
        { role: UserRole.STUDENT, schoolId: "school-b" }
      ).ok
    ).toBe(false);
    expect(
      canSetUserPassword(
        { role: UserRole.SCHOOL_ADMIN, schoolId: "school-a" },
        { role: UserRole.SUPER_ADMIN, schoolId: null }
      ).ok
    ).toBe(false);
  });

  it("refuses every other role", () => {
    const roles = [
      UserRole.PRINCIPAL,
      UserRole.TEACHER,
      UserRole.HR_OFFICER,
      UserRole.FINANCE_OFFICER,
      UserRole.SECURITY,
      UserRole.STAFF,
      UserRole.PARENT,
      UserRole.STUDENT,
      UserRole.ADMISSIONS_OFFICER,
    ];
    for (const role of roles) {
      expect(
        canSetUserPassword(
          { role, schoolId: "school-a" },
          { role: UserRole.STUDENT, schoolId: "school-a" }
        ).ok
      ).toBe(false);
    }
  });
});

describe("admin password payload", () => {
  it("accepts a password of at least 8 characters and does not echo a short password", () => {
    const accepted = userPatchSchema.safeParse({
      password: "password12",
      requirePasswordChange: true,
    });
    expect(accepted.success).toBe(true);

    const rejected = userPatchSchema.safeParse({ password: "short" });
    expect(rejected.success).toBe(false);
    if (!rejected.success) {
      expect(JSON.stringify(rejected.error.issues)).not.toContain("short");
    }
  });
});
