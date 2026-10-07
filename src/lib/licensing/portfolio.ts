import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { evaluateLicense } from "@/lib/licensing/evaluate";
import { claimsFromLicense } from "@/lib/licensing/usage";
import { shouldTrustUnsignedLicense, offlineGraceDays } from "@/lib/licensing/service";
import { getLicensePublicKey, verifyLicenseToken } from "@/lib/licensing/crypto";
import {
  estimatedMonthlySubscription,
  formatZar,
  sumEstimatedMrr,
} from "@/lib/licensing/commercial";
import { normalizeFeatures } from "@/lib/licensing/features";
import type { LicenseStatusCode } from "@/lib/licensing/types";

export type PortfolioFilter =
  | "all"
  | "trial"
  | "active"
  | "grace"
  | "expired"
  | "suspended"
  | "revoked"
  | "trials_expiring_soon";

export interface PortfolioInstitutionRow {
  schoolId: string;
  name: string;
  slug: string;
  institutionType: string;
  schoolActive: boolean;
  licenseKey: string | null;
  storedStatus: string | null;
  effectiveStatus: LicenseStatusCode | "NONE";
  restricted: boolean;
  planCode: string | null;
  planName: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  gracePeriodDays: number | null;
  daysUntilExpiry: number | null;
  daysRemainingInGrace: number | null;
  activeLearners: number;
  maxLearners: number | null;
  pricePerLearner: string | null;
  priceCurrency: string;
  priceNotes: string | null;
  estimatedMonthly: string | null;
  projectedAfterConversion: string | null;
  enabledFeatures: string[];
  warnings: string[];
}

export interface PortfolioSummary {
  totalInstitutions: number;
  activePaid: number;
  trials: number;
  trialsExpiringSoon: number;
  grace: number;
  expired: number;
  suspended: number;
  revoked: number;
  activeLearners: number;
  estimatedMrr: string;
  projectedTrialRevenue: string;
}

async function evaluateRow(row: {
  schoolId: string;
  status: LicenseStatusCode;
  signedPayload: string | null;
  lastVerifiedAt: Date | null;
  productCode: string;
  productName: string;
  planCode: string | null;
  planName: string | null;
  licenseKey: string;
  issuedAt: Date | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  gracePeriodDays: number;
  maxLearners: number | null;
  maxEducators: number | null;
  maxAdministrators: number | null;
  maxCampuses: number | null;
  storageLimitBytes: bigint | null;
  featuresJson: unknown;
  installationId: string | null;
  registeredDomain: string | null;
  stagingDomain: string | null;
  serverInstanceId: string | null;
  customerName: string | null;
}) {
  const publicKey = getLicensePublicKey();
  const hasSignedPayload = Boolean(row.signedPayload);
  let claims = null;
  let signatureValid = false;
  if (row.signedPayload && publicKey) {
    const verified = await verifyLicenseToken(row.signedPayload, publicKey);
    if (verified.ok) {
      claims = verified.claims;
      signatureValid = true;
    }
  } else {
    claims = claimsFromLicense(row);
  }
  return evaluateLicense({
    now: new Date(),
    claims,
    signatureValid,
    lastVerifiedAt: row.lastVerifiedAt,
    storedStatus: row.status,
    offlineGraceDays: offlineGraceDays(),
    trustUnsignedLocal: shouldTrustUnsignedLicense(hasSignedPayload),
  });
}

export async function buildLicensingPortfolio(filter: PortfolioFilter = "all") {
  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      institutionType: true,
      isActive: true,
      license: true,
      _count: { select: { students: { where: { status: "ACTIVE" } } } },
    },
  });

  const rows: PortfolioInstitutionRow[] = [];
  for (const school of schools) {
    const activeLearners = school._count.students;
    const license = school.license;
    if (!license) {
      rows.push({
        schoolId: school.id,
        name: school.name,
        slug: school.slug,
        institutionType: school.institutionType,
        schoolActive: school.isActive,
        licenseKey: null,
        storedStatus: null,
        effectiveStatus: "NONE",
        restricted: true,
        planCode: null,
        planName: null,
        startsAt: null,
        expiresAt: null,
        gracePeriodDays: null,
        daysUntilExpiry: null,
        daysRemainingInGrace: null,
        activeLearners,
        maxLearners: null,
        pricePerLearner: null,
        priceCurrency: "ZAR",
        priceNotes: null,
        estimatedMonthly: null,
        projectedAfterConversion: null,
        enabledFeatures: [],
        warnings: ["No licence installed"],
      });
      continue;
    }

    const evaluation = await evaluateRow({
      ...license,
      status: license.status as LicenseStatusCode,
    });
    const rate = license.pricePerLearner;
    const estimated = estimatedMonthlySubscription(activeLearners, rate);
    const features = normalizeFeatures(license.featuresJson as Record<string, boolean>);
    rows.push({
      schoolId: school.id,
      name: school.name,
      slug: school.slug,
      institutionType: school.institutionType,
      schoolActive: school.isActive,
      licenseKey: license.licenseKey,
      storedStatus: license.status,
      effectiveStatus: evaluation.effectiveStatus,
      restricted: evaluation.restricted,
      planCode: license.planCode,
      planName: license.planName,
      startsAt: license.startsAt?.toISOString() ?? null,
      expiresAt: license.expiresAt?.toISOString() ?? null,
      gracePeriodDays: license.gracePeriodDays,
      daysUntilExpiry: evaluation.daysUntilExpiry,
      daysRemainingInGrace: evaluation.daysRemainingInGrace,
      activeLearners,
      maxLearners: license.maxLearners,
      pricePerLearner: rate?.toString() ?? null,
      priceCurrency: license.priceCurrency || "ZAR",
      priceNotes: license.priceNotes,
      estimatedMonthly:
        evaluation.effectiveStatus === "ACTIVE" ? formatZar(estimated) : null,
      projectedAfterConversion:
        evaluation.effectiveStatus === "TRIAL" || evaluation.effectiveStatus === "GRACE"
          ? formatZar(estimated)
          : null,
      enabledFeatures: Object.entries(features)
        .filter(([, on]) => on)
        .map(([key]) => key),
      warnings: evaluation.warnings,
    });
  }

  const summary: PortfolioSummary = {
    totalInstitutions: rows.length,
    activePaid: rows.filter((r) => r.effectiveStatus === "ACTIVE").length,
    trials: rows.filter((r) => r.effectiveStatus === "TRIAL").length,
    trialsExpiringSoon: rows.filter(
      (r) =>
        r.effectiveStatus === "TRIAL" &&
        r.daysUntilExpiry != null &&
        r.daysUntilExpiry >= 0 &&
        r.daysUntilExpiry <= 30
    ).length,
    grace: rows.filter((r) => r.effectiveStatus === "GRACE").length,
    expired: rows.filter((r) => r.effectiveStatus === "EXPIRED").length,
    suspended: rows.filter((r) => r.effectiveStatus === "SUSPENDED").length,
    revoked: rows.filter((r) => r.effectiveStatus === "REVOKED").length,
    activeLearners: rows.reduce((sum, r) => sum + r.activeLearners, 0),
    estimatedMrr: formatZar(
      sumEstimatedMrr(
        rows.map((r) => ({
          effectiveStatus: r.effectiveStatus,
          activeLearners: r.activeLearners,
          pricePerLearner: r.pricePerLearner,
        }))
      )
    )!,
    projectedTrialRevenue: formatZar(
      rows
        .filter((r) => r.effectiveStatus === "TRIAL" && r.pricePerLearner)
        .reduce((total, r) => {
          const est = estimatedMonthlySubscription(r.activeLearners, r.pricePerLearner);
          return est ? total.add(est) : total;
        }, new Prisma.Decimal(0))
    )!,
  };

  const filtered = rows.filter((row) => {
    switch (filter) {
      case "trial":
        return row.effectiveStatus === "TRIAL";
      case "active":
        return row.effectiveStatus === "ACTIVE";
      case "grace":
        return row.effectiveStatus === "GRACE";
      case "expired":
        return row.effectiveStatus === "EXPIRED";
      case "suspended":
        return row.effectiveStatus === "SUSPENDED";
      case "revoked":
        return row.effectiveStatus === "REVOKED";
      case "trials_expiring_soon":
        return (
          row.effectiveStatus === "TRIAL" &&
          row.daysUntilExpiry != null &&
          row.daysUntilExpiry >= 0 &&
          row.daysUntilExpiry <= 30
        );
      default:
        return true;
    }
  });

  return { summary, institutions: filtered, filter };
}
