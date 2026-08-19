import { LicenseCheckResult, type LicenseStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifySchoolRoles } from "@/lib/notifications";
import { UserRole } from "@prisma/client";
import { getLicensePublicKey, verifyLicenseToken } from "./crypto";
import { evaluateLicense } from "./evaluate";
import { claimsFromLicense, ensureInstallationId, syncLicenseFeatures } from "./usage";
import type { EvaluatedLicense, LicenseClaims } from "./types";
import { DEFAULT_LICENSE_FEATURES } from "./features";

const PRODUCT = "lms";

export function heartbeatIntervalMs(): number {
  const hours = Number(process.env.LICENSE_HEARTBEAT_HOURS ?? "24");
  return Math.max(1, hours) * 60 * 60 * 1000;
}

export function offlineGraceDays(): number {
  const days = Number(process.env.LICENSE_OFFLINE_GRACE_DAYS ?? "14");
  return Math.max(1, days);
}

export function trustUnsignedLocal(): boolean {
  if (process.env.LICENSE_TRUST_LOCAL === "true") return true;
  if (process.env.LICENSE_TRUST_LOCAL === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function licenseServerUrl(): string | null {
  const url = process.env.LICENSE_SERVER_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

export async function evaluateStoredLicense(
  schoolId: string,
  opts?: { serverUnavailable?: boolean }
): Promise<EvaluatedLicense> {
  const row = await prisma.schoolLicense.findUnique({ where: { schoolId } });
  const publicKey = getLicensePublicKey();
  let claims: LicenseClaims | null = null;
  let signatureValid = false;

  if (row?.signedPayload && publicKey) {
    const verified = await verifyLicenseToken(row.signedPayload, publicKey);
    if (verified.ok) {
      claims = verified.claims;
      signatureValid = true;
    }
  } else if (row) {
    claims = claimsFromLicense(row);
    signatureValid = false;
  }

  return evaluateLicense({
    now: new Date(),
    claims,
    signatureValid,
    lastVerifiedAt: row?.lastVerifiedAt ?? null,
    storedStatus: row?.status ?? null,
    offlineGraceDays: offlineGraceDays(),
    serverUnavailable: opts?.serverUnavailable ?? false,
    trustUnsignedLocal: trustUnsignedLocal() && !publicKey,
  });
}

async function persistEvaluation(
  schoolId: string,
  evaluation: EvaluatedLicense,
  source: string,
  extra?: Partial<{ lastCheckError: string | null; offlineSince: Date | null }>
) {
  const row = await prisma.schoolLicense.findUnique({ where: { schoolId } });
  if (!row) return;
  const nextStatus = evaluation.effectiveStatus as LicenseStatus;
  const previous = row.status;
  await prisma.schoolLicense.update({
    where: { id: row.id },
    data: {
      status: nextStatus,
      lastCheckError: extra?.lastCheckError ?? null,
      offlineSince: extra?.offlineSince ?? (evaluation.serverUnavailable ? row.offlineSince ?? new Date() : null),
    },
  });

  await prisma.licenseCheck.create({
    data: {
      schoolId,
      licenseId: row.id,
      result: evaluation.restricted
        ? LicenseCheckResult.RESTRICTED
        : evaluation.serverUnavailable
          ? LicenseCheckResult.OFFLINE_CACHE
          : evaluation.effectiveStatus === "GRACE"
            ? LicenseCheckResult.GRACE
            : LicenseCheckResult.VALID,
      source,
      message: evaluation.warnings[0] ?? null,
      metadata: {
        effectiveStatus: evaluation.effectiveStatus,
        signatureValid: evaluation.signatureValid,
      },
    },
  });

  if (previous !== nextStatus) {
    const action =
      nextStatus === "EXPIRED"
        ? "LICENSE_EXPIRED"
        : nextStatus === "SUSPENDED"
          ? "LICENSE_SUSPENDED"
          : "LICENSE_UPDATED";
    await logAudit({
      schoolId,
      action,
      entity: "License",
      entityId: row.id,
      metadata: { from: previous, to: nextStatus, source },
    });
  }
}

export async function applySignedClaims(
  schoolId: string,
  claims: LicenseClaims,
  signedPayload: string
) {
  const installationId = await ensureInstallationId(schoolId);
  const row = await prisma.schoolLicense.upsert({
    where: { schoolId },
    create: {
      schoolId,
      productCode: claims.product,
      productName: claims.productName ?? "SchoolHub SA LMS",
      planCode: claims.planCode ?? null,
      planName: claims.planName ?? null,
      licenseKey: claims.licenseKey,
      status: claims.status,
      issuedAt: claims.issuedAt ? new Date(claims.issuedAt) : new Date(),
      startsAt: claims.startsAt ? new Date(claims.startsAt) : new Date(),
      expiresAt: claims.expiresAt ? new Date(claims.expiresAt) : null,
      gracePeriodDays: claims.gracePeriodDays,
      maxLearners: claims.limits.maxLearners,
      maxEducators: claims.limits.maxEducators,
      maxAdministrators: claims.limits.maxAdministrators,
      maxCampuses: claims.limits.maxCampuses,
      storageLimitBytes: claims.limits.storageLimitBytes != null
        ? BigInt(claims.limits.storageLimitBytes)
        : null,
      featuresJson: claims.features,
      signedPayload,
      lastVerifiedAt: new Date(),
      nextVerificationAt: new Date(Date.now() + heartbeatIntervalMs()),
      installationId: claims.installationId ?? installationId,
      registeredDomain: claims.registeredDomain ?? null,
      stagingDomain: claims.stagingDomain ?? null,
      serverInstanceId: claims.serverInstanceId ?? null,
      customerName: claims.customerName ?? null,
    },
    update: {
      productCode: claims.product,
      productName: claims.productName ?? "SchoolHub SA LMS",
      planCode: claims.planCode ?? null,
      planName: claims.planName ?? null,
      licenseKey: claims.licenseKey,
      status: claims.status,
      issuedAt: claims.issuedAt ? new Date(claims.issuedAt) : undefined,
      startsAt: claims.startsAt ? new Date(claims.startsAt) : undefined,
      expiresAt: claims.expiresAt ? new Date(claims.expiresAt) : null,
      gracePeriodDays: claims.gracePeriodDays,
      maxLearners: claims.limits.maxLearners,
      maxEducators: claims.limits.maxEducators,
      maxAdministrators: claims.limits.maxAdministrators,
      maxCampuses: claims.limits.maxCampuses,
      storageLimitBytes: claims.limits.storageLimitBytes != null
        ? BigInt(claims.limits.storageLimitBytes)
        : null,
      featuresJson: claims.features,
      signedPayload,
      lastVerifiedAt: new Date(),
      nextVerificationAt: new Date(Date.now() + heartbeatIntervalMs()),
      lastCheckError: null,
      offlineSince: null,
      installationId: claims.installationId ?? installationId,
      registeredDomain: claims.registeredDomain ?? undefined,
      stagingDomain: claims.stagingDomain ?? undefined,
      serverInstanceId: claims.serverInstanceId ?? undefined,
      customerName: claims.customerName ?? undefined,
    },
  });
  await syncLicenseFeatures(row.id, claims.features);
  return row;
}

export async function checkLicenseWithServer(
  schoolId: string,
  source: string
): Promise<EvaluatedLicense> {
  const row = await prisma.schoolLicense.findUnique({ where: { schoolId } });
  const url = licenseServerUrl();
  const publicKey = getLicensePublicKey();
  const installationId = await ensureInstallationId(schoolId);

  if (url && row?.licenseKey) {
    try {
      const res = await fetch(`${url}/v1/licenses/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: row.licenseKey,
          product: PRODUCT,
          institutionId: schoolId,
          installationId,
          domain: process.env.NEXT_PUBLIC_APP_URL ?? null,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) {
        const body = (await res.json()) as { token?: string };
        if (body.token && publicKey) {
          const verified = await verifyLicenseToken(body.token, publicKey);
          if (!verified.ok) {
            const evaluation = await evaluateStoredLicense(schoolId);
            await persistEvaluation(schoolId, { ...evaluation, signatureValid: false, restricted: true, effectiveStatus: "REVOKED" }, source);
            await logAudit({
              schoolId,
              action: "LICENSE_CHECKED",
              entity: "License",
              entityId: row.id,
              metadata: { result: "INVALID_SIGNATURE", source },
            });
            return {
              ...evaluation,
              signatureValid: false,
              restricted: true,
              effectiveStatus: "REVOKED",
              warnings: ["The licence server returned a token that failed signature verification."],
            };
          }
          await applySignedClaims(schoolId, verified.claims, verified.token);
          const evaluation = await evaluateStoredLicense(schoolId);
          await persistEvaluation(schoolId, evaluation, source);
          await logAudit({
            schoolId,
            action: "LICENSE_CHECKED",
            entity: "License",
            entityId: row.id,
            metadata: { result: evaluation.effectiveStatus, source },
          });
          return evaluation;
        }
      }
    } catch {
      // Fall through to cached licence — a single failed request must not disable the LMS.
    }
    const cached = await evaluateStoredLicense(schoolId, { serverUnavailable: true });
    await persistEvaluation(schoolId, cached, source, {
      lastCheckError: "LICENSE_SERVER_UNAVAILABLE",
      offlineSince: row.offlineSince ?? new Date(),
    });
    await logAudit({
      schoolId,
      action: "LICENSE_CHECKED",
      entity: "License",
      entityId: row.id,
      metadata: { result: "SERVER_UNAVAILABLE", source },
    });
    return cached;
  }

  const local = await evaluateStoredLicense(schoolId);
  if (row) await persistEvaluation(schoolId, local, source);
  return local;
}

export async function maybeHeartbeat(schoolId: string): Promise<EvaluatedLicense> {
  const row = await prisma.schoolLicense.findUnique({ where: { schoolId } });
  if (!row) return evaluateStoredLicense(schoolId);
  const due = !row.nextVerificationAt || row.nextVerificationAt <= new Date();
  if (!due) return evaluateStoredLicense(schoolId);
  return checkLicenseWithServer(schoolId, "heartbeat");
}

export async function createLocalTrialLicense(schoolId: string) {
  const installationId = await ensureInstallationId(schoolId);
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const row = await prisma.schoolLicense.create({
    data: {
      schoolId,
      productCode: "lms",
      productName: "SchoolHub SA LMS",
      planCode: "trial",
      planName: "Trial",
      licenseKey: `TRIAL-${schoolId.slice(-8).toUpperCase()}`,
      status: "TRIAL",
      issuedAt: startsAt,
      startsAt,
      expiresAt,
      gracePeriodDays: 14,
      maxLearners: 1000,
      maxEducators: 50,
      maxAdministrators: 10,
      maxCampuses: 3,
      featuresJson: DEFAULT_LICENSE_FEATURES,
      installationId,
      lastVerifiedAt: startsAt,
      nextVerificationAt: new Date(startsAt.getTime() + heartbeatIntervalMs()),
    },
  });
  await syncLicenseFeatures(row.id, DEFAULT_LICENSE_FEATURES);
  await logAudit({
    schoolId,
    action: "LICENSE_ACTIVATED",
    entity: "License",
    entityId: row.id,
    metadata: { plan: "trial", local: true },
  });
  return row;
}

export async function notifyLicenseWarnings(schoolId: string, evaluation: EvaluatedLicense) {
  if (evaluation.warnings.length === 0) return;
  const type = evaluation.restricted ? "WARNING" : evaluation.effectiveStatus === "GRACE" ? "WARNING" : "INFO";
  await notifySchoolRoles({
    schoolId,
    roles: [UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.PRINCIPAL],
    title: evaluation.restricted ? "Licence restricted" : "Licence notice",
    message: evaluation.warnings[0],
    type,
    link: "/admin/settings/licence",
  });
}
