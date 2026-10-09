/** Classifications stored on the licence row. Never include secrets in these codes. */
export type LicenseFailureClass =
  | "NETWORK"
  | "TIMEOUT"
  | "HTTP_400"
  | "HTTP_401"
  | "HTTP_403"
  | "HTTP_404"
  | "HTTP_429"
  | "HTTP_4XX"
  | "HTTP_5XX"
  | "MALFORMED_RESPONSE"
  | "INVALID_SIGNATURE"
  | "LICENSE_REJECTED";

export type LicenseContactFailure = "transport" | "http";

export const LICENSE_CHECK_MAX_ATTEMPTS = 3;
export const LICENSE_WARNING_AFTER_DAYS = 3;

const BACKOFF_MS = [0, 400, 1200];

export function classifyHttpStatus(status: number): {
  classification: LicenseFailureClass;
  transient: boolean;
} {
  if (status === 400) return { classification: "HTTP_400", transient: false };
  if (status === 401) return { classification: "HTTP_401", transient: false };
  if (status === 403) return { classification: "HTTP_403", transient: false };
  if (status === 404) return { classification: "HTTP_404", transient: false };
  if (status === 429) return { classification: "HTTP_429", transient: true };
  if (status >= 500 && status <= 599) return { classification: "HTTP_5XX", transient: true };
  if (status >= 400 && status <= 499) return { classification: "HTTP_4XX", transient: false };
  return { classification: "MALFORMED_RESPONSE", transient: false };
}

export function classifyTransportError(error: unknown): "TIMEOUT" | "NETWORK" {
  const name =
    error && typeof error === "object" && "name" in error ? String((error as { name: string }).name) : "";
  if (name === "TimeoutError" || name === "AbortError") return "TIMEOUT";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("timeout") || message.includes("aborted")) return "TIMEOUT";
  return "NETWORK";
}

export function isTransientLicenseFailure(classification: string): boolean {
  return (
    classification === "NETWORK" ||
    classification === "TIMEOUT" ||
    classification === "HTTP_429" ||
    classification === "HTTP_5XX"
  );
}

export function shouldRetryLicenseCheck(classification: string, attemptsSoFar: number): boolean {
  if (attemptsSoFar >= LICENSE_CHECK_MAX_ATTEMPTS) return false;
  return isTransientLicenseFailure(classification);
}

/** Delay before the next attempt. Attempt 0 is the first try and does not wait. */
export function licenseRetryDelayMs(nextAttemptIndex: number, retryAfterSeconds?: number | null): number {
  if (nextAttemptIndex <= 0) return 0;
  if (
    retryAfterSeconds != null &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds >= 0 &&
    retryAfterSeconds <= 2
  ) {
    return Math.round(retryAfterSeconds * 1000);
  }
  return BACKOFF_MS[nextAttemptIndex] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
}

export function licenseErrorCode(classification: LicenseFailureClass | string): string {
  if (classification === "LICENSE_REJECTED") return "LICENSE_REJECTED";
  if (classification === "INVALID_SIGNATURE") return "LICENSE_INVALID_SIGNATURE";
  if (classification === "MALFORMED_RESPONSE") return "LICENSE_MALFORMED_RESPONSE";
  if (classification === "NETWORK") return "LICENSE_NETWORK";
  if (classification === "TIMEOUT") return "LICENSE_TIMEOUT";
  if (classification.startsWith("HTTP_")) return `LICENSE_${classification}`;
  return "LICENSE_CHECK_FAILED";
}

export function contactFailureFor(classification: string): LicenseContactFailure {
  if (classification === "NETWORK" || classification === "TIMEOUT") return "transport";
  return "http";
}

/** Drop credentials and licence keys before anything is stored or logged. */
export function sanitizeLicenseMessage(message: string | null | undefined): string {
  if (!message) return "";
  return message
    .replace(/SHSA-[A-Z0-9-]{4,}/gi, "[redacted]")
    .replace(/SG\.[A-Za-z0-9._-]{8,}/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/-----BEGIN[\s\S]*?-----END[^-]+-----/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function repeatedVerificationWarning(schoolName: string, days: number): string {
  const unit = days === 1 ? "day" : "days";
  return `Licence verification warning — ${schoolName} has failed verification for ${days} ${unit}.`;
}

export function parseRetryAfterSeconds(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds;
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, (date - Date.now()) / 1000);
}
