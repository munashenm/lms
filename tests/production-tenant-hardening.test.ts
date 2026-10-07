import { describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import type { SessionPayload } from "@/lib/auth";
import {
  assessmentSchoolId,
  denyCrossTenant,
  resolveOwnedClassId,
  resolveOwnedEntityId,
  studentCanAccessAssessment,
} from "@/lib/tenant";
import { canAccessUploadPath, isPublicUploadPath } from "@/lib/upload-access";
import { assertBackupBelongsToSchool } from "@/lib/backup/compatibility";
import { SECRET_BACKUP_FIELDS } from "@/lib/backup/types";
import { stripSecretsForTest } from "./helpers/backup-strip";

function schoolUser(schoolId: string, role: UserRole = UserRole.SCHOOL_ADMIN): SessionPayload {
  return {
    userId: `u-${role}-${schoolId}`,
    email: `${role.toLowerCase()}@${schoolId}.co.za`,
    role,
    schoolId,
    firstName: "A",
    lastName: "B",
  };
}

describe("owned class/entity resolution (SSR IDOR guards)", () => {
  it("School A cannot select School B classId", () => {
    const owned = [{ id: "class-a1" }, { id: "class-a2" }];
    expect(resolveOwnedClassId("class-b1", owned)).toBe("class-a1");
    expect(resolveOwnedClassId("class-a2", owned)).toBe("class-a2");
    expect(resolveOwnedClassId(undefined, owned)).toBe("class-a1");
    expect(resolveOwnedClassId("class-b1", [])).toBeNull();
  });

  it("teacher cannot cross tenant through foreign classId or moduleId", () => {
    const assigned = [{ id: "t-class-1" }];
    const modules = [{ id: "mod-a" }];
    expect(resolveOwnedClassId("foreign-class", assigned)).toBe("t-class-1");
    expect(resolveOwnedEntityId("foreign-mod", modules)).toBe("mod-a");
    expect(resolveOwnedEntityId("mod-a", modules)).toBe("mod-a");
  });
});

describe("assessment ownership helpers", () => {
  it("keeps assessment ownership tenant-safe even when denormalized schoolId is stale/null", () => {
    expect(assessmentSchoolId({ schoolId: null, subject: { schoolId: "school-a" } })).toBe("school-a");
    expect(assessmentSchoolId({ schoolId: "school-b", subject: { schoolId: "school-a" } })).toBe(
      "school-b"
    );
    expect(studentCanAccessAssessment("school-a", { schoolId: null, subject: null, module: null, teacher: null })).toBe(
      false
    );
    expect(denyCrossTenant(schoolUser("school-a"), "school-b")).toBe(true);
    expect(denyCrossTenant(schoolUser("school-a"), assessmentSchoolId({ subject: { schoolId: "school-a" } }))).toBe(
      false
    );
  });
});

describe("private file ACL", () => {
  const schoolA = schoolUser("school-a");
  const schoolB = schoolUser("school-b");
  const studentA = schoolUser("school-a", UserRole.STUDENT);
  const studentB = schoolUser("school-a", UserRole.STUDENT);
  const parentA = schoolUser("school-a", UserRole.PARENT);
  const teacherA = schoolUser("school-a", UserRole.TEACHER);
  const financeA = schoolUser("school-a", UserRole.FINANCE_OFFICER);

  it("keeps branding publicly accessible", () => {
    expect(isPublicUploadPath("/uploads/school-a/branding/logo.png")).toBe(true);
  });

  it("denies cross-school upload access", async () => {
    expect(await canAccessUploadPath(schoolA, "/uploads/school-b/students/s1/id.pdf")).toBe(false);
    expect(await canAccessUploadPath(schoolB, "/uploads/school-a/branding/logo.png")).toBe(true);
  });

  it("denies student retrieving another learner private file", async () => {
    expect(
      await canAccessUploadPath(studentA, "/uploads/school-a/students/learner-b/id.pdf", {
        studentId: "learner-a",
      })
    ).toBe(false);
    expect(
      await canAccessUploadPath(studentA, "/uploads/school-a/students/learner-a/id.pdf", {
        studentId: "learner-a",
      })
    ).toBe(true);
    expect(
      await canAccessUploadPath(studentB, "/uploads/school-a/submissions/learner-a/work.pdf", {
        studentId: "learner-b",
      })
    ).toBe(false);
  });

  it("denies parent retrieving unrelated learner file", async () => {
    expect(
      await canAccessUploadPath(parentA, "/uploads/school-a/students/unrelated/id.pdf", {
        childStudentIds: ["child-1"],
      })
    ).toBe(false);
    expect(
      await canAccessUploadPath(parentA, "/uploads/school-a/students/child-1/id.pdf", {
        childStudentIds: ["child-1"],
      })
    ).toBe(true);
  });

  it("denies unauthorized learner finance/payment proof access", async () => {
    expect(await canAccessUploadPath(studentA, "/uploads/school-a/payments/proof.pdf", { studentId: "learner-a" })).toBe(
      false
    );
    expect(await canAccessUploadPath(parentA, "/uploads/school-a/payments/proof.pdf", { childStudentIds: ["child-1"] })).toBe(
      false
    );
    expect(await canAccessUploadPath(financeA, "/uploads/school-a/payments/proof.pdf")).toBe(true);
    expect(await canAccessUploadPath(teacherA, "/uploads/school-a/expenses/slip.pdf")).toBe(false);
  });

  it("allows teachers student docs but not HR/finance", async () => {
    expect(await canAccessUploadPath(teacherA, "/uploads/school-a/students/s1/id.pdf")).toBe(true);
    expect(await canAccessUploadPath(teacherA, "/uploads/school-a/hr/emp1/contract.pdf")).toBe(false);
  });

  it("respects library visibility for learners when lookup is provided", async () => {
    expect(
      await canAccessUploadPath(studentA, "/uploads/school-a/notes.pdf", {
        studentId: "learner-a",
        skipLibraryLookup: true,
        libraryAllowed: false,
      })
    ).toBe(false);
    expect(
      await canAccessUploadPath(studentA, "/uploads/school-a/notes.pdf", {
        studentId: "learner-a",
        skipLibraryLookup: true,
        libraryAllowed: true,
      })
    ).toBe(true);
  });
});

describe("backup security", () => {
  it("lists passwordHash among secret backup fields", () => {
    expect(SECRET_BACKUP_FIELDS).toContain("passwordHash");
    expect(SECRET_BACKUP_FIELDS).toContain("sendgridApiKey");
  });

  it("strips passwordHash from snapshot-shaped user rows", () => {
    const cleaned = stripSecretsForTest({
      id: "u1",
      email: "a@b.co.za",
      passwordHash: "$2a$12$secret",
      passwordResetTokenHash: "tok",
      sendgridApiKey: "sg",
    });
    expect(cleaned.passwordHash).toBeNull();
    expect(cleaned.passwordResetTokenHash).toBeNull();
    expect(cleaned.sendgridApiKey).toBeNull();
    expect(cleaned.email).toBe("a@b.co.za");
    expect(JSON.stringify(cleaned)).not.toContain("$2a$12$secret");
  });

  it("keeps institution restore tenant verification", () => {
    expect(assertBackupBelongsToSchool("school-a", "school-b")).toContain("different institution");
    expect(assertBackupBelongsToSchool("school-a", "school-a")).toBeNull();
  });
});

describe("school delete safety", () => {
  it("documents that hard-delete API responds with method not allowed contract", async () => {
    const { DELETE } = await import("@/app/api/institutions/[id]/route");
    const res = await DELETE();
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.message).toMatch(/deactivate/i);
  });
});

describe("production backup storage readiness", () => {
  it("requires S3 in production unless local override is set", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevProvider = process.env.BACKUP_STORAGE_PROVIDER;
    const prevAllow = process.env.BACKUP_ALLOW_LOCAL;
    const prevKey = process.env.BACKUP_ENCRYPTION_KEY;
    try {
      process.env.BACKUP_ENCRYPTION_KEY = "test-backup-secret";
      process.env.BACKUP_STORAGE_PROVIDER = "local";
      delete process.env.BACKUP_ALLOW_LOCAL;
      // @ts-expect-error test override
      process.env.NODE_ENV = "production";
      vi.resetModules();
      const { backupConfigurationError } = await import("@/lib/backup/crypto");
      expect(backupConfigurationError()).toMatch(/BACKUP_STORAGE_PROVIDER=s3/);
      process.env.BACKUP_ALLOW_LOCAL = "true";
      vi.resetModules();
      const { backupConfigurationError: again } = await import("@/lib/backup/crypto");
      expect(again()).toBeNull();
    } finally {
      // @ts-expect-error restore
      process.env.NODE_ENV = prevNodeEnv;
      process.env.BACKUP_STORAGE_PROVIDER = prevProvider;
      process.env.BACKUP_ALLOW_LOCAL = prevAllow;
      process.env.BACKUP_ENCRYPTION_KEY = prevKey;
      vi.resetModules();
    }
  });
});
