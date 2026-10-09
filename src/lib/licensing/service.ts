import { LicenseCheckResult, type LicenseStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifySchoolRoles } from "@/lib/notifications";
import { UserRole } from "@prisma/client";
import { getLicensePublicKey, verifyLicenseToken } from "./crypto";
import { evaluateLicense } from "./evaluate";
import { claimsFromLicense, ensureInstallationId, syncLicenseFeatures } from "./usage";
import type { EvaluatedLicense, LicenseClaims } from "./types";
import { DEFAULT_LICENSE_FEATURES, normalizeFeatures } from "./features";
import { publicAppUrl } from "@/lib/app-url";
import {
  LICENSE_CHECK_MAX_ATTEMPTS,
  LICENSE_WARNING_AFTER_DAYS,
  classifyHttpStatus,
  classifyTransportError,
  contactFailureFor,
  licenseErrorCode,
  licenseRetryDelayMs,
  parseRetryAfterSeconds,
  repeatedVerificationWarning,
  sanitizeLicenseMessage,
  shouldRetryLicenseCheck,
  type LicenseFailureClass,
} from "./check-outcome";

const PRODUCT = "lms";

function withHrPayrollEnabled(claims: LicenseClaims): LicenseClaims {
  return {
    ...claims,
    features: { ...normalizeFeatures(claims.features), hr_payroll: true },
  };
}

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

/** Local trials stay usable until a signed licence has been activated. */
export function shouldTrustUnsignedLicense(hasSignedPayload: boolean): boolean {
  if (!hasSignedPayload) return true;
  return trustUnsignedLocal() && !getLicensePublicKey();
}

export function licenseServerUrl(): string | null {
  const url = process.env.LICENSE_SERVER_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

export async function evaluateStoredLicense(
  schoolId: string,
  opts?: { serverUnavailable?: boolean; contactFailure?: "transport" | "http" }
): Promise<EvaluatedLicense> {
  const row = await prisma.schoolLicense.findUnique({ where: { schoolId } });
  const publicKey = getLicensePublicKey();
  const hasSignedPayload = Boolean(row?.signedPayload);
  let claims: LicenseClaims | null = null;
  let signatureValid = false;

  if (row?.signedPayload && publicKey) {
    const verified = await verifyLicenseToken(row.signedPayload, publicKey);
    if (verified.ok) {
      claims = withHrPayrollEnabled(verified.claims);
      signatureValid = true;
    }
  } else if (row) {
    claims = withHrPayrollEnabled(claimsFromLicense(row));
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
    contactFailure: opts?.contactFailure,
    trustUnsignedLocal: shouldTrustUnsignedLicense(hasSignedPayload),
  });
}

async function persistEvaluation(
  schoolId: string,
  evaluation: EvaluatedLicense,
  source: string,
  extra?: Partial<{
    lastCheckError: string | null;
    offlineSince: Date | null;
    classification: string | null;
    httpStatus: number | null;
    attempts: number | null;
    detail: string | null;
  }>
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
      result:
        extra?.classification === "INVALID_SIGNATURE"
          ? LicenseCheckResult.INVALID_SIGNATURE
          : evaluation.restricted
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
        classification: extra?.classification ?? null,
        httpStatus: extra?.httpStatus ?? null,
        attempts: extra?.attempts ?? null,
        detail: extra?.detail || null,
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface LicenseAttemptFailure {
  classification: LicenseFailureClass;
  httpStatus: number | null;
  detail: string;
  retryAfterSeconds: number | null;
}

async function requestLicenseCheck(url: string, payload: string): Promise<
  | { ok: true; token: string }
  | ({ ok: false } & LicenseAttemptFailure)
> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const classified = classifyHttpStatus(res.status);
      const text = await res.text().catch(() => "");
      let detail = "";
      if (!classified.transient) {
        try {
          const parsed = JSON.parse(text) as { message?: string };
          detail = sanitizeLicenseMessage(parsed.message ?? "");
        } catch {
          detail = sanitizeLicenseMessage(text);
        }
      }
      const rejected = /revoked|expired|deactivated|not valid|maximum activations/i.test(detail);
      return {
        ok: false,
        classification:
          classified.classification === "HTTP_403" && rejected ? "LICENSE_REJECTED" : classified.classification,
        httpStatus: res.status,
        detail,
        retryAfterSeconds: parseRetryAfterSeconds(res.headers.get("retry-after")),
      };
    }
    let body: { token?: unknown };
    try {
      body = (await res.json()) as { token?: unknown };
    } catch {
      return {
        ok: false,
        classification: "MALFORMED_RESPONSE",
        httpStatus: res.status,
        detail: "",
        retryAfterSeconds: null,
      };
    }
    if (typeof body.token !== "string" || body.token.length === 0) {
      return {
        ok: false,
        classification: "MALFORMED_RESPONSE",
        httpStatus: res.status,
        detail: "",
        retryAfterSeconds: null,
      };
    }
    return { ok: true, token: body.token };
  } catch (error) {
    return {
      ok: false,
      classification: classifyTransportError(error),
      httpStatus: null,
      detail: "",
      retryAfterSeconds: null,
    };
  }
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
    const payload = JSON.stringify({
      licenseKey: row.licenseKey,
      product: PRODUCT,
      institutionId: schoolId,
      installationId,
      domain: publicAppUrl(),
    });
    let failure: LicenseAttemptFailure | null = null;
    let attempts = 0;
    for (let attempt = 0; attempt < LICENSE_CHECK_MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await delay(licenseRetryDelayMs(attempt, failure?.retryAfterSeconds));
      }
      attempts = attempt + 1;
      const result = await requestLicenseCheck(`${url}/v1/licenses/check`, payload);
      if (result.ok) {
        if (!publicKey) {
          failure = {
            classification: "MALFORMED_RESPONSE",
            httpStatus: 200,
            detail: "",
            retryAfterSeconds: null,
          };
          break;
        }
        const verified = await verifyLicenseToken(result.token, publicKey);
        if (!verified.ok) {
          const evaluation = await evaluateStoredLicense(schoolId);
          const revoked = {
            ...evaluation,
            signatureValid: false,
            restricted: true,
            effectiveStatus: "REVOKED" as const,
          };
          await persistEvaluation(schoolId, revoked, source, {
            lastCheckError: licenseErrorCode("INVALID_SIGNATURE"),
            classification: "INVALID_SIGNATURE",
            httpStatus: 200,
            attempts,
          });
          await logAudit({
            schoolId,
            action: "LICENSE_CHECKED",
            entity: "License",
            entityId: row.id,
            metadata: { result: "INVALID_SIGNATURE", source, httpStatus: 200, attempts },
          });
          console.warn(
            "[license-check]",
            JSON.stringify({ schoolId, source, classification: "INVALID_SIGNATURE", httpStatus: 200, attempts })
          );
          return {
            ...revoked,
            warnings: ["The licence server returned a token that failed signature verification."],
          };
        }
        await applySignedClaims(schoolId, verified.claims, verified.token);
        const evaluation = await evaluateStoredLicense(schoolId);
        await persistEvaluation(schoolId, evaluation, source, {
          lastCheckError: null,
          classification: "SUCCESS",
          httpStatus: 200,
          attempts,
        });
        await logAudit({
          schoolId,
          action: "LICENSE_CHECKED",
          entity: "License",
          entityId: row.id,
          metadata: { result: evaluation.effectiveStatus, source, httpStatus: 200, attempts },
        });
        return evaluation;
      }
      failure = result;
      if (!shouldRetryLicenseCheck(result.classification, attempts)) break;
    }

    const classification = failure?.classification ?? "NETWORK";
    const contactFailure = contactFailureFor(classification);
    const cached = await evaluateStoredLicense(schoolId, { serverUnavailable: true, contactFailure });
    await persistEvaluation(schoolId, cached, source, {
      lastCheckError: licenseErrorCode(classification),
      offlineSince: row.offlineSince ?? new Date(),
      classification,
      httpStatus: failure?.httpStatus ?? null,
      attempts,
      detail: failure?.detail || null,
    });
    await logAudit({
      schoolId,
      action: "LICENSE_CHECKED",
      entity: "License",
      entityId: row.id,
      metadata: {
        result: licenseErrorCode(classification),
        source,
        httpStatus: failure?.httpStatus ?? null,
        attempts,
      },
    });
    console.warn(
      "[license-check]",
      JSON.stringify({
        schoolId,
        source,
        classification,
        httpStatus: failure?.httpStatus ?? null,
        attempts,
        daysOffline: cached.daysOffline,
      })
    );
    if ((cached.daysOffline ?? 0) >= LICENSE_WARNING_AFTER_DAYS) {
      await notifyRepeatedVerificationFailure(schoolId, cached.daysOffline ?? 0);
    }
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

async function notifyRepeatedVerificationFailure(schoolId: string, daysOffline: number) {
  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });
    const title = "Licence verification warning";
    const message = repeatedVerificationWarning(school?.name ?? "A school", daysOffline);
    const since = new Date(Date.now() - 20 * 60 * 60 * 1000);
    const admins = await prisma.user.findMany({
      where: { role: UserRole.SUPER_ADMIN, isActive: true },
      select: { id: true },
    });
    if (admins.length === 0) {
      console.warn("[license-check]", JSON.stringify({ schoolId, warning: "no-super-admin", daysOffline }));
      return;
    }
    for (const admin of admins) {
      const recent = await prisma.notification.findFirst({
        where: { userId: admin.id, schoolId, title, createdAt: { gte: since } },
      });
      if (recent) continue;
      await prisma.notification.create({
        data: {
          userId: admin.id,
          schoolId,
          title,
          message,
          type: "WARNING",
          link: "/admin/licensing",
        },
      });
    }
  } catch (error) {
    console.error(
      "[license-check]",
      JSON.stringify({
        schoolId,
        warning: "notify-failed",
        reason: error instanceof Error ? error.message.slice(0, 120) : "failed",
      })
    );
  }
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
