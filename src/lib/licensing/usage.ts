import { prisma } from "@/lib/db";
import { LICENSE_FEATURE_KEYS, normalizeFeatures } from "./features";
import type { LicenseClaims, LicenseUsage } from "./types";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "ADMISSIONS_OFFICER", "FINANCE_OFFICER"] as const;

export async function countLicenseUsage(schoolId: string): Promise<LicenseUsage> {
  const [activeLearners, educators, administrators, campuses, documentAgg] = await Promise.all([
    prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.teacher.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.user.count({
      where: { schoolId, isActive: true, role: { in: [...ADMIN_ROLES] } },
    }),
    prisma.campus.count({ where: { schoolId, isActive: true } }),
    prisma.document.aggregate({
      where: { schoolId },
      _sum: { fileSize: true },
    }),
  ]);

  return {
    activeLearners,
    educators,
    administrators,
    campuses,
    storageBytes: documentAgg._sum.fileSize ?? 0,
  };
}

export async function ensureInstallationId(schoolId: string): Promise<string> {
  const existing = await prisma.licenseInstallation.findUnique({
    where: { schoolId },
  });
  if (existing) {
    await prisma.licenseInstallation.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
    return existing.installationId;
  }

  const created = await prisma.licenseInstallation.create({
    data: {
      schoolId,
      installationId: crypto.randomUUID(),
      hostname: process.env.HOSTNAME ?? null,
      registeredDomain: process.env.NEXT_PUBLIC_APP_URL ?? null,
      serverInstanceId: process.env.LICENSE_SERVER_INSTANCE_ID ?? null,
    },
  });
  return created.installationId;
}

export function claimsFromLicense(row: {
  productCode: string;
  productName: string;
  planCode: string | null;
  planName: string | null;
  licenseKey: string;
  schoolId: string;
  status: LicenseClaims["status"];
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
}): LicenseClaims {
  const features = normalizeFeatures(
    (row.featuresJson && typeof row.featuresJson === "object"
      ? (row.featuresJson as Record<string, boolean>)
      : null)
  );
  return {
    iss: "schoolhub-license-server",
    sub: row.schoolId,
    product: row.productCode,
    productName: row.productName,
    planCode: row.planCode,
    planName: row.planName,
    licenseKey: row.licenseKey,
    institutionId: row.schoolId,
    installationId: row.installationId,
    registeredDomain: row.registeredDomain,
    stagingDomain: row.stagingDomain,
    serverInstanceId: row.serverInstanceId,
    customerName: row.customerName,
    status: row.status,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    startsAt: row.startsAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    gracePeriodDays: row.gracePeriodDays,
    limits: {
      maxLearners: row.maxLearners,
      maxEducators: row.maxEducators,
      maxAdministrators: row.maxAdministrators,
      maxCampuses: row.maxCampuses,
      storageLimitBytes: row.storageLimitBytes != null ? Number(row.storageLimitBytes) : null,
    },
    features,
  };
}

export async function syncLicenseFeatures(
  licenseId: string,
  features: Record<string, boolean>
) {
  const normalized = normalizeFeatures(features);
  await prisma.$transaction(
    LICENSE_FEATURE_KEYS.map((key) =>
      prisma.licenseFeature.upsert({
        where: { licenseId_featureKey: { licenseId, featureKey: key } },
        create: { licenseId, featureKey: key, enabled: normalized[key] },
        update: { enabled: normalized[key] },
      })
    )
  );
}
