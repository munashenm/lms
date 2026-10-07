import { LicenseStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  licenseStatusAfterAction,
  nextRenewalExpiry,
  type VendorLicenseAction,
} from "@/lib/license-server/desk-shared";
import { issueSignedLicense } from "@/lib/license-server/issue";
import { applySignedClaims } from "@/lib/licensing/service";
import { normalizeFeatures } from "@/lib/licensing/features";
import type { LicenseLimits } from "@/lib/licensing/types";

export async function pushLicenseToSchools(
  licenseKey: string,
  claims: Parameters<typeof applySignedClaims>[1],
  token: string
) {
  const rows = await prisma.schoolLicense.findMany({
    where: { licenseKey },
    select: { schoolId: true },
  });
  for (const row of rows) {
    await applySignedClaims(row.schoolId, claims, token);
  }
}

export async function applyVendorLicenseAction(params: {
  licenseId: string;
  action: VendorLicenseAction;
  expiresAt?: Date | null;
  planCode?: string | null;
  features?: Record<string, boolean>;
}) {
  const issued = await prisma.issuedLicense.findUnique({
    where: { id: params.licenseId },
    include: { product: true, plan: true },
  });
  if (!issued) {
    throw Object.assign(new Error("Licence not found"), { status: 404 });
  }

  const status = licenseStatusAfterAction(params.action);

  let expiresAt = issued.expiresAt;
  if (params.action === "renew") {
    expiresAt = params.expiresAt ?? nextRenewalExpiry(issued.expiresAt);
  } else if (params.action === "extend_trial") {
    if (!params.expiresAt) {
      throw Object.assign(new Error("New trial expiry date is required"), { status: 400 });
    }
    expiresAt = params.expiresAt;
  } else if (params.action === "convert_to_paid" && params.expiresAt) {
    expiresAt = params.expiresAt;
  }

  let planCode = issued.plan?.code ?? null;
  if (params.action === "convert_to_paid") {
    planCode = params.planCode ?? planCode ?? "standard";
  } else if (params.action === "extend_trial") {
    planCode = planCode ?? "trial";
  } else if (params.planCode) {
    planCode = params.planCode;
  }

  const features = normalizeFeatures(
    params.features ?? (issued.featuresJson as Record<string, boolean> | null)
  );

  if (params.action === "revoke") {
    await prisma.licenseActivation.updateMany({
      where: { issuedLicenseId: issued.id },
      data: { revokedAt: new Date() },
    });
  }
  if (
    params.action === "reactivate" ||
    params.action === "renew" ||
    params.action === "convert_to_paid" ||
    params.action === "extend_trial"
  ) {
    await prisma.licenseActivation.updateMany({
      where: { issuedLicenseId: issued.id },
      data: { revokedAt: null, isActive: true },
    });
  }

  const signed = await issueSignedLicense({
    licenseKey: issued.licenseKey,
    productCode: issued.product.code,
    planCode: planCode ?? undefined,
    customerId: issued.customerId,
    institutionId: issued.institutionId,
    institutionName: issued.institutionName,
    status,
    startsAt: issued.startsAt,
    expiresAt,
    gracePeriodDays: issued.gracePeriodDays,
    limits: issued.limitsJson as unknown as LicenseLimits,
    features,
    domains: (issued.domainsJson as string[] | null) ?? [],
    maxActivations: issued.maxActivations,
  });

  // Keep IssuedLicense plan pointer in sync when converting.
  if (params.action === "convert_to_paid" && planCode) {
    const plan = await prisma.licensePlan.findFirst({
      where: { productId: issued.productId, code: planCode },
    });
    if (plan) {
      await prisma.issuedLicense.update({
        where: { id: issued.id },
        data: { planId: plan.id, status: LicenseStatus.ACTIVE },
      });
    }
  }

  await pushLicenseToSchools(issued.licenseKey, signed.claims, signed.token);
  if (issued.institutionId) {
    await applySignedClaims(issued.institutionId, signed.claims, signed.token);
  }

  return { ...signed, status, expiresAt };
}
