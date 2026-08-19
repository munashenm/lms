import type { EvaluatedLicense, LicenseClaims, LicenseStatusCode } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export interface EvaluateLicenseInput {
  now: Date;
  claims: LicenseClaims | null;
  signatureValid: boolean;
  lastVerifiedAt: Date | null;
  storedStatus: LicenseStatusCode | null;
  offlineGraceDays: number;
  serverUnavailable?: boolean;
  trustUnsignedLocal?: boolean;
}

/**
 * Pure licence state machine. One failed heartbeat never disables the LMS;
 * only genuine expiry/suspension/revocation or an offline period beyond grace
 * moves the installation into restricted mode.
 */
export function evaluateLicense(input: EvaluateLicenseInput): EvaluatedLicense {
  const warnings: string[] = [];
  const {
    now,
    claims,
    signatureValid,
    lastVerifiedAt,
    storedStatus,
    offlineGraceDays,
    serverUnavailable = false,
    trustUnsignedLocal = false,
  } = input;

  if (!claims) {
    const localOk = trustUnsignedLocal && storedStatus && !["EXPIRED", "SUSPENDED", "REVOKED"].includes(storedStatus);
    return {
      effectiveStatus: storedStatus ?? "EXPIRED",
      restricted: !localOk,
      signatureValid: false,
      usingCache: false,
      serverUnavailable,
      warnings: localOk
        ? ["Licence has not been cryptographically verified. Connect to the licence server when possible."]
        : ["No valid licence is installed. Activate a licence to restore full access."],
      claims: null,
      daysUntilExpiry: null,
      daysRemainingInGrace: null,
      daysOffline: lastVerifiedAt ? Math.max(0, daysBetween(lastVerifiedAt, now)) : null,
    };
  }

  if (!signatureValid && !trustUnsignedLocal) {
    return {
      effectiveStatus: "REVOKED",
      restricted: true,
      signatureValid: false,
      usingCache: Boolean(claims),
      serverUnavailable,
      warnings: ["The cached licence signature is invalid. Restricted mode is active until a valid signed licence is installed."],
      claims,
      daysUntilExpiry: null,
      daysRemainingInGrace: null,
      daysOffline: lastVerifiedAt ? Math.max(0, daysBetween(lastVerifiedAt, now)) : null,
    };
  }

  const status = claims.status;
  if (status === "SUSPENDED" || status === "REVOKED") {
    return {
      effectiveStatus: status,
      restricted: true,
      signatureValid,
      usingCache: serverUnavailable,
      serverUnavailable,
      warnings: [
        status === "SUSPENDED"
          ? "This licence has been suspended. Contact your LMS provider."
          : "This licence has been revoked. Contact your LMS provider.",
      ],
      claims,
      daysUntilExpiry: null,
      daysRemainingInGrace: null,
      daysOffline: lastVerifiedAt ? Math.max(0, daysBetween(lastVerifiedAt, now)) : null,
    };
  }

  const startsAt = claims.startsAt ? new Date(claims.startsAt) : null;
  if (startsAt && now < startsAt) {
    return {
      effectiveStatus: "TRIAL",
      restricted: true,
      signatureValid,
      usingCache: serverUnavailable,
      serverUnavailable,
      warnings: ["This licence has not started yet."],
      claims,
      daysUntilExpiry: claims.expiresAt
        ? Math.max(0, daysBetween(now, new Date(claims.expiresAt)))
        : null,
      daysRemainingInGrace: null,
      daysOffline: lastVerifiedAt ? Math.max(0, daysBetween(lastVerifiedAt, now)) : null,
    };
  }

  const expiresAt = claims.expiresAt ? new Date(claims.expiresAt) : null;
  const graceDays = claims.gracePeriodDays ?? 0;
  const graceEndsAt = expiresAt
    ? new Date(expiresAt.getTime() + graceDays * MS_PER_DAY)
    : null;

  let daysUntilExpiry: number | null = null;
  if (expiresAt) {
    daysUntilExpiry = daysBetween(now, expiresAt);
  }

  if (expiresAt && now > expiresAt) {
    if (graceEndsAt && now <= graceEndsAt) {
      const remaining = Math.max(0, daysBetween(now, graceEndsAt));
      warnings.push(
        `Your licence expired on ${expiresAt.toISOString().slice(0, 10)}. You are in a ${graceDays}-day grace period (${remaining} day(s) remaining). Please renew.`
      );
      return {
        effectiveStatus: "GRACE",
        restricted: false,
        signatureValid,
        usingCache: serverUnavailable,
        serverUnavailable,
        warnings,
        claims,
        daysUntilExpiry: Math.max(0, daysUntilExpiry ?? 0),
        daysRemainingInGrace: remaining,
        daysOffline: lastVerifiedAt ? Math.max(0, daysBetween(lastVerifiedAt, now)) : null,
      };
    }
    return {
      effectiveStatus: "EXPIRED",
      restricted: true,
      signatureValid,
      usingCache: serverUnavailable,
      serverUnavailable,
      warnings: ["This licence has expired. The LMS is in restricted mode. School data has not been deleted."],
      claims,
      daysUntilExpiry: 0,
      daysRemainingInGrace: 0,
      daysOffline: lastVerifiedAt ? Math.max(0, daysBetween(lastVerifiedAt, now)) : null,
    };
  }

  const daysOffline = lastVerifiedAt ? Math.max(0, daysBetween(lastVerifiedAt, now)) : 0;
  if (serverUnavailable) {
    if (lastVerifiedAt && daysOffline > offlineGraceDays) {
      warnings.push(
        `The licence server has been unreachable for ${daysOffline} day(s), which exceeds the offline grace period of ${offlineGraceDays} day(s). Restricted mode is active until the next successful verification.`
      );
      return {
        effectiveStatus: status,
        restricted: true,
        signatureValid,
        usingCache: true,
        serverUnavailable: true,
        warnings,
        claims,
        daysUntilExpiry,
        daysRemainingInGrace: null,
        daysOffline,
      };
    }
    warnings.push(
      "The licence server could not be contacted. The LMS will continue using the last valid cached licence."
    );
  }

  if (daysUntilExpiry !== null && daysUntilExpiry <= 14) {
    warnings.push(`Licence expires in ${daysUntilExpiry} day(s). Please plan a renewal.`);
  }

  if (!signatureValid && trustUnsignedLocal) {
    warnings.push("Local unsigned licence is trusted for this environment only. Production installations must verify signed licences.");
  }

  return {
    effectiveStatus: status,
    restricted: false,
    signatureValid,
    usingCache: serverUnavailable,
    serverUnavailable,
    warnings,
    claims,
    daysUntilExpiry,
    daysRemainingInGrace: null,
    daysOffline: lastVerifiedAt ? daysOffline : null,
  };
}

export function learnerLimitReached(
  activeLearners: number,
  maxLearners: number | null | undefined
): boolean {
  if (maxLearners == null) return false;
  return activeLearners >= maxLearners;
}

export function staffLimitReached(
  current: number,
  max: number | null | undefined
): boolean {
  if (max == null) return false;
  return current >= max;
}

export function isActiveLearnerStatus(status: string): boolean {
  return status === "ACTIVE";
}
