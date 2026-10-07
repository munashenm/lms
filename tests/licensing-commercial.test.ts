import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { hasPermission, canAccessSchool } from "@/lib/rbac";
import { evaluateLicense, isActiveLearnerStatus, learnerLimitReached } from "@/lib/licensing/evaluate";
import { DEFAULT_LICENSE_FEATURES } from "@/lib/licensing/features";
import type { LicenseClaims } from "@/lib/licensing/types";
import {
  estimatedMonthlySubscription,
  sumEstimatedMrr,
  toMoneyDecimal,
  DEFAULT_PRICE_PER_LEARNER,
} from "@/lib/licensing/commercial";
import { licenseStatusAfterAction } from "@/lib/license-server/desk-shared";
import { claimsAllowFeature, isRestrictedPathAllowed } from "@/lib/licensing/enforce";
import { licenseFeatureForModule } from "@/lib/modules";
import { generateLicenseKeyPair, signLicenseClaims, verifyLicenseToken } from "@/lib/licensing/crypto";

function claims(overrides: Partial<LicenseClaims> = {}): LicenseClaims {
  return {
    iss: "schoolhub-license-server",
    sub: "school-a",
    product: "lms",
    licenseKey: "SHSA-TEST-KEY",
    status: "ACTIVE",
    startsAt: "2026-06-01T00:00:00Z",
    expiresAt: "2026-07-01T00:00:00Z",
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

describe("School Admin licence permissions", () => {
  it("denies platform licence management to School Admin", () => {
    expect(hasPermission(UserRole.SCHOOL_ADMIN, "license.manage")).toBe(false);
    expect(hasPermission(UserRole.SCHOOL_ADMIN, "license.view")).toBe(true);
    expect(hasPermission(UserRole.SCHOOL_ADMIN, "license.activate")).toBe(true);
    expect(hasPermission(UserRole.SUPER_ADMIN, "license.manage")).toBe(true);
  });

  it("blocks cross-tenant school access", () => {
    const admin = {
      userId: "u1",
      email: "a@school.za",
      role: UserRole.SCHOOL_ADMIN,
      schoolId: "school-a",
      firstName: "Ann",
      lastName: "Admin",
    };
    expect(canAccessSchool(admin, "school-a")).toBe(true);
    expect(canAccessSchool(admin, "school-b")).toBe(false);
  });
});

describe("restricted and feature enforcement", () => {
  it("restricts suspended, expired and revoked licences", () => {
    for (const status of ["SUSPENDED", "EXPIRED", "REVOKED"] as const) {
      const evaluation = evaluateLicense({
        now: new Date("2026-06-15T00:00:00Z"),
        claims: claims({
          status: status === "EXPIRED" ? "ACTIVE" : status,
          expiresAt: status === "EXPIRED" ? "2026-06-01T00:00:00Z" : "2026-07-01T00:00:00Z",
          gracePeriodDays: status === "EXPIRED" ? 0 : 7,
        }),
        signatureValid: true,
        lastVerifiedAt: new Date(),
        storedStatus: status === "EXPIRED" ? "ACTIVE" : status,
        offlineGraceDays: 14,
      });
      expect(evaluation.restricted).toBe(true);
    }
  });

  it("keeps grace unrestricted with warnings", () => {
    const evaluation = evaluateLicense({
      now: new Date("2026-06-05T00:00:00Z"),
      claims: claims({ expiresAt: "2026-06-01T00:00:00Z", gracePeriodDays: 7, status: "ACTIVE" }),
      signatureValid: true,
      lastVerifiedAt: new Date(),
      storedStatus: "ACTIVE",
      offlineGraceDays: 14,
    });
    expect(evaluation.effectiveStatus).toBe("GRACE");
    expect(evaluation.restricted).toBe(false);
  });

  it("does not allow ordinary mutation paths when restricted", () => {
    expect(isRestrictedPathAllowed("/api/students", "POST")).toBe(false);
    expect(isRestrictedPathAllowed("/api/modules", "PUT")).toBe(false);
    expect(isRestrictedPathAllowed("/api/license", "POST")).toBe(true);
    expect(isRestrictedPathAllowed("/api/backups", "POST")).toBe(true);
  });

  it("blocks School Admin from enabling an unlicensed module feature", () => {
    expect(licenseFeatureForModule("finance")).toBe("finance");
    expect(claimsAllowFeature({ ...DEFAULT_LICENSE_FEATURES, finance: false }, "finance")).toBe(false);
    expect(claimsAllowFeature({ ...DEFAULT_LICENSE_FEATURES, finance: true }, "finance")).toBe(true);
    expect(licenseFeatureForModule("students")).toBeNull();
  });
});

describe("trial lifecycle actions", () => {
  it("keeps extend_trial as TRIAL and convert_to_paid as ACTIVE", () => {
    expect(licenseStatusAfterAction("extend_trial")).toBe("TRIAL");
    expect(licenseStatusAfterAction("convert_to_paid")).toBe("ACTIVE");
    expect(licenseStatusAfterAction("renew")).toBe("ACTIVE");
  });
});

describe("commercial pricing", () => {
  it("counts only ACTIVE learners as billable", () => {
    expect(isActiveLearnerStatus("ACTIVE")).toBe(true);
    expect(isActiveLearnerStatus("APPLICANT")).toBe(false);
    expect(isActiveLearnerStatus("WITHDRAWN")).toBe(false);
    expect(isActiveLearnerStatus("GRADUATED")).toBe(false);
    expect(learnerLimitReached(436, 1000)).toBe(false);
  });

  it("calculates estimated monthly subscription with Decimal safety", () => {
    const estimate = estimatedMonthlySubscription(436, "7");
    expect(estimate?.toFixed(2)).toBe("3052.00");
    expect(estimatedMonthlySubscription(436, null)).toBeNull();
    expect(toMoneyDecimal(DEFAULT_PRICE_PER_LEARNER)?.toFixed(2)).toBe("7.00");
  });

  it("sums MRR for ACTIVE licences only and tolerates null prices", () => {
    const mrr = sumEstimatedMrr([
      { effectiveStatus: "ACTIVE", activeLearners: 100, pricePerLearner: "7" },
      { effectiveStatus: "TRIAL", activeLearners: 50, pricePerLearner: "7" },
      { effectiveStatus: "ACTIVE", activeLearners: 10, pricePerLearner: null },
    ]);
    expect(mrr.equals(new Prisma.Decimal(700))).toBe(true);
  });

  it("continues verifying existing signed licences", async () => {
    const keys = await generateLicenseKeyPair();
    const token = await signLicenseClaims(claims({ status: "TRIAL" }), keys.privateKeyPem);
    const verified = await verifyLicenseToken(token, keys.publicKeyPem);
    expect(verified.ok).toBe(true);
  });
});
