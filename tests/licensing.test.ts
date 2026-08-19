import { describe, expect, it } from "vitest";
import { evaluateLicense, learnerLimitReached } from "@/lib/licensing/evaluate";
import { generateLicenseKeyPair, signLicenseClaims, verifyLicenseToken } from "@/lib/licensing/crypto";
import { LEARNER_LIMIT_MESSAGE, type LicenseClaims } from "@/lib/licensing/types";
import { DEFAULT_LICENSE_FEATURES, isFutureLicenseFeature, LICENSE_FEATURE_KEYS } from "@/lib/licensing/features";
import { canAccessSchool, hasPermission } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import type { SessionPayload } from "@/lib/auth";
import { isRestrictedPathAllowed } from "@/lib/licensing/restricted-paths";
import { filterNavByLicense, isFeatureEnabled, licenseBannerTone, navHrefFeature } from "@/lib/licensing/portal";
import { getAdminNav, studentNav } from "@/lib/navigation";

function claims(overrides: Partial<LicenseClaims> = {}): LicenseClaims {
  const now = new Date("2026-06-01T00:00:00Z");
  const expires = new Date("2026-07-01T00:00:00Z");
  return {
    iss: "schoolhub-license-server",
    sub: "school-a",
    product: "lms",
    licenseKey: "SHSA-TEST-KEY",
    status: "ACTIVE",
    startsAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    gracePeriodDays: 7,
    limits: {
      maxLearners: 1000,
      maxEducators: 50,
      maxAdministrators: 10,
      maxCampuses: 2,
      storageLimitBytes: null,
    },
    features: DEFAULT_LICENSE_FEATURES,
    ...overrides,
  };
}

describe("licensing", () => {
  it("accepts a valid signed licence", async () => {
    const keys = await generateLicenseKeyPair();
    const token = await signLicenseClaims(claims(), keys.privateKeyPem);
    const verified = await verifyLicenseToken(token, keys.publicKeyPem);
    expect(verified.ok).toBe(true);
    const evaluation = evaluateLicense({
      now: new Date("2026-06-15T00:00:00Z"),
      claims: verified.ok ? verified.claims : null,
      signatureValid: verified.ok,
      lastVerifiedAt: new Date("2026-06-15T00:00:00Z"),
      storedStatus: "ACTIVE",
      offlineGraceDays: 14,
    });
    expect(evaluation.restricted).toBe(false);
    expect(evaluation.effectiveStatus).toBe("ACTIVE");
  });

  it("rejects an invalid signature", async () => {
    const a = await generateLicenseKeyPair();
    const b = await generateLicenseKeyPair();
    const token = await signLicenseClaims(claims(), a.privateKeyPem);
    const verified = await verifyLicenseToken(token, b.publicKeyPem);
    expect(verified.ok).toBe(false);
    const evaluation = evaluateLicense({
      now: new Date("2026-06-15T00:00:00Z"),
      claims: claims(),
      signatureValid: false,
      lastVerifiedAt: new Date(),
      storedStatus: "ACTIVE",
      offlineGraceDays: 14,
    });
    expect(evaluation.restricted).toBe(true);
  });

  it("moves into grace then expired without destroying access semantics", () => {
    const c = claims({ expiresAt: "2026-06-01T00:00:00Z", gracePeriodDays: 7, status: "ACTIVE" });
    const grace = evaluateLicense({
      now: new Date("2026-06-05T00:00:00Z"),
      claims: c,
      signatureValid: true,
      lastVerifiedAt: new Date("2026-06-05T00:00:00Z"),
      storedStatus: "ACTIVE",
      offlineGraceDays: 14,
    });
    expect(grace.effectiveStatus).toBe("GRACE");
    expect(grace.restricted).toBe(false);
    expect(grace.warnings.length).toBeGreaterThan(0);

    const expired = evaluateLicense({
      now: new Date("2026-06-20T00:00:00Z"),
      claims: c,
      signatureValid: true,
      lastVerifiedAt: new Date("2026-06-20T00:00:00Z"),
      storedStatus: "ACTIVE",
      offlineGraceDays: 14,
    });
    expect(expired.effectiveStatus).toBe("EXPIRED");
    expect(expired.restricted).toBe(true);
  });

  it("restricts suspended licences immediately", () => {
    const evaluation = evaluateLicense({
      now: new Date("2026-06-15T00:00:00Z"),
      claims: claims({ status: "SUSPENDED" }),
      signatureValid: true,
      lastVerifiedAt: new Date(),
      storedStatus: "SUSPENDED",
      offlineGraceDays: 14,
    });
    expect(evaluation.restricted).toBe(true);
    expect(evaluation.effectiveStatus).toBe("SUSPENDED");
  });

  it("keeps serving a cached licence when the server is unavailable", () => {
    const evaluation = evaluateLicense({
      now: new Date("2026-06-16T00:00:00Z"),
      claims: claims(),
      signatureValid: true,
      lastVerifiedAt: new Date("2026-06-15T00:00:00Z"),
      storedStatus: "ACTIVE",
      offlineGraceDays: 14,
      serverUnavailable: true,
    });
    expect(evaluation.restricted).toBe(false);
    expect(evaluation.usingCache).toBe(true);
    expect(evaluation.serverUnavailable).toBe(true);
  });

  it("restricts after offline grace is exceeded", () => {
    const evaluation = evaluateLicense({
      now: new Date("2026-07-10T00:00:00Z"),
      claims: claims({ expiresAt: "2026-12-01T00:00:00Z" }),
      signatureValid: true,
      lastVerifiedAt: new Date("2026-06-01T00:00:00Z"),
      storedStatus: "ACTIVE",
      offlineGraceDays: 14,
      serverUnavailable: true,
    });
    expect(evaluation.restricted).toBe(true);
  });

  it("blocks the 1001st active learner", () => {
    expect(learnerLimitReached(1000, 1000)).toBe(true);
    expect(learnerLimitReached(999, 1000)).toBe(false);
    expect(LEARNER_LIMIT_MESSAGE).toContain("active learner limit");
  });

  it("disables a feature when the flag is off", () => {
    const evaluation = evaluateLicense({
      now: new Date("2026-06-15T00:00:00Z"),
      claims: claims({ features: { ...DEFAULT_LICENSE_FEATURES, finance: false } }),
      signatureValid: true,
      lastVerifiedAt: new Date(),
      storedStatus: "ACTIVE",
      offlineGraceDays: 14,
    });
    expect(evaluation.claims?.features.finance).toBe(false);
    expect(evaluation.claims?.features.attendance).toBe(true);
  });
});

describe("multi-tenancy isolation", () => {
  const schoolA: SessionPayload = {
    userId: "u1",
    email: "a@school.za",
    role: UserRole.SCHOOL_ADMIN,
    schoolId: "school-a",
    firstName: "Ann",
    lastName: "Admin",
  };
  const schoolB: SessionPayload = {
    ...schoolA,
    userId: "u2",
    schoolId: "school-b",
  };

  it("prevents Institution A from accessing Institution B resources", () => {
    expect(canAccessSchool(schoolA, "school-a")).toBe(true);
    expect(canAccessSchool(schoolA, "school-b")).toBe(false);
    expect(canAccessSchool(schoolB, "school-a")).toBe(false);
  });

  it("grants Super Admin and School Admin enterprise permissions", () => {
    expect(hasPermission(UserRole.SUPER_ADMIN, "license.manage")).toBe(true);
    expect(hasPermission(UserRole.SCHOOL_ADMIN, "backup.restore")).toBe(true);
    expect(hasPermission(UserRole.TEACHER, "backup.delete")).toBe(false);
    expect(hasPermission(UserRole.SCHOOL_ADMIN, "sasams.execute")).toBe(true);
  });
});

describe("restricted mode paths", () => {
  it("keeps licence, backup, auth and support reachable", () => {
    expect(isRestrictedPathAllowed("/admin/settings/licence", "GET")).toBe(true);
    expect(isRestrictedPathAllowed("/admin/settings/backup", "POST")).toBe(true);
    expect(isRestrictedPathAllowed("/api/auth/login", "POST")).toBe(true);
    expect(isRestrictedPathAllowed("/login", "GET")).toBe(true);
    expect(isRestrictedPathAllowed("/contact", "GET")).toBe(true);
    expect(isRestrictedPathAllowed("/api/license", "GET")).toBe(true);
  });

  it("does not treat ordinary writes as allowed", () => {
    expect(isRestrictedPathAllowed("/api/students", "POST")).toBe(false);
    expect(isRestrictedPathAllowed("/api/payments", "POST")).toBe(false);
    expect(isRestrictedPathAllowed("/admin/students/new", "GET")).toBe(false);
  });
});

describe("portal feature flags", () => {
  const evaluation = evaluateLicense({
    now: new Date("2026-06-15T00:00:00Z"),
    claims: claims({ features: { ...DEFAULT_LICENSE_FEATURES, finance: false, student_portal: false } }),
    signatureValid: true,
    lastVerifiedAt: new Date(),
    storedStatus: "ACTIVE",
    offlineGraceDays: 14,
  });

  it("hides finance nav when the module is not licensed", () => {
    expect(isFeatureEnabled(evaluation, "finance")).toBe(false);
    const nav = filterNavByLicense(getAdminNav(), evaluation);
    expect(nav.some((item) => item.href === "/admin/finance")).toBe(false);
    expect(nav.some((item) => item.href === "/admin/settings/licence")).toBe(true);
  });

  it("hides learner fee links in the student portal", () => {
    const nav = filterNavByLicense(studentNav, evaluation);
    expect(nav.some((item) => item.href === "/student/fees")).toBe(false);
    expect(nav.some((item) => item.href === "/student/dashboard")).toBe(true);
  });

  it("treats staff self-service leave as an HR/Payroll feature", () => {
    expect(navHrefFeature("/staff/leave")).toBe("hr_payroll");
    expect(navHrefFeature("/parent/leave")).toBe("student_leave");
    expect(navHrefFeature("/staff/payslips")).toBe("hr_payroll");
    expect(navHrefFeature("/staff/timesheets")).toBe("hr_payroll");
    expect(navHrefFeature("/staff/attendance")).toBe("attendance");
    expect(navHrefFeature("/admin/visitors")).toBe("visitor_management");
    expect(navHrefFeature("/staff/visitors")).toBe("visitor_management");
  });

  it("reserves online examinations as a future module without hiding exam listings", () => {
    expect(LICENSE_FEATURE_KEYS).toContain("online_exams");
    expect(DEFAULT_LICENSE_FEATURES.online_exams).toBe(false);
    expect(isFutureLicenseFeature("online_exams")).toBe(true);
    expect(isFutureLicenseFeature("assessments")).toBe(false);
    expect(navHrefFeature("/student/exams")).toBe("assessments");
    expect(navHrefFeature("/parent/exams")).toBe("assessments");
    const evaluation = evaluateLicense({
      now: new Date("2026-06-15T00:00:00Z"),
      claims: claims({ features: { ...DEFAULT_LICENSE_FEATURES, online_exams: false } }),
      signatureValid: true,
      lastVerifiedAt: new Date(),
      storedStatus: "ACTIVE",
      offlineGraceDays: 14,
    });
    const nav = filterNavByLicense(studentNav, evaluation);
    expect(nav.some((item) => item.href === "/student/exams")).toBe(true);
  });

  it("uses a restricted banner after expiry", () => {
    const expired = evaluateLicense({
      now: new Date("2026-08-01T00:00:00Z"),
      claims: claims({ expiresAt: "2026-06-01T00:00:00Z", gracePeriodDays: 7, status: "ACTIVE" }),
      signatureValid: true,
      lastVerifiedAt: new Date("2026-08-01T00:00:00Z"),
      storedStatus: "EXPIRED",
      offlineGraceDays: 14,
    });
    expect(licenseBannerTone(expired)).toBe("restricted");
  });
});
