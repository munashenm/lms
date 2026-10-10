import { LicenseStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { enableDailyBackupsForPaidLicence } from "@/lib/backup/schedule";
import { asInputJson } from "@/lib/json";
import { isLicenseServerEnabled } from "@/lib/licensing/crypto";
import {
  applySignedClaims,
  createLocalTrialLicense,
  evaluateStoredLicense,
} from "@/lib/licensing/service";
import { syncLicenseFeatures } from "@/lib/licensing/usage";
import {
  DEFAULT_LICENSE_FEATURES,
  normalizeFeatures,
  type LicenseFeatureKey,
} from "@/lib/licensing/features";
import { toMoneyDecimal, DEFAULT_PRICE_CURRENCY } from "@/lib/licensing/commercial";
import { issueSignedLicense } from "@/lib/license-server/issue";
import { applyVendorLicenseAction } from "@/lib/license-server/desk";
import type { LicenseLimits } from "@/lib/licensing/types";

export type SchoolLicenseAdminAction =
  | "extend_trial"
  | "convert_to_paid"
  | "suspend"
  | "reactivate"
  | "revoke"
  | "change_rate"
  | "update_features";

async function findIssuedForSchool(schoolId: string, licenseKey: string | null) {
  if (!licenseKey) return null;
  return prisma.issuedLicense.findFirst({
    where: {
      OR: [{ licenseKey }, { institutionId: schoolId }],
    },
    include: { product: true, plan: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function ensureSchoolLicense(schoolId: string) {
  const existing = await prisma.schoolLicense.findUnique({ where: { schoolId } });
  if (existing) return existing;
  return createLocalTrialLicense(schoolId);
}

function limitsFromRow(license: {
  maxLearners: number | null;
  maxEducators: number | null;
  maxAdministrators: number | null;
  maxCampuses: number | null;
  storageLimitBytes: bigint | null;
}): LicenseLimits {
  return {
    maxLearners: license.maxLearners,
    maxEducators: license.maxEducators,
    maxAdministrators: license.maxAdministrators,
    maxCampuses: license.maxCampuses,
    storageLimitBytes: license.storageLimitBytes != null ? Number(license.storageLimitBytes) : null,
  };
}

async function updatePrice(
  licenseId: string,
  params: {
    pricePerLearner?: string | number | null;
    priceCurrency?: string | null;
    priceNotes?: string | null;
  }
) {
  const rate =
    params.pricePerLearner === null || params.pricePerLearner === ""
      ? null
      : toMoneyDecimal(params.pricePerLearner);
  if (params.pricePerLearner != null && params.pricePerLearner !== "" && !rate) {
    throw Object.assign(new Error("Invalid price per learner"), { status: 400 });
  }
  return prisma.schoolLicense.update({
    where: { id: licenseId },
    data: {
      pricePerLearner: rate,
      priceCurrency: params.priceCurrency?.trim() || DEFAULT_PRICE_CURRENCY,
      priceNotes: params.priceNotes?.trim() || null,
    },
  });
}

function auditActionName(action: SchoolLicenseAdminAction): string {
  switch (action) {
    case "extend_trial":
      return "TRIAL_EXTENDED";
    case "convert_to_paid":
      return "TRIAL_CONVERTED_TO_PAID";
    case "suspend":
      return "LICENCE_SUSPENDED";
    case "reactivate":
      return "LICENCE_REACTIVATED";
    case "revoke":
      return "LICENCE_REVOKED";
    case "change_rate":
      return "LICENCE_PRICE_CHANGED";
    case "update_features":
      return "LICENCE_FEATURE_CHANGED";
  }
}

async function logCommercialAudit(entry: {
  schoolId: string;
  userId?: string | null;
  action: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason?: string | null;
  actor?: string | null;
}) {
  await logAudit({
    schoolId: entry.schoolId,
    userId: entry.userId ?? undefined,
    action: entry.action,
    entity: "License",
    entityId: entry.entityId,
    metadata: asInputJson({
      actor: entry.actor ?? null,
      reason: entry.reason ?? null,
      oldValue: entry.before,
      newValue: entry.after,
    }),
  });
}

export async function applySchoolLicenseAdminAction(params: {
  schoolId: string;
  action: SchoolLicenseAdminAction;
  actorEmail?: string | null;
  actorUserId?: string | null;
  expiresAt?: Date | null;
  planCode?: string | null;
  features?: Record<string, boolean> | null;
  pricePerLearner?: string | number | null;
  priceCurrency?: string | null;
  priceNotes?: string | null;
  reason?: string | null;
}) {
  const school = await prisma.school.findUnique({ where: { id: params.schoolId } });
  if (!school) throw Object.assign(new Error("Institution not found"), { status: 404 });

  let license = await ensureSchoolLicense(params.schoolId);
  const before = {
    status: license.status,
    expiresAt: license.expiresAt?.toISOString() ?? null,
    planCode: license.planCode,
    pricePerLearner: license.pricePerLearner?.toString() ?? null,
    features: license.featuresJson,
  };

  const issued = await findIssuedForSchool(params.schoolId, license.licenseKey);
  const canSign = isLicenseServerEnabled();
  const vendorLifecycleAction =
    params.action === "extend_trial" ||
    params.action === "convert_to_paid" ||
    params.action === "suspend" ||
    params.action === "reactivate" ||
    params.action === "revoke"
      ? params.action
      : null;

  if (issued && canSign && vendorLifecycleAction) {
    await applyVendorLicenseAction({
      licenseId: issued.id,
      action: vendorLifecycleAction,
      expiresAt: params.expiresAt,
      planCode: params.planCode,
      features: params.features ?? undefined,
    });
    license = (await prisma.schoolLicense.findUnique({ where: { schoolId: params.schoolId } }))!;
    if (params.action === "convert_to_paid" && params.pricePerLearner != null) {
      license = await updatePrice(license.id, params);
    }
    await logCommercialAudit({
      schoolId: params.schoolId,
      userId: params.actorUserId,
      action: auditActionName(params.action),
      entityId: license.id,
      before,
      after: {
        status: license.status,
        expiresAt: license.expiresAt?.toISOString() ?? null,
        planCode: license.planCode,
        pricePerLearner: license.pricePerLearner?.toString() ?? null,
      },
      reason: params.reason,
      actor: params.actorEmail,
    });
    await enableBackupsAfterPaidConversion(params.action, params.schoolId);
    return { license, evaluation: await evaluateStoredLicense(params.schoolId) };
  }

  switch (params.action) {
    case "extend_trial": {
      if (!params.expiresAt) {
        throw Object.assign(new Error("New trial expiry date is required"), { status: 400 });
      }
      if (canSign) {
        const signed = await issueSignedLicense({
          licenseKey: license.licenseKey.startsWith("TRIAL-") ? undefined : license.licenseKey,
          productCode: "lms",
          planCode: "trial",
          institutionId: params.schoolId,
          institutionName: school.name,
          status: LicenseStatus.TRIAL,
          startsAt: license.startsAt ?? new Date(),
          expiresAt: params.expiresAt,
          gracePeriodDays: license.gracePeriodDays,
          limits: limitsFromRow(license),
          features: normalizeFeatures(license.featuresJson as Record<string, boolean>),
        });
        license = await applySignedClaims(params.schoolId, signed.claims, signed.token);
      } else {
        license = await prisma.schoolLicense.update({
          where: { id: license.id },
          data: {
            status: LicenseStatus.TRIAL,
            expiresAt: params.expiresAt,
            planCode: license.planCode ?? "trial",
            planName: license.planName ?? "Trial",
          },
        });
      }
      break;
    }
    case "convert_to_paid": {
      const planCode = params.planCode ?? "standard";
      const features = normalizeFeatures(
        params.features ?? (license.featuresJson as Record<string, boolean>)
      );
      const expiresAt = params.expiresAt ?? null;
      if (canSign) {
        const signed = await issueSignedLicense({
          licenseKey: license.licenseKey.startsWith("TRIAL-") ? undefined : license.licenseKey,
          productCode: "lms",
          planCode,
          institutionId: params.schoolId,
          institutionName: school.name,
          status: LicenseStatus.ACTIVE,
          startsAt: license.startsAt ?? new Date(),
          expiresAt,
          gracePeriodDays: license.gracePeriodDays,
          limits: limitsFromRow(license),
          features,
        });
        license = await applySignedClaims(params.schoolId, signed.claims, signed.token);
      } else {
        license = await prisma.schoolLicense.update({
          where: { id: license.id },
          data: {
            status: LicenseStatus.ACTIVE,
            planCode,
            planName: planCode === "standard" ? "Standard" : planCode,
            expiresAt,
            featuresJson: features,
          },
        });
        await syncLicenseFeatures(license.id, features);
      }
      if (params.pricePerLearner != null) {
        license = await updatePrice(license.id, params);
      }
      break;
    }
    case "suspend":
    case "reactivate":
    case "revoke": {
      const status =
        params.action === "suspend"
          ? LicenseStatus.SUSPENDED
          : params.action === "revoke"
            ? LicenseStatus.REVOKED
            : LicenseStatus.ACTIVE;
      license = await prisma.schoolLicense.update({
        where: { id: license.id },
        data: { status },
      });
      break;
    }
    case "change_rate": {
      license = await updatePrice(license.id, params);
      break;
    }
    case "update_features": {
      const features = normalizeFeatures(params.features ?? DEFAULT_LICENSE_FEATURES);
      if (canSign) {
        const signed = await issueSignedLicense({
          licenseKey: license.licenseKey.startsWith("TRIAL-") ? undefined : license.licenseKey,
          productCode: license.productCode || "lms",
          planCode: license.planCode ?? "standard",
          institutionId: params.schoolId,
          institutionName: school.name,
          status: license.status,
          startsAt: license.startsAt ?? new Date(),
          expiresAt: license.expiresAt,
          gracePeriodDays: license.gracePeriodDays,
          limits: limitsFromRow(license),
          features,
        });
        license = await applySignedClaims(params.schoolId, signed.claims, signed.token);
      } else {
        license = await prisma.schoolLicense.update({
          where: { id: license.id },
          data: { featuresJson: features },
        });
        await syncLicenseFeatures(license.id, features);
      }
      break;
    }
  }

  await logCommercialAudit({
    schoolId: params.schoolId,
    userId: params.actorUserId,
    action: auditActionName(params.action),
    entityId: license.id,
    before,
    after: {
      status: license.status,
      expiresAt: license.expiresAt?.toISOString() ?? null,
      planCode: license.planCode,
      pricePerLearner: license.pricePerLearner?.toString() ?? null,
      features: license.featuresJson,
    },
    reason: params.reason,
    actor: params.actorEmail,
  });

  await enableBackupsAfterPaidConversion(params.action, params.schoolId);
  return { license, evaluation: await evaluateStoredLicense(params.schoolId) };
}

async function enableBackupsAfterPaidConversion(action: SchoolLicenseAdminAction, schoolId: string) {
  if (action !== "convert_to_paid") return;
  try {
    await enableDailyBackupsForPaidLicence(schoolId);
  } catch (error) {
    console.error(
      "Paid backup coverage was not updated:",
      error instanceof Error ? error.message : "backup coverage failed"
    );
  }
}

export function enabledFeatureKeys(
  features: Record<string, boolean> | null | undefined
): LicenseFeatureKey[] {
  const normalized = normalizeFeatures(features);
  return (Object.keys(normalized) as LicenseFeatureKey[]).filter((key) => normalized[key]);
}
