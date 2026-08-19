import type { LicenseFeatureKey } from "./features";
export type { LicenseFeatureKey } from "./features";

export const LICENSE_PRODUCT_CODES = [
  "lms",
  "lawyer_management",
  "workflow",
  "pos",
  "school_management",
  "other",
] as const;

export type LicenseProductCode = (typeof LICENSE_PRODUCT_CODES)[number];

export type LicenseStatusCode =
  | "TRIAL"
  | "ACTIVE"
  | "GRACE"
  | "EXPIRED"
  | "SUSPENDED"
  | "REVOKED";

export interface LicenseLimits {
  maxLearners: number | null;
  maxEducators: number | null;
  maxAdministrators: number | null;
  maxCampuses: number | null;
  storageLimitBytes: number | null;
}

export interface LicenseClaims {
  iss: string;
  sub: string;
  product: string;
  productName?: string;
  planCode?: string | null;
  planName?: string | null;
  licenseKey: string;
  institutionId?: string | null;
  installationId?: string | null;
  registeredDomain?: string | null;
  stagingDomain?: string | null;
  serverInstanceId?: string | null;
  customerName?: string | null;
  status: LicenseStatusCode;
  issuedAt?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  gracePeriodDays: number;
  limits: LicenseLimits;
  features: Record<string, boolean>;
}

export interface EvaluatedLicense {
  effectiveStatus: LicenseStatusCode;
  restricted: boolean;
  signatureValid: boolean;
  usingCache: boolean;
  serverUnavailable: boolean;
  warnings: string[];
  claims: LicenseClaims | null;
  daysUntilExpiry: number | null;
  daysRemainingInGrace: number | null;
  daysOffline: number | null;
}

export const LEARNER_LIMIT_MESSAGE =
  "Your institution has reached the active learner limit for the current licence. Please contact your LMS provider to upgrade the licence.";

export const FEATURE_DISABLED_MESSAGE =
  "This module is not included in your current licence. Please contact your LMS provider to enable it.";

export const RESTRICTED_MODE_MESSAGE =
  "This institution is in restricted mode because the licence is expired, suspended, or revoked. Administrators may view licence information, export backups, and contact support. School data has not been deleted.";

export type LicenseAction =
  | "create_learner"
  | "activate_learner"
  | "create_educator"
  | "create_administrator"
  | "create_campus"
  | "write";

export interface LicenseUsage {
  activeLearners: number;
  educators: number;
  administrators: number;
  campuses: number;
  storageBytes: number;
}

export interface FeatureCheck {
  feature: LicenseFeatureKey;
}
