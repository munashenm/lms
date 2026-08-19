import { LicenseStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { asInputJson } from "@/lib/json";
import { normalizeFeatures, DEFAULT_LICENSE_FEATURES } from "@/lib/licensing/features";
import { getLicensePrivateKey, signLicenseClaims } from "@/lib/licensing/crypto";
import type { LicenseClaims, LicenseLimits } from "@/lib/licensing/types";

function randomLicenseKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chunk = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `SHSA-${chunk()}-${chunk()}-${chunk()}`;
}

export async function ensureDefaultCatalog() {
  const product = await prisma.licenseProduct.upsert({
    where: { code: "lms" },
    update: {},
    create: {
      code: "lms",
      name: "SchoolHub SA LMS",
      description: "Learner Management System for South African schools",
    },
  });

  await prisma.licenseProduct.upsert({
    where: { code: "lawyer_management" },
    update: {},
    create: { code: "lawyer_management", name: "Lawyer Management System" },
  });
  await prisma.licenseProduct.upsert({
    where: { code: "workflow" },
    update: {},
    create: { code: "workflow", name: "Workflow System" },
  });
  await prisma.licenseProduct.upsert({
    where: { code: "pos" },
    update: {},
    create: { code: "pos", name: "Point of Sale" },
  });
  await prisma.licenseProduct.upsert({
    where: { code: "school_management" },
    update: {},
    create: { code: "school_management", name: "School Management System" },
  });

  await prisma.licensePlan.upsert({
    where: { productId_code: { productId: product.id, code: "trial" } },
    update: {},
    create: {
      productId: product.id,
      code: "trial",
      name: "Trial",
      defaultGraceDays: 14,
      defaultLimits: {
        maxLearners: 100,
        maxEducators: 10,
        maxAdministrators: 5,
        maxCampuses: 1,
      },
      defaultFeatures: DEFAULT_LICENSE_FEATURES,
    },
  });

  await prisma.licensePlan.upsert({
    where: { productId_code: { productId: product.id, code: "standard" } },
    update: {},
    create: {
      productId: product.id,
      code: "standard",
      name: "Standard",
      defaultGraceDays: 14,
      defaultLimits: {
        maxLearners: 1000,
        maxEducators: 80,
        maxAdministrators: 20,
        maxCampuses: 3,
      },
      defaultFeatures: { ...DEFAULT_LICENSE_FEATURES, sms: true, advanced_analytics: true },
    },
  });

  return product;
}

export async function issueSignedLicense(opts: {
  licenseKey?: string;
  productCode?: string;
  planCode?: string;
  customerId?: string | null;
  institutionId?: string | null;
  institutionName?: string | null;
  status?: LicenseStatus;
  startsAt?: Date;
  expiresAt?: Date | null;
  gracePeriodDays?: number;
  limits?: Partial<LicenseLimits>;
  features?: Record<string, boolean>;
  domains?: string[];
  maxActivations?: number;
}): Promise<{ token: string; claims: LicenseClaims; licenseKey: string }> {
  const privateKey = getLicensePrivateKey();
  if (!privateKey) {
    throw new Error("LICENSE_SIGNING_PRIVATE_KEY is not configured on the licence server");
  }

  await ensureDefaultCatalog();
  const product = await prisma.licenseProduct.findUnique({
    where: { code: opts.productCode ?? "lms" },
  });
  if (!product) throw new Error("Unknown product");

  const plan = opts.planCode
    ? await prisma.licensePlan.findUnique({
        where: { productId_code: { productId: product.id, code: opts.planCode } },
      })
    : await prisma.licensePlan.findFirst({ where: { productId: product.id, code: "standard" } });

  const planLimits = (plan?.defaultLimits ?? {}) as Partial<LicenseLimits>;
  const planFeatures = (plan?.defaultFeatures ?? {}) as Record<string, boolean>;
  const licenseKey = opts.licenseKey ?? randomLicenseKey();
  const features = normalizeFeatures({ ...planFeatures, ...opts.features });
  const limits: LicenseLimits = {
    maxLearners: opts.limits?.maxLearners ?? planLimits.maxLearners ?? 1000,
    maxEducators: opts.limits?.maxEducators ?? planLimits.maxEducators ?? 80,
    maxAdministrators: opts.limits?.maxAdministrators ?? planLimits.maxAdministrators ?? 20,
    maxCampuses: opts.limits?.maxCampuses ?? planLimits.maxCampuses ?? 3,
    storageLimitBytes: opts.limits?.storageLimitBytes ?? planLimits.storageLimitBytes ?? null,
  };

  const startsAt = opts.startsAt ?? new Date();
  const issued = await prisma.issuedLicense.upsert({
    where: { licenseKey },
    create: {
      licenseKey,
      productId: product.id,
      planId: plan?.id ?? null,
      customerId: opts.customerId ?? null,
      institutionId: opts.institutionId ?? null,
      institutionName: opts.institutionName ?? null,
      status: opts.status ?? LicenseStatus.ACTIVE,
      startsAt,
      expiresAt: opts.expiresAt ?? null,
      gracePeriodDays: opts.gracePeriodDays ?? plan?.defaultGraceDays ?? 14,
      limitsJson: asInputJson(limits),
      featuresJson: asInputJson(features),
      domainsJson: asInputJson(opts.domains ?? []),
      maxActivations: opts.maxActivations ?? 1,
    },
    update: {
      status: opts.status ?? undefined,
      expiresAt: opts.expiresAt === undefined ? undefined : opts.expiresAt,
      limitsJson: asInputJson(limits),
      featuresJson: asInputJson(features),
      institutionId: opts.institutionId ?? undefined,
    },
  });

  const claims: LicenseClaims = {
    iss: "schoolhub-license-server",
    sub: issued.institutionId ?? issued.licenseKey,
    product: product.code,
    productName: product.name,
    planCode: plan?.code ?? null,
    planName: plan?.name ?? null,
    licenseKey,
    institutionId: issued.institutionId,
    status: issued.status,
    issuedAt: issued.issuedAt.toISOString(),
    startsAt: issued.startsAt.toISOString(),
    expiresAt: issued.expiresAt?.toISOString() ?? null,
    gracePeriodDays: issued.gracePeriodDays,
    limits,
    features,
    registeredDomain: Array.isArray(opts.domains) ? opts.domains[0] ?? null : null,
  };

  const token = await signLicenseClaims(claims, privateKey);
  return { token, claims, licenseKey };
}

export async function checkIssuedLicense(input: {
  licenseKey: string;
  product?: string;
  institutionId?: string | null;
  installationId?: string | null;
  domain?: string | null;
  serverInstanceId?: string | null;
}): Promise<{ token: string; claims: LicenseClaims }> {
  const issued = await prisma.issuedLicense.findUnique({
    where: { licenseKey: input.licenseKey },
    include: { product: true, plan: true, activations: true },
  });
  if (!issued) {
    throw Object.assign(new Error("Unknown licence key"), { status: 404 });
  }
  if (input.product && issued.product.code !== input.product) {
    throw Object.assign(new Error("Licence is not valid for this product"), { status: 403 });
  }
  if (issued.institutionId && input.institutionId && issued.institutionId !== input.institutionId) {
    throw Object.assign(new Error("Licence is bound to a different institution"), { status: 403 });
  }

  const domains = (issued.domainsJson as string[] | null) ?? [];
  if (input.domain && domains.length > 0) {
    const host = safeHost(input.domain);
    const allowed = domains.some((d) => d === host || d === input.domain);
    if (host && !allowed) {
      throw Object.assign(new Error("Licence is not valid for this domain"), { status: 403 });
    }
  }

  if (input.installationId) {
    const existing = issued.activations.find((a) => a.installationId === input.installationId);
    if (!existing) {
      const activeCount = issued.activations.filter((a) => a.isActive).length;
      if (activeCount >= issued.maxActivations) {
        throw Object.assign(new Error("Maximum activations reached for this licence"), { status: 403 });
      }
      await prisma.licenseActivation.create({
        data: {
          issuedLicenseId: issued.id,
          installationId: input.installationId,
          domain: input.domain ?? null,
          serverInstanceId: input.serverInstanceId ?? null,
        },
      });
    } else {
      if (!existing.isActive) {
        throw Object.assign(new Error("This installation has been deactivated"), { status: 403 });
      }
      await prisma.licenseActivation.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), domain: input.domain ?? existing.domain },
      });
    }
  }

  return issueSignedLicense({
    licenseKey: issued.licenseKey,
    productCode: issued.product.code,
    planCode: issued.plan?.code,
    customerId: issued.customerId,
    institutionId: issued.institutionId ?? input.institutionId,
    institutionName: issued.institutionName,
    status: issued.status,
    startsAt: issued.startsAt,
    expiresAt: issued.expiresAt,
    gracePeriodDays: issued.gracePeriodDays,
    limits: issued.limitsJson as unknown as LicenseLimits,
    features: issued.featuresJson as Record<string, boolean>,
    domains,
    maxActivations: issued.maxActivations,
  });
}

function safeHost(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return value || null;
  }
}
