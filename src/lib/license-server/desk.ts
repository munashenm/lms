import { prisma } from "@/lib/db";
import {
  licenseStatusAfterAction,
  nextRenewalExpiry,
  type VendorLicenseAction,
} from "@/lib/license-server/desk-shared";
import { issueSignedLicense } from "@/lib/license-server/issue";
import { applySignedClaims } from "@/lib/licensing/service";
import type { LicenseLimits } from "@/lib/licensing/types";

export async function pushLicenseToSchools(licenseKey: string, claims: Parameters<typeof applySignedClaims>[1], token: string) {
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
}) {
  const issued = await prisma.issuedLicense.findUnique({
    where: { id: params.licenseId },
    include: { product: true, plan: true },
  });
  if (!issued) {
    throw Object.assign(new Error("Licence not found"), { status: 404 });
  }

  const status = licenseStatusAfterAction(params.action);
  const expiresAt =
    params.action === "renew"
      ? params.expiresAt ?? nextRenewalExpiry(issued.expiresAt)
      : issued.expiresAt;

  if (params.action === "revoke") {
    await prisma.licenseActivation.updateMany({
      where: { issuedLicenseId: issued.id },
      data: { revokedAt: new Date() },
    });
  }
  if (params.action === "reactivate" || params.action === "renew") {
    await prisma.licenseActivation.updateMany({
      where: { issuedLicenseId: issued.id },
      data: { revokedAt: null, isActive: true },
    });
  }

  const signed = await issueSignedLicense({
    licenseKey: issued.licenseKey,
    productCode: issued.product.code,
    planCode: issued.plan?.code,
    customerId: issued.customerId,
    institutionId: issued.institutionId,
    institutionName: issued.institutionName,
    status,
    startsAt: issued.startsAt,
    expiresAt,
    gracePeriodDays: issued.gracePeriodDays,
    limits: issued.limitsJson as unknown as LicenseLimits,
    features: issued.featuresJson as Record<string, boolean>,
    domains: (issued.domainsJson as string[] | null) ?? [],
    maxActivations: issued.maxActivations,
  });

  await pushLicenseToSchools(issued.licenseKey, signed.claims, signed.token);
  if (issued.institutionId && !signed.claims.institutionId) {
    await applySignedClaims(issued.institutionId, signed.claims, signed.token);
  }

  return { ...signed, status, expiresAt };
}
